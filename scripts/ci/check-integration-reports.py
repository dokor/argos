"""Require successful Failsafe execution of every IT assigned to a CI job."""

import argparse
from pathlib import Path
import xml.etree.ElementTree as ET


BACKEND = Path(__file__).resolve().parents[2] / "apps/api-backend"
CONTROLLED_E2E = "com.dokor.argos.services.domain.report.ControlledAuditE2eIT"


def verify_reports(backend, job):
    sources = backend / "src/test/java"
    suites = {
        ".".join(path.relative_to(sources).with_suffix("").parts)
        for path in sources.rglob("*IT.java")
    }
    if CONTROLLED_E2E not in suites:
        raise ValueError("ControlledAuditE2eIT is missing from the source inventory")
    expected = suites - {CONTROLLED_E2E} if job == "mariadb" else {CONTROLLED_E2E}
    if not expected:
        raise ValueError("No integration suites found")

    executed = {}
    for path in sorted((backend / "target/failsafe-reports").glob("TEST-*.xml")):
        suite = ET.parse(path).getroot()
        name = suite.attrib["name"]
        if name in executed:
            raise ValueError(f"Duplicate Failsafe suite: {name}")
        counts = {key: int(suite.attrib[key]) for key in ("tests", "failures", "errors", "skipped")}
        if counts["tests"] <= 0 or any(counts[key] for key in ("failures", "errors", "skipped")):
            raise ValueError(f"Suite did not fully pass: {name}: {counts}")
        executed[name] = counts["tests"]

    missing = expected - executed.keys()
    unexpected = executed.keys() - expected
    if missing or unexpected:
        raise ValueError(f"Missing suites: {sorted(missing)}; unexpected suites: {sorted(unexpected)}")
    return executed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", choices=("mariadb", "controlled-e2e"))
    args = parser.parse_args()
    try:
        results = verify_reports(BACKEND, args.job)
    except (ValueError, KeyError, OSError, ET.ParseError) as error:
        parser.exit(1, f"Integration execution check failed: {error}\n")
    for name, count in sorted(results.items()):
        print(f"PASS {name}: {count} tests")
    print(f"{args.job}: {len(results)} suites, {sum(results.values())} tests, no skips")
