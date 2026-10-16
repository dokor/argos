package com.dokor.argos.services.domain.report;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

/** Destructive scenarios run only in the localhost argos_credentials_test guarded fixture. */
class ClarteFreshStartMigrationIT extends MariaDbReportFixture {
    @Override @BeforeEach void migrateHistoricalRows() throws Exception {
        migrateHistoricalRowsTo("26");
    }

    @Test void populatedSchemaResetsEveryFamilyAndPreservesHistoryAndConstraints() throws Exception {
        seedEveryFamily();
        var before = counts();
        assertEquals(29, before.size(), "Review reset coverage whenever the schema gains a table");
        before.forEach((table, count) -> assertTrue(count > 0, "Unseeded family: " + table));
        var history = history();
        var schema = schema();
        assertEquals(1, resetVersion().migrate().migrationsExecuted);
        assertReset();
        assertEquals(history, history());
        assertEquals(schema, schema(), "Columns, indexes and constraints remain in place");
        assertEquals(1, number("SELECT COUNT(*) FROM flyway_schema_history WHERE version='27' AND success=1 AND checksum IS NOT NULL"));
        assertTrue(historicalStoredReport("synthetic-existing").isEmpty());
        assertFalse(historicalRunTokenPresent("synthetic-pending"));
        assertThrows(SQLException.class, () -> sql("INSERT INTO ARG_ACCOUNT_SITE(id,owner_user_id,domain_id,created_at) VALUES(1,10,1,NOW(3))"));
    }

    @Test void restartKeepsNewAccountsAuditsAndQueueState() throws Exception {
        resetVersion().migrate();
        // Current DAOs read the current schema; V27-only assertions use SQL projections.
        Flyway.configure().dataSource(source).load().migrate();
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at) VALUES(20,'new@example.com','New','ACTIVE',NOW(3))");
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(20,'new.example.com')");
        sql("INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id) VALUES(20,'https://new.example.com','https://new.example.com',20)");
        var run = runs.createQueuedRun(20, Instant.now());
        var before = counts();
        assertEquals(0, resetVersion().migrate().migrationsExecuted);
        assertEquals(0, resetVersion().migrate().migrationsExecuted);
        assertEquals(before, counts());
        assertTrue(runs.findByReportToken(run.reportToken()).isPresent());
        assertEquals(1, number("SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1"));
        sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE id=" + run.run().getId());
        assertEquals(0, number("SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1"));
    }

    @Test void emptyInstallationAndRestartHaveOnlyTechnicalSeeds() throws Exception {
        var flyway = Flyway.configure().dataSource(source).cleanDisabled(false).target("27").load();
        flyway.clean(); flyway.migrate();
        assertReset();
        assertEquals(0, resetVersion().migrate().migrationsExecuted);
        assertEquals("27", resetVersion().info().current().getVersion().toString());
    }

    @Test void preAccountSchemaUpgradesThroughHistoryThenResets() throws Exception {
        migrateHistoricalRowsTo("6");
        assertTrue(number("SELECT COUNT(*) FROM ARG_AUDIT_REPORT") > 0);
        resetVersion().migrate();
        assertReset();
        assertEquals("27", resetVersion().info().current().getVersion().toString());
    }

    @Test void lateSqlFailureRollsBackAllDeletesAndTechnicalCounters() throws Exception {
        seedEveryFamily();
        var before = counts();
        long pending = number("SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1");
        // Fails after deleting runs (including their admission-trigger updates).
        sql("CREATE TRIGGER fixture_reset_failure BEFORE DELETE ON ARG_DOMAIN FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic reset failure'");
        try {
            assertThrows(FlywayException.class, () -> resetVersion().migrate());
            assertEquals(before, counts());
            assertEquals(pending, number("SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1"));
            assertTrue(historicalStoredReport("synthetic-existing").isPresent());
            assertEquals(0, number("SELECT COUNT(*) FROM flyway_schema_history WHERE version='27' AND success=1"));
        } finally {
            sql("DROP TRIGGER fixture_reset_failure");
        }
        // Repair is confined to this disposable test after inspecting the injected failure.
        resetVersion().repair();
        resetVersion().migrate();
        assertReset();
    }

    @Test void nonTransactionalTableIsRefusedBeforeAnyDelete() throws Exception {
        seedEveryFamily();
        var before = counts();
        sql("ALTER TABLE ARG_NEWSLETTER_SUBSCRIBER ENGINE=MyISAM");
        try {
            assertThrows(FlywayException.class, () -> resetVersion().migrate());
            assertEquals(before, counts());
        } finally {
            sql("ALTER TABLE ARG_NEWSLETTER_SUBSCRIBER ENGINE=InnoDB");
        }
    }

    private Flyway resetVersion() { return Flyway.configure().dataSource(source).target("27").load(); }

    private void assertReset() throws Exception {
        var counts = counts();
        assertEquals(29, counts.size());
        counts.forEach((table, count) -> assertEquals(
                table.equals("ARG_AUDIT_ADMISSION") || table.equals("ARG_DISCOVERY_GATE") ? 1L : 0L,
                count.longValue(), table));
        assertEquals(0, number("SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1"));
        assertEquals(1, number("SELECT id FROM ARG_DISCOVERY_GATE"));
    }

    private Map<String, Long> counts() throws Exception {
        var result = new TreeMap<String, Long>();
        try (var c=source.getConnection(); var s=c.createStatement(); var rows=s.executeQuery(
                "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LEFT(TABLE_NAME,4)='ARG_'")) {
            while (rows.next()) {
                String table=rows.getString(1);
                result.put(table, number("SELECT COUNT(*) FROM `" + table.replace("`", "``") + "`"));
            }
        }
        return result;
    }

    private long number(String query) throws Exception {
        try (var c=source.getConnection(); var s=c.createStatement(); var r=s.executeQuery(query)) {
            assertTrue(r.next()); return r.getLong(1);
        }
    }

    private ArrayList<String> history() throws Exception {
        var result = new ArrayList<String>();
        try (var c=source.getConnection(); var s=c.createStatement(); var r=s.executeQuery(
                "SELECT version,script,checksum,success FROM flyway_schema_history WHERE version <> '27' ORDER BY installed_rank")) {
            while (r.next()) result.add(r.getString(1)+":"+r.getString(2)+":"+r.getString(3)+":"+r.getBoolean(4));
        }
        return result;
    }

    private Map<String, String> schema() throws Exception {
        var result = new TreeMap<String, String>();
        for (var table : counts().keySet()) {
            try (var c=source.getConnection(); var s=c.createStatement(); var r=s.executeQuery("SHOW CREATE TABLE `"+table+"`")) {
                assertTrue(r.next()); result.put(table,r.getString(2));
            }
        }
        return result;
    }

    private void seedEveryFamily() throws Exception {
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,role,created_at) VALUES(10,'old@example.com','Old admin','ACTIVE','ADMIN',NOW(3))");
        sql("INSERT INTO ARG_ACCOUNT_IDENTITY(id,user_id,provider,subject,created_at) VALUES(10,10,'LOCAL','old@example.com',NOW(3))");
        sql("INSERT INTO ARG_ACCOUNT_SESSION(id,user_id,csrf_hash,created_at,authenticated_at,last_activity_at,expires_at) VALUES(10,10,UNHEX(SHA2('csrf',256)),NOW(3),NOW(3),NOW(3),DATE_ADD(NOW(3),INTERVAL 1 DAY))");
        sql("INSERT INTO ARG_ACCOUNT_TOKEN(id,user_id,session_id,token_hash,purpose,expires_at) VALUES(10,10,10,UNHEX(SHA2('token',256)),'RESET',DATE_ADD(NOW(3),INTERVAL 1 DAY))");
        sql("INSERT INTO ARG_ACCOUNT_OAUTH(id,state_hash,browser_hash,provider,intent,user_id,session_id,nonce,verifier,return_path,expires_at) VALUES(10,UNHEX(SHA2('state',256)),UNHEX(SHA2('browser',256)),'github','LOGIN',10,10,'nonce','verifier','/account',DATE_ADD(NOW(3),INTERVAL 1 DAY))");
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=10 WHERE id IN(1,2)");
        sql("INSERT INTO ARG_ACCOUNT_RUN_CLAIM(id,run_id,proof_hash,expires_at,consumed_by) VALUES(10,1,UNHEX(SHA2('claim',256)),DATE_ADD(NOW(3),INTERVAL 1 DAY),10)");
        sql("INSERT INTO ARG_ACCOUNT_SITE(id,owner_user_id,domain_id,created_at) VALUES(10,10,1,NOW(3))");
        sql("INSERT INTO ARG_ACCOUNT_SITE_URL(id,site_id,audit_id,created_at) VALUES(10,10,1,NOW(3))");
        sql("INSERT INTO ARG_ACCOUNT_SECURITY_EVENT(id,user_id,session_id,action,outcome,created_at) VALUES(10,10,10,'login','accepted',NOW(3))");
        sql("INSERT INTO ARG_ACCOUNT_RATE(bucket_hash,attempts,expires_at) VALUES(UNHEX(SHA2('rate',256)),2,DATE_ADD(NOW(3),INTERVAL 1 DAY))");
        sql("INSERT INTO ARG_USAGE_ACCOUNT(id,monthly_limit) VALUES(10,1000)");
        sql("INSERT INTO ARG_USAGE_RUN(id,user_id,period,state,created_at) VALUES(1,10,'2026-10','COUNTED',NOW(3)),(2,10,'2026-10','RESERVED',NOW(3))");
        sql("INSERT INTO ARG_ADMIN_EVENT(id,actor_id,target_id,old_offer,new_offer,created_at) VALUES(10,10,10,'FREE','PREMIUM',NOW(3))");
        sql("INSERT INTO ARG_DOMAIN_DISCOVERY(id,owner_user_id,site_id,idempotency_key,request_fingerprint,status,parameters_json,effective_limits_json,created_at,expires_at) VALUES(10,10,10,'discovery',UNHEX(SHA2('discovery',256)),'RUNNING','{}','{}',NOW(3),DATE_ADD(NOW(3),INTERVAL 1 DAY))");
        sql("INSERT INTO ARG_DOMAIN_DISCOVERY_PAGE(id,discovery_id,owner_user_id,site_id,normalized_url,source,depth,eligible) VALUES(10,10,10,10,'https://example.com','INITIAL',0,TRUE)");
        sql("INSERT INTO ARG_DOMAIN_BATCH(id,owner_user_id,site_id,discovery_id,idempotency_key,request_fingerprint,profile_id,profile_snapshot_json,selected_count,status,created_at) VALUES(10,10,10,10,'batch',UNHEX(SHA2('batch',256)),'desktop','{}',1,'RUNNING',NOW(3))");
        sql("INSERT INTO ARG_DOMAIN_BATCH_PAGE(id,batch_id,owner_user_id,site_id,discovery_id,discovery_page_id,audit_id,run_id,created_at) VALUES(10,10,10,10,10,10,1,2,NOW(3))");
        sql("INSERT INTO ARG_DOMAIN_ANALYSIS(id,domain_id,result_json,analyzed_at,expires_at) VALUES(10,1,'{}',NOW(3),DATE_ADD(NOW(3),INTERVAL 1 DAY))");
        sql("INSERT INTO ARG_PRODUCT_AUDIT_ATTR(run_id,source_route,locale,placement,created_at) VALUES(1,'home','fr','hero',NOW(3))");
        sql("INSERT INTO ARG_PRODUCT_EVENT_COUNT(event_day,event_name,source_route,locale,placement,error_category) VALUES(CURRENT_DATE,'audit','home','fr','hero','none')");
        sql("INSERT INTO ARG_FEEDBACK(id,type,status,description,created_at,updated_at) VALUES(10,'BUG','OPEN','Synthetic fixture',NOW(3),NOW(3))");
        sql("INSERT INTO ARG_FEEDBACK_EVENT(id,feedback_id,actor_id,old_status,new_status,created_at) VALUES(10,10,10,'OPEN','PENDING',NOW(3))");
        sql("INSERT INTO ARG_NEWSLETTER_SUBSCRIBER(email) VALUES('old@example.com')");
    }
}
