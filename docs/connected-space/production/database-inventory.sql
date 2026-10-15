-- Read only: use the operator connection selecting the exact Argos database.
-- No account identities, credentials, tokens or report contents are selected.
SELECT VERSION() AS mariadb_version, DATABASE() AS selected_database;
SELECT TABLE_NAME, ENGINE, TABLE_ROWS AS approximate_rows,
       DATA_LENGTH + INDEX_LENGTH AS approximate_bytes
FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
SELECT version, description, checksum, success
FROM flyway_schema_history ORDER BY installed_rank;
-- Examine any custom SQL effects before a transactional reset.
SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, EVENT_MANIPULATION, ACTION_TIMING
FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();
SELECT EVENT_NAME, STATUS FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE();
SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = DATABASE();
-- A blank schema has no Flyway history yet; record that fact, do not baseline an unknown schema.
