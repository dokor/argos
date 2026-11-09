import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import xml.etree.ElementTree as ET


spec = importlib.util.spec_from_file_location("reports", Path(__file__).with_name("check-integration-reports.py"))
reports = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reports)


class IntegrationReportsTest(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.backend = Path(self.temp.name)
        self.database = [
            "com.dokor.argos.services.domain.report.UsageIT",
            "com.dokor.argos.services.domain.report.ReportGlobalScoreMigrationIT",
        ]
        for name in self.database + [reports.CONTROLLED_E2E]:
            self.source(name)

    def source(self, name):
        path = self.backend / "src/test/java" / (name.replace(".", "/") + ".java")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()

    def report(self, name, **counts):
        path = self.backend / "target/failsafe-reports" / f"TEST-{name}.xml"
        path.parent.mkdir(parents=True, exist_ok=True)
        attributes = {"tests": 1, "failures": 0, "errors": 0, "skipped": 0} | counts
        ET.ElementTree(ET.Element("testsuite", name=name, **{k: str(v) for k, v in attributes.items()})).write(path)

    def verify(self, job="mariadb"):
        return reports.verify_reports(self.backend, job)

    def test_database_and_browser_suites_have_separate_jobs(self):
        for name in self.database:
            self.report(name)
        self.assertEqual(set(self.verify()), set(self.database))
        with self.assertRaisesRegex(ValueError, "unexpected suites"):
            self.verify("controlled-e2e")

    def test_browser_job_requires_only_the_browser_suite(self):
        self.report(reports.CONTROLLED_E2E)
        self.assertEqual(self.verify("controlled-e2e"), {reports.CONTROLLED_E2E: 1})
        with self.assertRaisesRegex(ValueError, "unexpected suites"):
            self.verify()

    def test_historical_omission_and_new_unselected_suite_are_rejected(self):
        self.report(self.database[0])
        with self.assertRaisesRegex(ValueError, "ReportGlobalScoreMigrationIT"):
            self.verify()
        self.report(self.database[1])
        self.source("com.dokor.argos.NewFeatureIT")
        with self.assertRaisesRegex(ValueError, "NewFeatureIT"):
            self.verify()

    def test_browser_suite_cannot_also_run_in_database_job(self):
        for name in self.database + [reports.CONTROLLED_E2E]:
            self.report(name)
        with self.assertRaisesRegex(ValueError, "unexpected suites:.*ControlledAuditE2eIT"):
            self.verify()

    def test_empty_failed_and_skipped_suites_are_rejected(self):
        self.report(self.database[0])
        for counts in ({"tests": 0}, {"failures": 1}, {"errors": 1}, {"skipped": 1}):
            with self.subTest(counts=counts):
                self.report(self.database[1], **counts)
                with self.assertRaisesRegex(ValueError, "Suite did not fully pass"):
                    self.verify()

    def test_missing_reports_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "Missing suites"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
