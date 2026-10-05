package com.dokor.argos.services.domain.audit;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.QAuditRun;
import com.dokor.argos.services.domain.audit.model.ModuleStatus;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.mariadb.jdbc.MariaDbDataSource;
import org.junit.jupiter.api.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Actual DAO/QueryDSL SQL against an isolated MariaDB, not an H2 simulation. */
class AuditRunProgressIT {
    private static MariaDbDataSource source;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private TransactionManagerQuerydsl transactions;
    private AuditRunService service;

    @BeforeAll static void createIsolatedFixture() throws Exception {
        String url = System.getenv("ARGOS_TEST_MARIADB_URL");
        assertNotNull(url, "mariadb-integration requires ARGOS_TEST_MARIADB_URL");
        assertTrue(url.matches("jdbc:mariadb://(?:127\\.0\\.0\\.1|localhost):[0-9]+/argos_progress_test"),
            "Integration tests may only use the isolated local argos_progress_test database");
        source = new MariaDbDataSource(url);
        source.setUser(System.getenv("ARGOS_TEST_MARIADB_USER"));
        source.setPassword(System.getenv("ARGOS_TEST_MARIADB_PASSWORD"));
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS ARG_AUDIT_RUN (id BIGINT PRIMARY KEY, status VARCHAR(32), module_statuses LONGTEXT, result_json LONGTEXT) ENGINE=InnoDB");
        }
    }
    @BeforeEach void initialRun() throws Exception {
        transactions = spy(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
        service = new AuditRunService(new AuditRunDao(transactions), mock(TokenService.class), MAPPER);
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("DELETE FROM ARG_AUDIT_RUN");
        }
        try (var connection = source.getConnection(); var statement = connection.prepareStatement(
            "INSERT INTO ARG_AUDIT_RUN (id,status,module_statuses,result_json) VALUES (1,'RUNNING',?,'synthetic-private-result')")) {
            statement.setString(1, MAPPER.writeValueAsString(AuditRunService.INITIAL_MODULE_STATUSES)); statement.executeUpdate();
        }
    }
    private com.fasterxml.jackson.databind.JsonNode statuses() throws Exception {
        try (var connection = source.getConnection(); var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT module_statuses,result_json FROM ARG_AUDIT_RUN WHERE id=1")) {
            assertTrue(result.next()); assertEquals("synthetic-private-result", result.getString(2));
            return MAPPER.readTree(result.getString(1));
        }
    }
    private String status(String id) throws Exception {
        for (var module : statuses()) if (id.equals(module.path("id").asText())) return module.path("status").asText();
        throw new AssertionError("Module missing: " + id);
    }
    private void execute(String sql) throws Exception {
        try (var connection = source.getConnection(); var statement = connection.createStatement()) { statement.execute(sql); }
    }
    private void concurrent(Runnable first, Runnable second) throws Exception {
        try (var threads = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Future<?> a = threads.submit(() -> { assertTrue(await(start)); first.run(); });
            Future<?> b = threads.submit(() -> { assertTrue(await(start)); second.run(); });
            start.countDown(); a.get(5, TimeUnit.SECONDS); b.get(5, TimeUnit.SECONDS);
        }
    }
    private boolean await(CountDownLatch latch) {
        try { return latch.await(2, TimeUnit.SECONDS); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
    }
    @Test void concurrentDifferentModulesPreserveBothTransitionsAndAllLabels() throws Exception {
        for (int i = 0; i < 20; i++) {
            service.resetModuleStatuses(1);
            concurrent(() -> service.updateModuleStatus(1, "ssl", "RUNNING"),
                () -> service.updateModuleStatus(1, "observatory", "COMPLETED"));
            assertEquals("RUNNING", status("ssl")); assertEquals("COMPLETED", status("observatory"));
            assertEquals("PENDING", status("http")); assertEquals(8, statuses().size());
            assertEquals("HTTP & Sécurité", statuses().get(0).path("label").asText());
        }
    }
    @Test void duplicateAndLateTransitionsCannotRegressATerminalModule() throws Exception {
        service.updateModuleStatus(1, "ssl", "RUNNING");
        concurrent(() -> service.updateModuleStatus(1, "ssl", "COMPLETED"),
            () -> service.updateModuleStatus(1, "ssl", "RUNNING"));
        service.updateModuleStatus(1, "ssl", "FAILED");
        service.updateModuleStatus(1, "ssl", "COMPLETED");
        assertEquals("COMPLETED", status("ssl"));
    }
    @Test void retryResetsProgressAndInactiveRunsRejectLateWorkerUpdates() throws Exception {
        service.updateModuleStatus(1, "ssl", "COMPLETED");
        execute("UPDATE ARG_AUDIT_RUN SET status='QUEUED' WHERE id=1");
        service.resetModuleStatuses(1);
        service.updateModuleStatus(1, "ssl", "COMPLETED");
        assertEquals("PENDING", status("ssl"));
        execute("UPDATE ARG_AUDIT_RUN SET status='RUNNING' WHERE id=1");
        service.updateModuleStatus(1, "ssl", "RUNNING");
        assertEquals("RUNNING", status("ssl"));
    }
    @Test void corruptMissingAndEmptyJsonUseInitialStatusesWithoutChangingTheResultBlob() throws Exception {
        for (String json : Arrays.asList(null, "", "{invalid", "null", "{}", "[]")) {
            try (var connection = source.getConnection(); var statement = connection.prepareStatement(
                "UPDATE ARG_AUDIT_RUN SET module_statuses=? WHERE id=1")) {
                statement.setString(1, json); statement.executeUpdate();
            }
            service.updateModuleStatus(1, "ssl", "COMPLETED");
            assertEquals("COMPLETED", status("ssl")); assertEquals("PENDING", status("html"));
        }
    }
    @Test void moduleIsLocatedByIdInReorderedHistoricalArrays() throws Exception {
        var reordered = new ArrayList<>(AuditRunService.INITIAL_MODULE_STATUSES); Collections.reverse(reordered);
        try (var connection = source.getConnection(); var statement = connection.prepareStatement(
            "UPDATE ARG_AUDIT_RUN SET module_statuses=? WHERE id=1")) {
            statement.setString(1, MAPPER.writeValueAsString(reordered)); statement.executeUpdate();
        }
        service.updateModuleStatus(1, "ssl", "RUNNING");
        assertEquals("RUNNING", status("ssl")); assertEquals("PENDING", status("tech"));
        assertEquals("tech", statuses().get(0).path("id").asText());
    }
    @Test void failureCleanupOnlyChangesRunningModulesEvenAfterReaperMarksRunFailed() throws Exception {
        service.updateModuleStatus(1, "http", "COMPLETED"); service.updateModuleStatus(1, "ssl", "RUNNING");
        execute("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE id=1"); service.failRunningModules(1);
        assertEquals("COMPLETED", status("http")); assertEquals("FAILED", status("ssl"));
        assertEquals("PENDING", status("html"));
    }
    @Test void missingRunOrMissingTargetIdDoesNotEraseProgress() throws Exception {
        service.updateModuleStatus(999, "ssl", "RUNNING");
        execute("UPDATE ARG_AUDIT_RUN SET module_statuses='[{\"id\":\"http\",\"label\":\"HTTP\",\"status\":\"COMPLETED\"}]' WHERE id=1");
        service.updateModuleStatus(1, "ssl", "RUNNING");
        assertEquals(1, statuses().size()); assertEquals("COMPLETED", status("http"));
    }
    @Test void normalProgressUsesSixteenUpdatesAndNoSelectInsteadOfThirtyTwoStatements() throws Exception {
        long start = System.nanoTime();
        for (var module : AuditRunService.INITIAL_MODULE_STATUSES) {
            service.updateModuleStatus(1, module.id(), "RUNNING"); service.updateModuleStatus(1, module.id(), "COMPLETED");
        }
        long atomicMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
        verify(transactions, times(16)).update(QAuditRun.auditRun);
        verify(transactions, never()).selectQuery();
        service.resetModuleStatuses(1);
        start = System.nanoTime();
        for (var module : AuditRunService.INITIAL_MODULE_STATUSES) for (String state : List.of("RUNNING", "COMPLETED")) {
            var json = statuses(); // legacy SELECT, including the blob
            for (var entry : json) if (module.id().equals(entry.path("id").asText()))
                ((com.fasterxml.jackson.databind.node.ObjectNode) entry).put("status", state);
            try (var connection = source.getConnection(); var statement = connection.prepareStatement(
                "UPDATE ARG_AUDIT_RUN SET module_statuses=? WHERE id=1")) {
                statement.setString(1, MAPPER.writeValueAsString(json)); statement.executeUpdate();
            }
        }
        long legacyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
        System.out.printf("progress_fixture legacyStatements=32 atomicStatements=16 legacyMs=%d atomicMs=%d%n", legacyMs, atomicMs);
        assertEquals("COMPLETED", status("ssl"));
    }
}
