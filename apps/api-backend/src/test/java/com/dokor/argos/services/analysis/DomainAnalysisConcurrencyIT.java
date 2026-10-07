package com.dokor.argos.services.analysis;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.DomainAnalysisDao;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mariadb.jdbc.MariaDbDataSource;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Real InnoDB row-lock proof; run with the mariadb-integration profile. */
class DomainAnalysisConcurrencyIT {
    private static MariaDbDataSource source;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private DomainAnalysisDao dao;
    private final AuditContext context = new AuditContext("https://example.com/a", "https://example.com/a", 7L);
    private final AuditModuleResult fresh = new AuditModuleResult(AuditModule.TECH.id(), "Technology", "fresh", Map.of(), List.of());

    @BeforeAll
    static void connect() throws Exception {
        String url = System.getenv("ARGOS_TEST_DOMAIN_CACHE_URL");
        assertNotNull(url, "mariadb-integration requires ARGOS_TEST_DOMAIN_CACHE_URL");
        assertTrue(url.matches("jdbc:mariadb://(?:127\\.0\\.0\\.1|localhost):[0-9]+/argos_domain_cache_test"),
            "Integration tests may only use the isolated local argos_domain_cache_test database");
        source = new MariaDbDataSource(url);
        source.setUser(System.getenv("ARGOS_TEST_DOMAIN_CACHE_USER"));
        source.setPassword(System.getenv("ARGOS_TEST_DOMAIN_CACHE_PASSWORD"));
        Flyway flyway = Flyway.configure().dataSource(source).cleanDisabled(false).load();
        flyway.clean();
        flyway.migrate();
    }

    @BeforeEach
    void resetCache() throws Exception {
        dao = new DomainAnalysisDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
        sql("DELETE FROM ARG_DOMAIN_ANALYSIS");
        sql("DELETE FROM ARG_DOMAIN");
        sql("INSERT INTO ARG_DOMAIN(id, hostname) VALUES(7, 'example.com')");
        sql("INSERT INTO ARG_DOMAIN_ANALYSIS(domain_id,result_json,analyzed_at,expires_at) "
            + "VALUES(7,'{broken json',NOW(3),DATE_ADD(NOW(3),INTERVAL 1 HOUR))");
    }

    @Test
    void concurrentRepairsRunOnlyOnceAndLeaveOneValidRow() throws Exception {
        var calls = new AtomicInteger();
        TechModuleAnalyzer analyzer = mock(TechModuleAnalyzer.class);
        when(analyzer.analyze(any(), any())).thenAnswer(invocation -> {
            calls.incrementAndGet();
            Thread.sleep(200);
            return fresh;
        });
        // Separate service/DAO instances emulate workers sharing only MariaDB.
        var first = new DomainAnalysisService(dao, analyzer, mapper);
        var secondDao = new DomainAnalysisDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
        var second = new DomainAnalysisService(secondDao, analyzer, mapper);
        try (var threads = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var one = threads.submit(() -> { await(start); return first.getOrRunTechAnalysis(context, LoggerFactory.getLogger(getClass())); });
            var two = threads.submit(() -> { await(start); return second.getOrRunTechAnalysis(context, LoggerFactory.getLogger(getClass())); });
            start.countDown();
            assertEquals(fresh, one.get(10, TimeUnit.SECONDS));
            assertEquals(fresh, two.get(10, TimeUnit.SECONDS));
        }
        assertEquals(1, calls.get());
        assertEquals(1, rowCount());
    }

    @Test
    void failedRepairCommitsInvalidationAndNextAuditCanRetry() throws Exception {
        TechModuleAnalyzer failing = mock(TechModuleAnalyzer.class);
        when(failing.analyze(any(), any())).thenThrow(new IllegalStateException("tech failed"));
        assertThrows(IllegalStateException.class, () -> new DomainAnalysisService(dao, failing, mapper)
            .getOrRunTechAnalysis(context, LoggerFactory.getLogger(getClass())));
        assertEquals(0, rowCount());

        TechModuleAnalyzer recovered = mock(TechModuleAnalyzer.class);
        when(recovered.analyze(any(), any())).thenReturn(fresh);
        assertEquals(fresh, new DomainAnalysisService(dao, recovered, mapper)
            .getOrRunTechAnalysis(context, LoggerFactory.getLogger(getClass())));
        assertEquals(1, rowCount());
    }

    private static void await(CountDownLatch latch) {
        try { assertTrue(latch.await(5, TimeUnit.SECONDS)); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
    }

    private static void sql(String statement) throws Exception {
        try (Connection connection = source.getConnection(); var query = connection.createStatement()) {
            query.execute(statement);
        }
    }

    private static int rowCount() throws Exception {
        try (Connection connection = source.getConnection(); var query = connection.createStatement();
             var rows = query.executeQuery("SELECT COUNT(*) FROM ARG_DOMAIN_ANALYSIS WHERE domain_id=7")) {
            assertTrue(rows.next());
            return rows.getInt(1);
        }
    }
}
