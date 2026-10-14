#!/usr/bin/env python3
"""Expired-data maintenance in the existing Argos database; dry run by default."""
import argparse
import base64
import datetime
import getpass
import importlib.util
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid
import warnings

spec = importlib.util.spec_from_file_location('argos_operator', Path(__file__).with_name('provision-clarte.py'))
op = importlib.util.module_from_spec(spec)
spec.loader.exec_module(op)

# Only expired temporary data/cache, never accounts, runs, reports or usage ledger.
# One-day grace avoids deleting recently expired proofs; policy retention is 90 days.
POLICIES = {
    'ARG_ACCOUNT_TOKEN': ('expires_at', 1),
    'ARG_ACCOUNT_OAUTH': ('expires_at', 1),
    'ARG_ACCOUNT_RUN_CLAIM': ('expires_at', 1),
    'ARG_ACCOUNT_SESSION': ('expires_at', 1),
    'ARG_ACCOUNT_RATE': ('expires_at', 1),
    'ARG_ACCOUNT_SECURITY_EVENT': ('created_at', 90),
    'ARG_DOMAIN_ANALYSIS': ('expires_at', 1),
}
DUMP_SHELL = op.CREDENTIAL_SHELL + r'''
mariadb-dump --defaults-extra-file="$cfg" --single-transaction --skip-lock-tables \
  --hex-blob --databases "$@"
'''


def stopped(args):
    info = op.docker_json('container', args.api_container)
    if info.get('State', {}).get('Running') is not False:
        raise op.Refused('Application refusée : arrêter les écrivains API/workers de cette base avant le nettoyage. La console publique peut rester active.')


def inventory(client, args):
    if op.scalar(client, 'SELECT DATABASE()') != args.database:
        raise op.Refused('Base sélectionnée différente de la cible nommée.')
    if not re.match(r'^11\.4\.\d+.*MariaDB', op.scalar(client, 'SELECT VERSION()')):
        raise op.Refused('Procédure validée pour MariaDB 11.4 uniquement.')
    client.query("SET SESSION time_zone='+00:00'")
    timestamp = op.scalar(client, "SELECT DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%d %H:%i:%s.%f')")
    if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}', timestamp):
        raise op.Refused('Date de référence MariaDB invalide.')
    tables = {}
    for row in client.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"):
        name, engine = row.split('\t')
        if not re.fullmatch(r'[A-Za-z0-9_]{1,64}', name):
            raise op.Refused('Nom de table inhabituel : revue opérateur nécessaire.')
        tables[name] = engine
    if 'flyway_schema_history' not in tables:
        raise op.Refused('Historique Flyway absent : aucune maintenance automatique.')
    if op.scalar(client, 'SELECT COUNT(*) FROM flyway_schema_history WHERE success=0') != '0':
        raise op.Refused('Migration Flyway en échec : la maintenance ne répare pas le schéma.')
    plan = {}
    for name, (column, days) in POLICIES.items():
        if name not in tables:
            continue  # Older installed schema: no creation or migration by this tool.
        if tables[name] != 'InnoDB':
            raise op.Refused('Une table ciblée ne permet pas la transaction InnoDB.')
        if op.scalar(client, "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='" + name + "' AND COLUMN_NAME='" + column + "'") != '1':
            raise op.Refused('Colonne de rétention absente ; schéma à vérifier.')
        if op.scalar(client, "SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='" + name + "'") != '0':
            raise op.Refused('Référence entrante inattendue vers une table ciblée ; nettoyage automatique refusé.')
        predicate = column + " < DATE_SUB('" + timestamp + "',INTERVAL " + str(days) + ' DAY)'
        plan[name] = predicate
    if op.scalar(client, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()") != '0':
        raise op.Refused('Triggers non prévus : revue de la sauvegarde et des effets nécessaire.')
    for kind, column in [('ROUTINES', 'ROUTINE_SCHEMA'), ('EVENTS', 'EVENT_SCHEMA')]:
        if op.scalar(client, 'SELECT COUNT(*) FROM information_schema.' + kind + ' WHERE ' + column + '=DATABASE()') != '0':
            raise op.Refused('Objets SQL supplémentaires non prévus : revoir la sauvegarde avant maintenance.')
    return plan, tables, timestamp


def counts(client, tables):
    return {name: int(op.scalar(client, 'SELECT COUNT(*) FROM `' + name + '`')) for name in tables}


def backup(args, password, address):
    directory = args.backup_dir.resolve(strict=True)
    if not directory.is_dir() or directory.stat().st_mode & 0o022:
        raise op.Refused('Répertoire de sauvegarde invalide ou ouvert en écriture à d’autres utilisateurs.')
    label = args.database + '-before-clean-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    pending = directory / (label + '.incomplete.sql')
    ready = directory / (label + '.sql')
    fd = os.open(pending, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, 'wb') as output:
            options = '[client]\nuser=' + op.option_string(args.admin_user) + '\npassword=' + op.option_string(password) + '\n'
            encoded = base64.b64encode(options.encode('utf-8')) + b'\n'
            result = subprocess.run(['docker', 'exec', '-i', args.container, 'sh', '-c', DUMP_SHELL,
                                     'argos-maintenance-backup', '--protocol=TCP', '--host=' + address, args.database],
                                    input=encoded, stdout=output, stderr=subprocess.DEVNULL, timeout=300)
            output.flush()
            os.fsync(output.fileno())
        # Confirm a dump selecting the exact source DB; never print its contents.
        with pending.open('rb') as stream:
            header = stream.read(1024 * 1024)
        if result.returncode or not header or ('USE `' + args.database + '`;').encode('ascii') not in header:
            raise op.Refused('Sauvegarde refusée/incomplète ; fichier partiel conservé, aucune suppression effectuée.')
        if ready.exists():
            raise op.Refused('Collision de nom de sauvegarde ; aucune suppression effectuée.')
        pending.rename(ready)
        print('Sauvegarde complète et privée : ' + str(ready))
        return ready
    except op.Refused:
        raise
    except Exception:
        raise op.Refused('Échec de sauvegarde ; fichier partiel conservé, aucune suppression effectuée.') from None


def maintenance(args, password):
    _, address = op.topology(args)
    if args.apply:
        stopped(args)
    client = op.Client(args.container, args.admin_user, password,
                       ('--protocol=TCP', '--host=' + address, '--database=' + args.database))
    transaction = False
    locked = False
    try:
        if op.scalar(client, "SELECT GET_LOCK('argos:maintenance',5)") != '1':
            raise op.Refused('Une autre maintenance est en cours.')
        locked = True
        plan, tables, timestamp = inventory(client, args)
        candidates = {name: int(op.scalar(client, 'SELECT COUNT(*) FROM `' + name + '` WHERE ' + predicate)) for name, predicate in plan.items()}
        print('Base=' + args.database + ' compte=' + args.admin_user + ' référence-UTC=' + timestamp)
        print('Conservés : comptes/identités, audits/rapports, sites/domaines/lots, consommations, support/newsletter/analytics, historique Flyway et lignes de contrôle.')
        for name, count in candidates.items():
            print(name + ' : ' + str(count) + ' lignes périmées candidates')
        if not args.apply:
            print('DRY_RUN OK : aucune donnée supprimée ; --apply exige API/workers arrêtés et sauvegarde automatique réussie.')
            return None
        if not any(candidates.values()):
            print('NO_CHANGES : aucune donnée périmée à nettoyer.')
            return None
        stopped(args)
        dump = backup(args, password, address)
        stopped(args)
        client.query('START TRANSACTION')
        transaction = True
        preserved = [name for name in tables if name not in plan]
        before = counts(client, preserved)
        # No TRUNCATE/DDL/foreign-key disabling; the whole cleanup can roll back.
        for name, predicate in plan.items():
            client.query('DELETE FROM `' + name + '` WHERE ' + predicate)
        after = counts(client, preserved)
        if after != before:
            raise op.Refused('Compteurs conservés modifiés ; nettoyage annulé.')
        for name, predicate in plan.items():
            if op.scalar(client, 'SELECT COUNT(*) FROM `' + name + '` WHERE ' + predicate) != '0':
                raise op.Refused('Nettoyage incomplet ; transaction annulée.')
        client.query('COMMIT')
        transaction = False
        print('APPLIED OK : seules les lignes périmées listées ont été supprimées ; tables, comptes, rapports, registre et Flyway conservés.')
        print('Aucun service démarré ou déployé. Vérifier la recette puis décider de la remise en service.')
        return dump
    finally:
        if transaction:
            try: client.query('ROLLBACK')
            except op.Refused: pass  # Connection closure also aborts an uncommitted transaction.
        if locked:
            try: client.query("DO RELEASE_LOCK('argos:maintenance')")
            except op.Refused: pass
        client.close()


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container', default='mariadb-public')
    parser.add_argument('--network', default='mariadb-public')
    parser.add_argument('--subnet', default='172.24.0.0/16')
    parser.add_argument('--database', default='argos_db_prod')
    parser.add_argument('--admin-user', default='argos_user', help='Existing account with SELECT/DELETE rights on this DB.')
    parser.add_argument('--api-container', default='api-backend')
    parser.add_argument('--backup-dir', type=Path, default=Path.cwd())
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(argv)
    for name in (args.database, args.admin_user):
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', name): parser.error('Identifiant de base/compte invalide.')
    for name in (args.container, args.network, args.api_container):
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', name): parser.error('Nom Docker invalide.')
    return args


def main(argv=None):
    args = arguments(argv)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            password = getpass.getpass('Mot de passe MariaDB [' + args.admin_user + '] (saisie masquée) : ')
            maintenance(args, password)
        return 0
    except KeyboardInterrupt:
        print('Interruption ; transaction non validée annulée, sauvegarde conservée. Vérifier la cible avant reprise.', file=sys.stderr)
    except (op.Refused, getpass.GetPassWarning) as error:
        print(str(error) if isinstance(error, op.Refused) else 'Un terminal avec saisie masquée est requis.', file=sys.stderr)
    except Exception:
        print('Échec de maintenance ; aucun détail sensible affiché. Préserver la sauvegarde et vérifier la cible.', file=sys.stderr)
    return 1


if __name__ == '__main__': sys.exit(main())
