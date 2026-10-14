-- Read only. Run using the existing operator connection, not a test harness.
-- No account emails, credentials, tokens or report payloads are selected.
SELECT VERSION() AS mariadb_version, DATABASE() AS selected_database;
SELECT SCHEMA_NAME AS candidate_database
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'argosclarteprod';
-- If the candidate exists, stop before provisioning and inspect its ownership.
SELECT TABLE_NAME, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'argosclarteprod'
ORDER BY TABLE_NAME;
-- Existing account names/hosts only; requires operator access to mysql.user.
-- No authentication strings are queried.
SELECT User, Host FROM mysql.user WHERE User = 'argosclarte';
