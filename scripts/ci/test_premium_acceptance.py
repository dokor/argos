import json
from pathlib import Path
import tempfile
import contextlib
import io
import unittest
from unittest.mock import patch
import premium_acceptance as acceptance


class ControlledAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for kind, suffix in acceptance.SUITES.values():
            self.write(kind, suffix)

    def write(self, kind, suffix, *, tests="1", skipped="0", failures="0", content="<testcase/>"):
        name = "com.dokor.argos.services." + suffix
        path = self.root / "apps/api-backend/target" / (kind + "-reports") / ("TEST-" + name + ".xml")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'<testsuite name="{name}" tests="{tests}" errors="0" failures="{failures}" skipped="{skipped}">{content}</testsuite>', encoding="utf-8")
        return path

    def test_complete_controlled_tests_cannot_clear_hosted_or_commercial_gates(self):
        result = acceptance.collect(self.root, "a" * 40, True)
        self.assertEqual("PASS", result["controlledStatus"])
        self.assertEqual("NO_GO", result["launchStatus"])
        self.assertEqual(list(acceptance.EXTERNAL_BLOCKERS), result["blockers"])
        self.assertEqual(13, len(result["controlledSuites"]))

    def test_local_preview_is_never_revision_bound(self):
        result = acceptance.collect(self.root, "a" * 40, False)
        self.assertEqual("INCOMPLETE", result["controlledStatus"])
        self.assertIn("unbound-checkout", result["blockers"])

    def test_every_required_suite_including_separate_closed_defaults_is_mandatory(self):
        for key, (kind, suffix) in acceptance.SUITES.items():
            with self.subTest(suite=key):
                path = self.write(kind, suffix)
                path.unlink()
                result = acceptance.collect(self.root, "a" * 40, True)
                self.assertEqual("INCOMPLETE", result["controlledStatus"])
                self.assertIn("controlled:" + key, result["blockers"])
                self.write(kind, suffix)

    @patch("premium_acceptance.binding", return_value=("a" * 40, True))
    def test_cli_success_means_controlled_only_and_launch_check_exits_nonzero(self, _binding):
        output = self.root / "report.json"
        for flag, expected in (([], 0), (["--check-launch"], 1)):
            with patch("sys.argv", ["premium_acceptance.py", "--root", str(self.root), "--output", str(output), *flag]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(expected, acceptance.main())
            self.assertEqual("NO_GO", json.loads(output.read_text())["launchStatus"])

    @patch("premium_acceptance.binding", return_value=("a" * 40, False))
    def test_unbound_collection_fails_but_explicit_preview_can_write_a_diagnostic(self, _binding):
        for flag, expected in (([], 1), (["--preview"], 0), (["--preview", "--check-launch"], 1)):
            with patch("sys.argv", ["premium_acceptance.py", "--root", str(self.root), "--output", str(self.root / "report.json"), *flag]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(expected, acceptance.main())

    def test_unknown_flags_are_rejected(self):
        with patch("sys.argv", ["premium_acceptance.py", "--approve-hosted", "--output", "unused"]), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                acceptance.main()
        self.assertEqual(2, error.exception.code)

    def test_missing_skipped_failed_empty_malformed_and_inconsistent_reports_fail_closed(self):
        kind, suffix = acceptance.SUITES["joined-journey"]
        for values in ({"skipped": "1"}, {"failures": "1"}, {"tests": "0", "content": ""},
                       {"tests": "2"}, {"tests": "-1"}, {"content": "<testcase><skipped/></testcase>"},
                       {"content": "<testcase><failure>private-fixture-467</failure></testcase>"}):
            with self.subTest(values=values):
                self.write(kind, suffix, **values)
                result = acceptance.collect(self.root, "a" * 40, True)
                self.assertEqual("INCOMPLETE", result["controlledStatus"])
                self.assertNotIn("private-fixture-467", json.dumps(result))
        path = self.write(kind, suffix)
        for raw in ("broken", '<!DOCTYPE testsuite [<!ENTITY x SYSTEM "file:///private">]><testsuite/>',
                    '<testsuite name="another-suite"/>', "\x00", "x" * (acceptance.MAX_REPORT_BYTES + 1)):
            path.write_text(raw, encoding="utf-8")
            self.assertEqual({"status": "MISSING_OR_INVALID"}, acceptance.inspect_suite(self.root, kind, suffix))
        path.unlink()
        self.assertEqual({"status": "MISSING_OR_INVALID"}, acceptance.inspect_suite(self.root, kind, suffix))

    @patch("premium_acceptance.subprocess.run")
    def test_revision_requires_ci_exact_sha_clean_checkout_and_run_reference(self, run):
        run.side_effect = lambda args, **kwargs: type("Result", (), {"stdout": "a" * 40 if args[-1] == "HEAD" else ""})()
        env = {"GITHUB_ACTIONS": "true", "GITHUB_SHA": "a" * 40, "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1"}
        self.assertTrue(acceptance.binding(self.root, env, False)[1])
        self.assertFalse(acceptance.binding(self.root, env, True)[1])
        for key in env:
            self.assertFalse(acceptance.binding(self.root, {**env, key: "invalid"}, False)[1])
        run.side_effect = lambda args, **kwargs: type("Result", (), {"stdout": "a" * 40 if args[-1] == "HEAD" else " M tracked-file"})()
        self.assertFalse(acceptance.binding(self.root, env, False)[1])


if __name__ == "__main__":
    unittest.main()
