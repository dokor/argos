"""Collect controlled #467 proofs. Never authorizes launch or imports self-declared hosted passes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET


SUITES = {
    "closed-ci-defaults": ("surefire", "ci.CiPolicyTest"),
    "closed-billing-defaults": ("surefire", "billing.BillingSettingsTest"),
    **{name: ("failsafe", "domain.report." + suite) for name, suite in {
        "joined-journey": "PremiumCiJourneyIT", "billing": "BillingIT",
        "entitlements": "CiEntitlementIT", "targets": "CiTargetsIT", "keys": "CiKeysIT",
        "quotas": "CiQuotaIT", "admission-private-verdict": "CiAdmissionIT",
        "publication-atomicity": "AuditPublicationIT", "retention": "ReportRetentionIT",
    }.items()},
}
# No fixture or successful JUnit file can clear these. Record real acceptance in #467 first.
EXTERNAL_BLOCKERS = (
    "hosted-stripe-checkout-tax-billing", "hosted-github-actions-publication",
    "hosted-gitlab-ci-publication", "private-azure-journal-cas-restore",
    "controlled-domain-real-dns-tls", "target-host-egress-ipv4-ipv6-cleanup",
    "target-capacity-alerts-rollback", "production-proxy-apm-redaction",
    "approved-eur-prices-annual-discount-tax", "approved-billing-lifecycle-policy",
    "human-final-acceptance",
)
MAX_REPORT_BYTES = 10 * 1024 * 1024


def inspect_suite(root, kind, suffix):
    """Only known paths/attributes; never copy test output, properties, names or errors."""
    name = "com.dokor.argos.services." + suffix
    path = root / "apps/api-backend/target" / (kind + "-reports") / ("TEST-" + name + ".xml")
    try:
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError()
        with path.open("rb") as source:
            raw = source.read(MAX_REPORT_BYTES + 1)
        if len(raw) > MAX_REPORT_BYTES or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
            raise ValueError()
        # Maven reports are UTF-8. Reject other encodings (including XML entity evasions).
        text = raw.decode("utf-8")
        if "\x00" in text:
            raise ValueError()
        suite = ET.fromstring(text)
        count = lambda key: int(suite.attrib[key]) if re.fullmatch(r"[0-9]{1,7}", suite.attrib[key]) else -1
        cases = suite.findall("testcase")
        if (suite.tag != "testsuite" or suite.get("name") != name or count("tests") < 1
                or count("tests") != len(cases) or any(count(k) != 0 for k in ("errors", "failures", "skipped"))
                or any(case.find(k) is not None for case in cases for k in ("error", "failure", "skipped"))):
            raise ValueError()
        return {"status": "PASS", "tests": len(cases), "sha256": hashlib.sha256(raw).hexdigest()}
    except (OSError, ValueError, KeyError, ET.ParseError, UnicodeError):
        return {"status": "MISSING_OR_INVALID"}


def binding(root, env, preview):
    """Fresh CI checkout + current revision, never trust a SHA argument alone."""
    try:
        def git(*args):
            return subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True,
                                  text=True, timeout=10).stdout.strip()
        sha = git("rev-parse", "HEAD")
        clean = not git("status", "--porcelain", "--untracked-files=normal")
        bound = (not preview and clean and env.get("GITHUB_ACTIONS") == "true"
                 and re.fullmatch(r"[a-f0-9]{40}", sha) is not None and env.get("GITHUB_SHA") == sha
                 and re.fullmatch(r"[0-9]+", env.get("GITHUB_RUN_ID", "")) is not None
                 and re.fullmatch(r"[0-9]+", env.get("GITHUB_RUN_ATTEMPT", "")) is not None)
        return sha, bool(bound)
    except (OSError, subprocess.SubprocessError):
        return None, False


def collect(root, sha, bound):
    suites = {key: inspect_suite(root, *spec) for key, spec in SUITES.items()}
    failed = [key for key, result in suites.items() if result["status"] != "PASS"]
    return {
        "schemaVersion": 1, "candidateSha": sha, "revisionBound": bound,
        "controlledStatus": "PASS" if bound and not failed else "INCOMPLETE",
        "launchStatus": "NO_GO", "controlledSuites": suites,
        "blockers": (["unbound-checkout"] if not bound else [])
                    + ["controlled:" + key for key in failed] + list(EXTERNAL_BLOCKERS),
        "limits": "Synthetic Stripe, DNS and measurements in joined journey; hosted acceptance remains mandatory.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview", action="store_true", help="Unbound local diagnostic, always incomplete")
    parser.add_argument("--check-launch", action="store_true", help="Nonzero until actual acceptance; never changes flags")
    args = parser.parse_args()
    root = args.root.resolve()
    sha, bound = binding(root, os.environ, args.preview)
    report = collect(root, sha, bound)
    # Fixed-field output, even for malformed XML or a credential embedded in a test failure.
    try:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    except OSError:
        print("Acceptance report unavailable", file=sys.stderr)
        return 2
    print("Controlled acceptance: " + report["controlledStatus"] + "; launch: NO_GO")
    return 1 if args.check_launch or not args.preview and report["controlledStatus"] != "PASS" else 0


if __name__ == "__main__":
    sys.exit(main())
