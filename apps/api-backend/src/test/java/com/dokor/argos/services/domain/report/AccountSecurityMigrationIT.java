package com.dokor.argos.services.domain.report;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AccountSecurityMigrationIT extends MariaDbReportFixture {
    @Test
    void accountsMigrateExistingRunsWithoutAssigningTheirSharedUrlToANewUser() throws Exception {
        migrateHistoricalRowsTo("10");
        Flyway.configure().dataSource(source).target("12").load().migrate();
        sql("""
                INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at) VALUES
                (101,'migration-a@example.com','A','ACTIVE',NOW(3)),
                (102,'migration-b@example.com','B','ACTIVE',NOW(3))
                """);
        try (var c = source.getConnection(); var s = c.createStatement();
             var r = s.executeQuery("SELECT owner_user_id FROM ARG_AUDIT_RUN ORDER BY id")) {
            int rows = 0;
            while (r.next()) { assertNull(r.getObject(1)); rows++; }
            assertEquals(5, rows);
        }
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=101 WHERE id=1");
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=102 WHERE id=2");
        try (var c = source.getConnection(); var s = c.createStatement();
             var r = s.executeQuery("SELECT id,owner_user_id FROM ARG_AUDIT_RUN WHERE audit_id=1 ORDER BY id")) {
            assertTrue(r.next()); assertEquals(101, r.getLong(2));
            assertTrue(r.next()); assertEquals(102, r.getLong(2));
            while (r.next()) assertNull(r.getObject(2));
        }
        assertThrows(Exception.class,
                () -> sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=999999 WHERE id=3"));
        sql("""
                INSERT INTO ARG_ACCOUNT_IDENTITY(id,user_id,provider,subject,created_at)
                VALUES(201,101,'github','stable-subject',NOW(3))
                """);
        assertThrows(Exception.class, () -> sql("""
                INSERT INTO ARG_ACCOUNT_IDENTITY(id,user_id,provider,subject,created_at)
                VALUES(202,102,'github','stable-subject',NOW(3))
                """));
        sql("""
                INSERT INTO ARG_ACCOUNT_IDENTITY(id,user_id,provider,subject,created_at)
                VALUES(203,102,'google','stable-subject',NOW(3))
                """);
        assertIndex("ARG_AUDIT_RUN", "idx_run_owner_created", "owner_user_id", "created_at", "id");
        assertIndex("ARG_AUDIT_RUN", "idx_owner_audit_latest", "owner_user_id", "audit_id", "created_at", "id");
        assertIndex("ARG_ACCOUNT_SESSION", "idx_session_user", "user_id", "revoked_at");
        assertTrue(historicalStoredReport("synthetic-existing").isPresent());
        assertTrue(historicalStoredReport("synthetic-expired").isEmpty());
        // The session registry stores no bearer JWT, only its server identity and CSRF hash.
        try (var c = source.getConnection();
             var columns = c.getMetaData().getColumns(c.getCatalog(), null, "ARG_ACCOUNT_SESSION", null)) {
            var names = new ArrayList<String>();
            while (columns.next()) names.add(columns.getString("COLUMN_NAME"));
            assertEquals(List.of("id", "user_id", "csrf_hash", "created_at", "authenticated_at",
                    "last_activity_at", "expires_at", "revoked_at"), names);
        }
    }

    private void assertIndex(String table, String index, String... columns) throws Exception {
        try (var c = source.getConnection(); var s = c.prepareStatement("""
                SELECT COLUMN_NAME FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX
                """)) {
            s.setString(1, table);
            s.setString(2, index);
            var actual = new ArrayList<String>();
            try (var r = s.executeQuery()) { while (r.next()) actual.add(r.getString(1)); }
            assertEquals(List.of(columns), actual);
        }
    }
}
