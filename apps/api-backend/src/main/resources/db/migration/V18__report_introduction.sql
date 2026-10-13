-- Published human context is separate from the immutable automatic report_json.
ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN introduction_json LONGTEXT NULL;
