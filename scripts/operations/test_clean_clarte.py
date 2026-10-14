"""Expired-data maintenance on a named disposable MariaDB, never production."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import uuid

spec = importlib.util.spec_from_file_location('cleanup', Path(__file__).with_name('clean-clarte.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class SafetyTests(unittest.TestCase):
    def test_existing_db_and_app_account_are_default_and_no_writes_by_default(self):
        args = c.arguments([])
        self.assertEqual(args.database, 'argos_db_prod')
        self.assertEqual(args.admin_user, 'argos_user')
        self.assertFalse(args.apply)
        self.assertNotIn('ARG_ACCOUNT_USER', c.POLICIES)
        self.assertNotIn('ARG_AUDIT_RUN', c.POLICIES)
        self.assertNotIn('ARG_AUDIT_REPORT', c.POLICIES)
        self.assertNotIn('ARG_USAGE_RUN', c.POLICIES)
        self.assertNotIn('flyway_schema_history', c.POLICIES)

    def test_online_api_refuses_application_before_client_or_backup(self):
        args = c.arguments(['--apply'])
        with patch.object(c.op, 'topology', return_value=('mask', '172.24.0.2')), patch.object(c.op, 'docker_json', return_value={'State': {'Running': True}}), patch.object(c.op, 'Client') as client, patch.object(c, 'backup') as backup, self.assertRaises(c.op.Refused):
            c.maintenance(args, 'synthetic')
        client.assert_not_called()
        backup.assert_not_called()

    def test_invalid_database_rejected(self):
        for value in ['db`', 'db;DELETE', 'db/path', '%']:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit): c.arguments(['--database', value])


@unittest.skipUnless(os.environ.get('ARGOS_PROVISION_TEST_CONTAINER', '').startswith('argos-provision-test-'), 'Requires explicitly named disposable MariaDB fixture')
class MariaDBTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = os.environ['ARGOS_PROVISION_TEST_CONTAINER']
        cls.network = os.environ['ARGOS_PROVISION_TEST_NETWORK']
        cls.password = os.environ['ARGOS_PROVISION_TEST_ROOT_PASSWORD']
        cls.subnet = c.op.docker_json('network', cls.network)['IPAM']['Config'][0]['Subnet']
        cls.root = c.op.Client(cls.container, 'root', cls.password)
        cls.root.query("SET SESSION time_zone='+00:00'")

    @classmethod
    def tearDownClass(cls): cls.root.close()

    def setUp(self):
        self.database = 'cleanup' + uuid.uuid4().hex[:12]
        self.root.query('CREATE DATABASE `' + self.database + '`')
        self.root.query('USE `' + self.database + '`')
        self.root.query('CREATE TABLE flyway_schema_history (installed_rank INT PRIMARY KEY, success BOOL, checksum INT) ENGINE=InnoDB')
        self.root.query('INSERT INTO flyway_schema_history VALUES (1,1,123456)')
        self.preserved = ['ARG_ACCOUNT_USER', 'ARG_ACCOUNT_IDENTITY', 'ARG_ACCOUNT_SITE', 'ARG_AUDIT', 'ARG_AUDIT_RUN', 'ARG_AUDIT_REPORT', 'ARG_USAGE_RUN', 'ARG_DOMAIN_BATCH', 'ARG_NEWSLETTER', 'ARG_FEEDBACK', 'ARG_DISCOVERY_GATE', 'ARG_AUDIT_ADMISSION']
        for table in self.preserved:
            self.root.query('CREATE TABLE `' + table + '` (id INT PRIMARY KEY, value VARCHAR(100)) ENGINE=InnoDB')
            self.root.query("INSERT INTO `" + table + "` VALUES (1,'preserved-synthetic-data')")
        for table, (column, days) in c.POLICIES.items():
            self.root.query('CREATE TABLE `' + table + '` (id INT PRIMARY KEY, `' + column + '` DATETIME(3)) ENGINE=InnoDB')
            self.root.query('INSERT INTO `' + table + '` VALUES (1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL ' + str(days + 1) + ' DAY)),(2,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))')
        self.root.query('INSERT INTO ARG_ACCOUNT_TOKEN VALUES (3,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 HOUR))')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.args = c.arguments(['--container', self.container, '--network', self.network, '--subnet', self.subnet, '--database', self.database, '--admin-user', 'root', '--backup-dir', self.temp.name])

    def run_cleanup(self, apply=False):
        self.args.apply = apply
        with patch.object(c, 'stopped'), contextlib.redirect_stdout(io.StringIO()) as output:
            dump = c.maintenance(self.args, self.password)
        self.assertNotIn(self.password, output.getvalue())
        return dump, output.getvalue()

    def test_dry_run_keeps_all_data_and_does_not_create_backup(self):
        _, output = self.run_cleanup()
        self.assertIn('DRY_RUN OK', output)
        self.assertEqual(list(Path(self.temp.name).iterdir()), [])
        self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM ARG_ACCOUNT_TOKEN'), '3')
        self.assertEqual(c.op.scalar(self.root, 'SELECT checksum FROM flyway_schema_history'), '123456')

    def test_application_private_backup_restore_and_active_data_preservation(self):
        dump, output = self.run_cleanup(True)
        self.assertIn('APPLIED OK', output)
        self.assertEqual(stat.S_IMODE(dump.stat().st_mode), 0o600)
        for table in self.preserved:
            self.assertEqual(c.op.scalar(self.root, 'SELECT value FROM `' + table + '`'), 'preserved-synthetic-data')
        self.assertEqual(c.op.scalar(self.root, 'SELECT checksum FROM flyway_schema_history'), '123456')
        for table in c.POLICIES:
            self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM `' + table + '` WHERE id=1'), '0')
            self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM `' + table + '` WHERE id=2'), '1')
        self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM ARG_ACCOUNT_TOKEN WHERE id=3'), '1')
        # Restore only into a fresh, explicitly named CI fixture schema.
        restored = 'restore' + uuid.uuid4().hex[:12]
        source = dump.read_text(encoding='utf-8').replace('`' + self.database + '`', '`' + restored + '`')
        self.root.query(source)
        self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM `' + restored + '`.ARG_ACCOUNT_TOKEN'), '3')
        self.assertEqual(c.op.scalar(self.root, 'SELECT value FROM `' + restored + '`.ARG_AUDIT_REPORT'), 'preserved-synthetic-data')

    def test_backup_failure_prevents_any_delete(self):
        self.args.apply = True
        with patch.object(c, 'stopped'), patch.object(c, 'backup', side_effect=c.op.Refused('synthetic-backup-error')), contextlib.redirect_stdout(io.StringIO()), self.assertRaises(c.op.Refused):
            c.maintenance(self.args, self.password)
        self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM ARG_ACCOUNT_TOKEN'), '3')

    def test_failure_during_deletes_rolls_back_every_deleted_row(self):
        base = c.op.Client
        class FailAfterFirstDelete(base):
            def query(self, sql):
                if sql.startswith('DELETE FROM `ARG_ACCOUNT_OAUTH`'): raise c.op.Refused('synthetic-delete-error')
                return super().query(sql)
        self.args.apply = True
        with patch.object(c, 'stopped'), patch.object(c.op, 'Client', FailAfterFirstDelete), contextlib.redirect_stdout(io.StringIO()), self.assertRaises(c.op.Refused):
            c.maintenance(self.args, self.password)
        self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM ARG_ACCOUNT_TOKEN'), '3')
        self.assertEqual(c.op.scalar(self.root, 'SELECT COUNT(*) FROM ARG_ACCOUNT_OAUTH'), '2')

    def test_unknown_foreign_reference_and_trigger_refused(self):
        self.root.query('CREATE TABLE customreference (id INT PRIMARY KEY, token_id INT, FOREIGN KEY(token_id) REFERENCES ARG_ACCOUNT_TOKEN(id)) ENGINE=InnoDB')
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(c.op.Refused, 'Référence entrante'): self.run_cleanup()

    def test_failed_flyway_migration_refused_without_repair(self):
        self.root.query('UPDATE flyway_schema_history SET success=0')
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(c.op.Refused, 'Migration Flyway'): self.run_cleanup()
        self.assertEqual(c.op.scalar(self.root, 'SELECT success FROM flyway_schema_history'), '0')

if __name__ == '__main__': unittest.main()
