#!/usr/bin/env python3
"""Operator provisioning only. Python stdlib + Docker; no Flyway or deployment."""
import argparse
import base64
import getpass
import hashlib
import ipaddress
import json
import queue
import re
import subprocess
import sys
import tempfile
import threading
import uuid
import warnings


class Refused(Exception):
    pass


# The private option file exists only for this client session and is removed on exit.
# Neither passwords nor SQL are arguments to docker/sh/mariadb. Never print stderr:
# client failures can contain authentication hashes or connection details.
CREDENTIAL_SHELL = r'''
set -eu
umask 077
cfg=$(mktemp /tmp/argos-provision.XXXXXXXX)
trap 'rm -f -- "$cfg"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
IFS= read -r encoded
printf '%s' "$encoded" | base64 -d > "$cfg"
unset encoded MYSQL_PWD
export MYSQL_HISTFILE=/dev/null
'''

CLIENT_SHELL = CREDENTIAL_SHELL + r'''
mariadb --defaults-extra-file="$cfg" --batch --skip-column-names --raw \
  --unbuffered --skip-reconnect "$@"
'''


def option_string(value):
    slash = chr(92)
    replacements = {slash: slash * 2, '"': slash + '"', chr(10): slash + 'n', chr(13): slash + 'r', chr(9): slash + 't'}
    return '"' + ''.join(replacements.get(char, char) for char in value) + '"'


def native_hash(password):
    first = hashlib.sha1(password.encode('utf-8')).digest()
    return '*' + hashlib.sha1(first).hexdigest().upper()


class Client:
    def __init__(self, container, user, password, extra=()):
        self.errors = tempfile.TemporaryFile()
        self.lines = queue.Queue()
        try:
            self.proc = subprocess.Popen(
                ['docker', 'exec', '-i', container, 'sh', '-c', CLIENT_SHELL,
                 'argos-provision-client', *extra],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.errors,
                text=True, encoding='utf-8', bufsize=1)
            options = '[client]\nuser=' + option_string(user) + '\npassword=' + option_string(password) + '\n'
            self.proc.stdin.write(base64.b64encode(options.encode('utf-8')).decode('ascii') + '\n')
            self.proc.stdin.flush()
            threading.Thread(target=self._read, daemon=True).start()
        except Exception:
            self.close()
            raise Refused('Client Docker/MariaDB indisponible ; aucun détail sensible affiché.') from None

    def _read(self):
        try:
            for line in self.proc.stdout:
                self.lines.put(line.rstrip('\r\n'))
        finally:
            self.lines.put(None)

    def refusal(self):
        self.errors.flush()
        self.errors.seek(0)
        diagnostic = self.errors.read(8192).decode('utf-8', errors='replace')
        match = re.search(r'\bERROR\s+([0-9]{4,5})(?:\s+\(([A-Z0-9]{5})\))?', diagnostic)
        if not match:
            return Refused('Client MariaDB refusé (code indisponible) ; aucun message brut affiché.')
        code = match.group(1)
        state = ' SQLSTATE=' + match.group(2) if match.group(2) else ''
        if code in {'1045', '1698'}:
            reason = 'Authentification refusée ; vérifier le compte DBA et le mot de passe.'
        elif code in {'1044', '1142', '1143', '1227'}:
            reason = 'Droits insuffisants pour cette opération ; utiliser le compte DBA autorisé.'
        elif code in {'2002', '2003'}:
            reason = 'Connexion MariaDB indisponible ; vérifier le socket et la cible.'
        else:
            reason = 'Opération MariaDB refusée ; transmettre ce code au mainteneur.'
        return Refused('MariaDB ERROR=' + code + state + '. ' + reason)

    def query(self, sql):
        marker = 'ARGOS_END_' + uuid.uuid4().hex
        try:
            self.proc.stdin.write(sql.rstrip(';\n') + ";\nSELECT '" + marker + "';\n")
            self.proc.stdin.flush()
            result = []
            while True:
                line = self.lines.get(timeout=30)
                if line is None:
                    raise self.refusal()
                if line == marker:
                    return result
                result.append(line)
        except (BrokenPipeError, OSError):
            raise self.refusal() from None
        except queue.Empty:
            raise Refused('Client MariaDB interrompu ou délai dépassé ; vérifier la cible avec le DBA.') from None

    def close(self):
        proc = getattr(self, 'proc', None)
        if proc:
            try:
                proc.stdin.close()
            except (OSError, BrokenPipeError):
                pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
            proc.stdout.close()
        self.errors.close()


def docker_json(kind, name):
    try:
        result = subprocess.run(['docker', kind, 'inspect', name] if kind == 'network'
                                else ['docker', 'inspect', name],
                                capture_output=True, text=True, check=True, timeout=15)
        return json.loads(result.stdout)[0]
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        raise Refused('Inventaire Docker inaccessible ; vérifier le conteneur et le réseau nommés.') from None


def topology(args):
    network = ipaddress.IPv4Network(args.subnet, strict=True)
    if not network.is_private or network.prefixlen == 0:
        raise Refused('Un sous-réseau IPv4 privé explicite est requis.')
    info = docker_json('network', args.network)
    subnets = [item.get('Subnet') for item in info.get('IPAM', {}).get('Config', [])]
    if str(network) not in subnets:
        raise Refused('Le sous-réseau demandé ne correspond pas au réseau Docker nommé.')
    container = docker_json('container', args.container)
    entry = container.get('NetworkSettings', {}).get('Networks', {}).get(args.network, {})
    address = entry.get('IPAddress', '')
    if not container.get('State', {}).get('Running') or not address or ipaddress.IPv4Address(address) not in network:
        raise Refused('MariaDB doit être actif et relié au sous-réseau Docker nommé.')
    return str(network.network_address) + '/' + str(network.netmask), address


def scalar(client, sql):
    rows = client.query(sql)
    if len(rows) != 1:
        raise Refused('Résultat MariaDB inattendu ; aucune valeur sensible affichée.')
    return rows[0]


def application_password():
    password = getpass.getpass('Nouveau mot de passe applicatif (du coffre, minimum 24 caractères) : ')
    if len(password) < 24 or '\x00' in password or '\n' in password or '\r' in password:
        raise Refused('Mot de passe applicatif trop court ou contenant un caractère interdit.')
    if getpass.getpass('Confirmer le mot de passe applicatif : ') != password:
        raise Refused('Les deux mots de passe ne correspondent pas.')
    return password


def provision(args, admin_password, password_reader=application_password):
    host, address = topology(args)
    client = Client(args.container, args.admin_user, admin_password)
    created = []
    locked = False
    stage = 'connexion/version'
    account = "'" + args.user + "'@'" + host + "'"
    try:
        version = scalar(client, 'SELECT VERSION()')
        if not re.match(r'^11\.4\.\d+.*MariaDB', version):
            raise Refused('Cette procédure est validée pour MariaDB 11.4 ; version cible différente.')
        stage = 'verrou'
        if scalar(client, "SELECT GET_LOCK('argos:provision',5)") != '1':
            raise Refused('Un autre provisionnement est en cours ; aucune création effectuée.')
        locked = True
        stage = 'absence-base'
        if scalar(client, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='" + args.database + "'") != '0':
            raise Refused('La base existe déjà : refus de la réutiliser, même vide.')
        stage = 'absence-utilisateur'
        if scalar(client, "SELECT COUNT(*) FROM mysql.user WHERE User='" + args.user + "'") != '0':
            raise Refused('Le nom utilisateur existe déjà sur au moins un hôte : refus de le modifier.')
        print('Cible : conteneur=' + args.container + ' réseau=' + args.network +
              ' base=' + args.database + ' utilisateur=' + account)
        if not args.apply:
            print('DRY_RUN OK : noms disponibles ; aucune base ni aucun utilisateur créés.')
            return
        stage = 'saisie-secret-applicatif'
        password = password_reader()
        # Hash locally so a plaintext application password never enters a SQL log.
        encoded = native_hash(password)
        stage = 'creation-base'
        client.query('CREATE DATABASE `' + args.database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        created.append('base')
        stage = 'creation-utilisateur'
        client.query('CREATE USER ' + account + " IDENTIFIED VIA mysql_native_password USING '" + encoded + "'")
        created.append('utilisateur')
        stage = 'attribution-droits'
        client.query('GRANT ALL PRIVILEGES ON `' + args.database + '`.* TO ' + account)
        stage = 'verification-droits'
        grantee = "CONCAT(CHAR(39),'" + args.user + "',CHAR(39),'@',CHAR(39),'" + host + "',CHAR(39))"
        if scalar(client, 'SELECT COUNT(*) FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=' + grantee + " AND (PRIVILEGE_TYPE<>'USAGE' OR IS_GRANTABLE<>'NO')") != '0':
            raise Refused('Droits globaux inattendus sur le nouvel utilisateur.')
        grants = client.query('SELECT TABLE_SCHEMA,PRIVILEGE_TYPE,IS_GRANTABLE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=' + grantee)
        if not grants or any(row.split('\t')[0] != args.database or row.split('\t')[2] != 'NO' for row in grants):
            raise Refused('Droits de schéma inattendus ou délégation de droits active.')
        permissions = {row.split('\t')[1] for row in grants}
        if not {'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'INDEX', 'DROP'}.issubset(permissions):
            raise Refused('Droits DDL/DML incomplets pour le futur démarrage Flyway.')
        stage = 'connexion-applicative-TCP'
        app = Client(args.container, args.user, password,
                     ('--protocol=TCP', '--host=' + address, '--database=' + args.database))
        try:
            if scalar(app, 'SELECT DATABASE()') != args.database or scalar(app, 'SELECT CURRENT_USER()') != args.user + '@' + host:
                raise Refused('La connexion applicative ne sélectionne pas la cible et le compte attendus.')
            if scalar(app, 'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()') != '0':
                raise Refused('La base candidate contient des tables inattendues.')
        finally:
            app.close()
        print('APPLIED OK : base vide, connexion TCP applicative vérifiée, droits limités au schéma sans GRANT OPTION.')
        print('Conserver le mot de passe dans le coffre et remplir la configuration candidate. Aucun service déployé ou redémarré.')
    except Exception as error:
        detail = str(error) if isinstance(error, Refused) else 'Erreur opérateur ; aucun détail sensible affiché.'
        if created:
            raise Refused('Étape=' + stage + '. ' + detail + ' Provisionnement partiel (' + ', '.join(created) +
                          ' créée/créé). Les DDL ne sont pas transactionnels : aucune suppression ni reprise automatique. Faire vérifier la cible par le DBA.') from None
        raise Refused('Étape=' + stage + '. ' + detail + ' Aucune création effectuée.') from None
    finally:
        if locked:
            try:
                client.query("DO RELEASE_LOCK('argos:provision')")
            except Refused:
                pass
        client.close()


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container', default='mariadb-public')
    parser.add_argument('--network', default='mariadb-public')
    parser.add_argument('--subnet', default='172.24.0.0/16')
    parser.add_argument('--database', default='argosclarteprod')
    parser.add_argument('--user', default='argosclarte')
    parser.add_argument('--admin-user', default='root')
    parser.add_argument('--apply', action='store_true', help='Create database/user; default is dry run.')
    args = parser.parse_args(argv)
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9]{0,63}', args.database) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9]{0,31}', args.user):
        parser.error('Base et utilisateur : lettres/chiffres uniquement, sans joker de GRANT.')
    if not re.fullmatch(r'[A-Za-z0-9_]{1,80}', args.admin_user):
        parser.error('Nom DBA invalide.')
    for name in (args.container, args.network):
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', name):
            parser.error('Nom de conteneur/réseau invalide.')
    try:
        ipaddress.IPv4Network(args.subnet, strict=True)
    except ValueError:
        parser.error('Sous-réseau IPv4 canonique requis.')
    return args


def main(argv=None):
    args = arguments(argv)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            admin_password = getpass.getpass('Mot de passe DBA MariaDB [' + args.admin_user + '] (saisie masquée) : ')
            provision(args, admin_password)
        return 0
    except KeyboardInterrupt:
        print('Interruption : vérifier les éventuelles créations partielles ; aucune suppression automatique.', file=sys.stderr)
    except (Refused, getpass.GetPassWarning) as error:
        print(str(error) if isinstance(error, Refused) else 'Un terminal avec saisie masquée est requis.', file=sys.stderr)
    except Exception:
        print('Échec opérateur ; vérifier la cible. Aucun détail sensible affiché, aucune suppression automatique.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
