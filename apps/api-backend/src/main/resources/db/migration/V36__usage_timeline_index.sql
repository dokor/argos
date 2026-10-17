-- Owner/state/time range first; id is already part of every InnoDB secondary index.
CREATE INDEX idx_usage_owner_state_counted ON ARG_USAGE_RUN(user_id,state,counted_at);
