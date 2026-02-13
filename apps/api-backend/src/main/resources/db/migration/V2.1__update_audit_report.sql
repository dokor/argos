ALTER TABLE ARG_AUDIT_REPORT
    ADD COLUMN public_token VARCHAR(64) NOT NULL,
  ADD UNIQUE KEY uq_report_public_token (public_token);
