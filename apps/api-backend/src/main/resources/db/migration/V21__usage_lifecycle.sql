-- F05: durable cancellation intent and known release dates, preserving the single ledger.
ALTER TABLE ARG_AUDIT_RUN ADD cancel_requested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ARG_USAGE_RUN ADD released_at DATETIME(3) NULL;
UPDATE ARG_USAGE_RUN u JOIN ARG_AUDIT_RUN r ON r.id=u.id
SET u.released_at=r.finished_at WHERE u.state='RELEASED';
CREATE INDEX idx_usage_owner_period_time ON ARG_USAGE_RUN(user_id,period,created_at,id);
