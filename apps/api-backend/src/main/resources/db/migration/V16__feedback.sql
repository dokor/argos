CREATE TABLE ARG_FEEDBACK (
 id BIGINT NOT NULL PRIMARY KEY,
 type VARCHAR(16) NOT NULL,
 status VARCHAR(16) NOT NULL,
 description VARCHAR(4000) NOT NULL,
 page VARCHAR(16) NULL,
 expected VARCHAR(1000) NULL,
 observed VARCHAR(1000) NULL,
 steps VARCHAR(1000) NULL,
 run_id BIGINT NULL,
 finding_key VARCHAR(200) NULL,
 created_at TIMESTAMP(3) NOT NULL,
 updated_at TIMESTAMP(3) NOT NULL,
 INDEX feedback_filters(type,status,id),
 INDEX feedback_retention(created_at),
 CONSTRAINT feedback_type CHECK (type IN ('BUG','SUGGESTION','FALSE_POSITIVE')),
 CONSTRAINT feedback_status CHECK (status IN ('OPEN','PENDING','CONFIRMED','REJECTED','RESOLVED'))
);
-- References remain internal IDs: no bearer token, URL, cookie, IP or browser snapshot.
CREATE TABLE ARG_FEEDBACK_EVENT (
 id BIGINT NOT NULL PRIMARY KEY,
 feedback_id BIGINT NOT NULL,
 actor_id BIGINT NOT NULL,
 old_status VARCHAR(16) NOT NULL,
 new_status VARCHAR(16) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL,
 INDEX feedback_event_parent(feedback_id,id),
 CONSTRAINT feedback_event_parent FOREIGN KEY(feedback_id) REFERENCES ARG_FEEDBACK(id) ON DELETE CASCADE
);
