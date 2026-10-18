-- Freeze policy at admission and allowlisted measurement evidence at publication.
-- Legacy admissions/reports remain unknown; never backfill from raw diagnostics.
ALTER TABLE ARG_CI_REQUEST ADD COLUMN verdict_policy_json TEXT NULL;
ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN ci_verdict_json TEXT NULL;
