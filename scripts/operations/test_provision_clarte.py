"""Safety tests; real database tests opt in only on a named disposable fixture."""
import argparse
import base64
import contextlib
import importlib.util
import io
import os
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import uuid

spec = importlib.util.spec_from_file_location('provision', Path(__file__).with_name('provision-clarte.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class FakeClient:
    queries = []
    collision = None
    fail_grant = False
    def __init__(self, *args, **kwargs): pass
    def close(self): pass
    def query(self, sql):
        self.queries.append(sql)
        if 'VERSION()' in sql: return ['11.4.5-MariaDB']
        if 'GET_LOCK' in sql: return ['1']
        if 'SCHEMATA' in sql: return ['1' if self.collision == 'database' else '0']
        if 'mysql.user' in sql: return ['1' if self.collision == 'user' else '0']
        if sql.startswith('GRANT') and self.fail_grant: raise p.Refused('fixture failure')
        return []

class SafetyTests(unittest.TestCase):
    def setUp(self):
        FakeClient.queries = []
        FakeClient.collision = None
        FakeClient.fail_grant = False

    def test_default_is_dry_run(self):
        args = p.arguments([])
        self.assertFalse(args.apply)
        with patch.object(p, 'Client', FakeClient), patch.object(p, 'topology', return_value=('172.24.0.0/255.255.0.0', '172.24.0.2')), contextlib.redirect_stdout(io.StringIO()):
            p.provision(args, 'fixture-only', password_reader=lambda: self.fail('dry run prompted for app secret'))
        self.assertFalse(any(sql.startswith(('CREATE', 'GRANT', 'ALTER', 'DROP')) for sql in FakeClient.queries))
        self.assertIn("DO RELEASE_LOCK('argos:provision')", FakeClient.queries)

    def test_existing_name_stops_before_any_creation(self):
        for collision in ['database', 'user']:
            FakeClient.collision = collision
            FakeClient.queries = []
            with self.subTest(collision=collision), patch.object(p, 'Client', FakeClient), patch.object(p, 'topology', return_value=('172.24.0.0/255.255.0.0', '172.24.0.2')), self.assertRaises(p.Refused):
                p.provision(p.arguments(['--apply']), 'fixture', password_reader=lambda: self.fail('collision prompted for app secret'))
            self.assertFalse(any(sql.startswith(('CREATE', 'GRANT')) for sql in FakeClient.queries))

    def test_partial_ddl_failure_preserves_new_objects(self):
        FakeClient.fail_grant = True
        with patch.object(p, 'Client', FakeClient), patch.object(p, 'topology', return_value=('172.24.0.0/255.255.0.0', '172.24.0.2')), contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(p.Refused, 'partiel'):
            p.provision(p.arguments(['--apply']), 'fixture', password_reader=lambda: 'fixture-password-long-enough')
        self.assertTrue(any(sql.startswith('CREATE USER') for sql in FakeClient.queries))
        self.assertFalse(any(sql.startswith(('DROP', 'DELETE', 'ALTER')) for sql in FakeClient.queries))
        self.assertNotIn('fixture-password-long-enough', ' '.join(FakeClient.queries))

    def test_identifiers_cannot_expand_grants_or_inject_sql(self):
        for name in ['db_with_underscore', 'db%', 'db;DROP', 'db`', 'a' * 65]:
            with self.subTest(name=name), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                p.arguments(['--database', name])

    def test_topology_mismatch_refused(self):
        with patch.object(p, 'docker_json', return_value={'IPAM': {'Config': [{'Subnet': '172.25.0.0/16'}]}}), self.assertRaises(p.Refused):
            p.topology(p.arguments([]))
        for network in ['0.0.0.0/0', '8.8.8.0/24']:
            with self.subTest(network=network), self.assertRaises(p.Refused):
                p.topology(p.arguments(['--subnet', network]))

    def test_password_option_file_escapes_special_characters(self):
        slash = chr(92)
        password = 'a"b' + slash + 'c' + chr(10) + chr(13) + chr(9)
        self.assertEqual(p.option_string(password), '"a' + slash + '"b' + slash * 2 + 'c' + slash + 'n' + slash + 'r' + slash + 't"')

    def test_error_diagnostic_never_discloses_raw_driver_details(self):
        for message, expected in [
            ('ERROR 1045 (28000): denied SECRET_PASSWORD *PRIVATE_HASH private-user@host', 'ERROR=1045 SQLSTATE=28000'),
            ('ERROR 1142 (42000): denied SECRET_PASSWORD private-table', 'ERROR=1142 SQLSTATE=42000'),
            ('unknown option SECRET_PASSWORD PRIVATE_HASH', 'code indisponible'),
        ]:
            client = p.Client.__new__(p.Client)
            with tempfile.TemporaryFile() as client.errors:
                client.errors.write(message.encode('utf-8'))
                output = str(client.refusal())
            self.assertIn(expected, output)
            for private in ['SECRET_PASSWORD', 'PRIVATE_HASH', 'private-user', 'private-table', 'host']:
                self.assertNotIn(private, output)

    def test_no_unmasked_fallback(self):
        with patch.object(p.getpass, 'getpass', side_effect=p.getpass.GetPassWarning), contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(p.main([]), 1)
            self.assertIn('[root]', p.getpass.getpass.call_args.args[0])
        self.assertIn('saisie masquée', output.getvalue())


@unittest.skipUnless(os.environ.get('ARGOS_PROVISION_TEST_CONTAINER', '').startswith('argos-provision-test-'), 'Requires explicitly named disposable MariaDB fixture')
class MariaDBTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = os.environ['ARGOS_PROVISION_TEST_CONTAINER']
        cls.network = os.environ['ARGOS_PROVISION_TEST_NETWORK']
        cls.password = os.environ['ARGOS_PROVISION_TEST_ROOT_PASSWORD']
        info = p.docker_json('network', cls.network)
        cls.subnet = info['IPAM']['Config'][0]['Subnet']
        cls.root = p.Client(cls.container, 'root', cls.password)
        cls.root.query('CREATE DATABASE preservedpublic')
        cls.root.query('CREATE TABLE preservedpublic.marker (value INT)')
        cls.root.query('INSERT INTO preservedpublic.marker VALUES (42)')

    @classmethod
    def tearDownClass(cls):
        # Fixture container removal belongs to CI, never to the provisioning script.
        cls.root.close()

    def args(self, apply=False):
        suffix = uuid.uuid4().hex[:12]
        values = ['--container', self.container, '--network', self.network, '--subnet', self.subnet, '--database', 'db' + suffix, '--user', 'u' + suffix]
        if apply: values.append('--apply')
        return p.arguments(values)

    def run_provision(self, args):
        # Quotes, backslash and Unicode exercise both local hashing and option-file escaping.
        secret = 'fixture-secret-avec-quote"-et-' + chr(92) + '-é-123456'
        with contextlib.redirect_stdout(io.StringIO()) as output:
            p.provision(args, self.password, password_reader=lambda: secret)
        self.assertNotIn(secret, output.getvalue())
        return output.getvalue(), secret

    def test_dry_run_and_real_creation_grants_replay_and_isolation(self):
        args = self.args()
        output, _ = self.run_provision(args)
        self.assertIn('DRY_RUN OK', output)
        self.assertEqual(p.scalar(self.root, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='" + args.database + "'"), '0')
        args.apply = True
        output, secret = self.run_provision(args)
        self.assertIn('APPLIED OK', output)
        with self.assertRaises(p.Refused): self.run_provision(args)
        host, address = p.topology(args)
        app = p.Client(self.container, args.user, secret, ('--protocol=TCP', '--host=' + address, '--database=' + args.database))
        try:
            app.query('CREATE TABLE migrationprobe (id INT PRIMARY KEY)')
            app.query('INSERT INTO migrationprobe VALUES (1)')
            self.assertEqual(p.scalar(app, 'SELECT id FROM migrationprobe'), '1')
            with self.assertRaises(p.Refused): app.query('SELECT value FROM preservedpublic.marker')
        finally: app.close()
        self.assertEqual(p.scalar(self.root, 'SELECT value FROM preservedpublic.marker'), '42')
        outside = p.Client(self.container, args.user, secret, ('--protocol=TCP', '--host=127.0.0.1'))
        try:
            with self.assertRaises(p.Refused): outside.query('SELECT 1')
        finally: outside.close()

    def test_existing_user_on_different_host_and_existing_base_are_preserved(self):
        for collision in ['database', 'user']:
            args = self.args(True)
            if collision == 'database':
                self.root.query('CREATE DATABASE `' + args.database + '`')
                self.root.query('CREATE TABLE `' + args.database + '`.marker (id INT)')
            else:
                self.root.query("CREATE USER '" + args.user + "'@'localhost' IDENTIFIED BY 'synthetic-existing-fixture'")
            with self.subTest(collision=collision), self.assertRaises(p.Refused): self.run_provision(args)
            if collision == 'database':
                self.assertEqual(p.scalar(self.root, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='" + args.database + "'"), '1')
            else:
                self.assertEqual(p.scalar(self.root, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='" + args.database + "'"), '0')

    def test_lock_prevents_concurrent_provisioning(self):
        self.assertEqual(p.scalar(self.root, "SELECT GET_LOCK('argos:provision',1)"), '1')
        try:
            args = self.args(True)
            with self.assertRaisesRegex(p.Refused, 'autre provisionnement'): self.run_provision(args)
        finally: self.root.query("DO RELEASE_LOCK('argos:provision')")

    def test_missing_operator_privileges_is_reported_without_creation(self):
        args = self.args(True)
        args.admin_user = 'limited' + uuid.uuid4().hex[:8]
        secret = 'synthetic-limited-admin-fixture'
        self.root.query("CREATE USER '" + args.admin_user + "'@'localhost' IDENTIFIED VIA mysql_native_password USING '" + p.native_hash(secret) + "'")
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(p.Refused, 'Étape=absence-utilisateur.*ERROR=1142'):
            p.provision(args, secret, password_reader=lambda: self.fail('denied privileges prompted for app secret'))
        self.assertEqual(p.scalar(self.root, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='" + args.database + "'"), '0')

    def test_wrong_admin_password_and_temp_file_cleanup(self):
        args = self.args(True)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(p.Refused, 'Étape=connexion/version.*ERROR=1045'):
            p.provision(args, 'wrong-fixture-password', password_reader=lambda: self.fail('invalid DBA credentials prompted for app secret'))
        result = p.subprocess.run(['docker', 'exec', self.container, 'sh', '-c', 'find /tmp -maxdepth 1 -name "argos-provision.*"'], capture_output=True, text=True, check=True)
        # One option file belongs to the long-lived test root connection.
        self.assertEqual(len(result.stdout.splitlines()), 1)

if __name__ == '__main__': unittest.main()
