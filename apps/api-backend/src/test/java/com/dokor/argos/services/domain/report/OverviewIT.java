package com.dokor.argos.services.domain.report;

import static org.junit.jupiter.api.Assertions.*;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.connected.summary.*;
import com.querydsl.sql.*;
import com.typesafe.config.ConfigFactory;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.*;
import java.time.*;
import java.util.*;

@EnabledIfEnvironmentVariable(named = "ARGOS_TEST_CREDENTIALS_URL", matches = ".+")
class OverviewIT extends MariaDbReportFixture {
    AccountDao accounts;
    AccountSessionService sessions;
    AccountOverviewService service;
    UsageService usage;
    Clock clock = Clock.fixed(Instant.parse("2026-10-13T10:00:00Z"), ZoneOffset.UTC);
    String a, b;

    @BeforeEach
    void setup() throws Exception {
        accounts =
                new AccountDao(
                        new TransactionManagerQuerydsl(
                                source, new Configuration(MySQLTemplates.DEFAULT)));
        var settings =
                new AccountSettings(
                        ConfigFactory.parseString(
                                "account.enabled=true\naccount.jwt-secret=\""
                                        + "s".repeat(64)
                                        + "\"\naccount.origin=\"http://localhost:3000\""));
        sessions =
                new AccountSessionService(
                        accounts,
                        new AccountSessionSigner(settings, mapper, clock),
                        tokens,
                        settings,
                        clock);
        usage =
                new UsageService(
                        accounts.transactions, new UsagePolicy(ConfigFactory.empty()), clock);
        service =
                new AccountOverviewService(
                        accounts, sessions, new AccountOverviewDao(), usage, clock);
        sql(
                "INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at)"
                    + " VALUES(10,'oa@example.com','A','ACTIVE','2026-10-01'),(20,'ob@example.com','B','ACTIVE','2026-10-01')");
        a =
                accounts.transaction(
                        c ->
                                "Bearer "
                                        + sessions.create(
                                                        accounts.user(10, c, false),
                                                        "c".repeat(43),
                                                        c)
                                                .jwt());
        b =
                accounts.transaction(
                        c ->
                                "Bearer "
                                        + sessions.create(
                                                        accounts.user(20, c, false),
                                                        "c".repeat(43),
                                                        c)
                                                .jwt());
        accounts.transaction(
                c -> {
                    usage.lock(10, c);
                    usage.setOverride(10, 100L, c);
                    return null;
                });
    }

    AccountOverviewDao.Filter filter(String attention, int limit, long offset) {
        return new AccountOverviewDao.Filter(attention, null, null, limit, offset);
    }

    void execute(String sql, Object... args) throws Exception {
        try (var c = source.getConnection();
                var q = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) q.setObject(i + 1, args[i]);
            q.executeUpdate();
        }
    }

    void seed() throws Exception {
        var fixture = SummaryFixture.fixture();
        long page = 100, site = 100;
        for (var domain : fixture.path("domains")) {
            execute(
                    "INSERT INTO ARG_DOMAIN(id,hostname) VALUES(?,?)",
                    site,
                    domain.path("hostname").asText());
            execute(
                    "INSERT INTO ARG_ACCOUNT_SITE(id,owner_user_id,domain_id,created_at)"
                            + " VALUES(?,10,?,'2026-10-01')",
                    site,
                    site);
            for (var spec : domain.path("pages")) {
                String url = spec.path("url").asText();
                execute(
                        "INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id)"
                                + " VALUES(?,?,?,?)",
                        page,
                        url,
                        url,
                        site);
                execute(
                        "INSERT INTO ARG_ACCOUNT_SITE_URL(id,site_id,audit_id,created_at)"
                                + " VALUES(?,?,?,'2026-10-01')",
                        page,
                        site,
                        page);
                run(page, page, 10, spec.path("executionStatus").asText(), "2026-10-12 10:00:00");
                if (spec.path("reportAvailable").asBoolean()) {
                    var e = SummaryFixture.evidence(fixture, spec);
                    var diag = DiagnosticProjection.from(e.report(), e.score());
                    report(
                            page,
                            page,
                            page,
                            diag,
                            spec.path("completeness").asText().equals("PARTIAL"));
                    execute(
                            "INSERT INTO"
                                + " ARG_USAGE_RUN(id,user_id,period,state,created_at,counted_at)"
                                + " VALUES(?,10,'2026-10','COUNTED','2026-10-12','2026-10-12')",
                            page);
                }
                page++;
            }
            site++;
        }
        for (long id = 1000; id < 1019; id++) {
            run(id, 100, 10, "COMPLETED", "2026-10-01 10:00:00");
            execute(
                    "INSERT INTO ARG_USAGE_RUN(id,user_id,period,state,created_at,counted_at)"
                            + " VALUES(?,10,'2026-10','COUNTED','2026-10-01','2026-10-01')",
                    id);
        }
    }

    void run(long id, long audit, long owner, String status, String time) throws Exception {
        execute(
                "INSERT INTO ARG_AUDIT_RUN(id,audit_id,owner_user_id,status,created_at,finished_at)"
                        + " VALUES(?,?,?,?,?,?)",
                id,
                audit,
                owner,
                status,
                time,
                Set.of("QUEUED", "RUNNING").contains(status) ? null : time);
    }

    void report(long id, long run, long audit, DiagnosticProjection diag, boolean partial)
            throws Exception {
        execute(
                "INSERT INTO"
                    + " ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json,created_at,global_score,provisional,diagnostic_json,critical_count,important_count,measurement_completeness)"
                    + " VALUES(?,?,?,?,'fixture.example','https://fixture.example','{}','2026-10-12"
                    + " 11:00:00',72,?,?,?,?,?)",
                id,
                audit,
                run,
                tokens.sha256("overview-fixture-" + id),
                partial,
                mapper.writeValueAsString(diag),
                diag.criticalCount(),
                diag.importantCount(),
                partial ? "PARTIAL" : "FULL");
    }

    @Test
    void collectionGapsBelongToTheExactLatestPrivateReport() throws Exception {
        seed();
        var gap = new DiagnosticProjection.Rule("ssl.grade", "a".repeat(64), "security", List.of("ssl"),
                "UNAVAILABLE", "TIMEOUT", null, null, null, null, false);
        var diagnostic = new DiagnosticProjection(2, true, 0L, 0L, .5, "fixture", List.of(gap));
        execute("UPDATE ARG_AUDIT_REPORT SET diagnostic_json=? WHERE run_id=100", mapper.writeValueAsString(diagnostic));
        execute("UPDATE ARG_AUDIT_RUN SET module_statuses=? WHERE id=100", "[{\"id\":\"ssl\",\"status\":\"FAILED\"}]");
        var page = service.pages(a, new AccountOverviewDao.Filter(null, null, null, 100, 0)).items().stream()
                .filter(p -> p.pageId().equals("100")).findFirst().orElseThrow();
        assertEquals("100", page.result().runId());
        assertEquals(ModuleStatus.FAILED, page.result().moduleStatuses().get("ssl"));
        assertEquals("TIMEOUT", page.result().collectionGaps().getFirst().reason());
        assertEquals(0, service.pages(b, filter(null, 100, 0)).total());
        run(9000, 100, 10, "FAILED", "2026-10-13 09:00:00");
        var newer = service.pages(a, new AccountOverviewDao.Filter(null, null, null, 100, 0)).items().stream()
                .filter(p -> p.pageId().equals("100")).findFirst().orElseThrow();
        assertEquals("9000", newer.result().runId());
        assertTrue(newer.result().collectionGaps().isEmpty());
    }

    @Test
    void canonicalCountersAndFilteredPaginationUseTheSamePrivateProjection() throws Exception {
        seed();
        var all = service.overview(a, filter(null, 2, 0));
        assertEquals(15, all.trackedUrls());
        assertEquals(9, all.priorityUrls());
        assertEquals(3, all.incompleteUrls());
        assertEquals(68, all.usage().available());
        assertEquals(15, all.pages().total());
        assertEquals(2, all.pages().items().size());
        for (String kind : List.of("priority", "incomplete")) {
            var first = service.overview(a, filter(kind, 1, 0));
            var next = service.overview(a, filter(kind, 1, 1));
            assertEquals(kind.equals("priority") ? 9 : 3, first.pages().total());
            assertEquals(first.priorityUrls(), next.priorityUrls());
            assertEquals(first.incompleteUrls(), next.incompleteUrls());
            assertNotEquals(
                    first.pages().items().getFirst().pageId(),
                    next.pages().items().getFirst().pageId());
            assertEquals(first.pages(), service.pages(a, filter(kind, 1, 0)));
        }
        var search =
                service.overview(a, new AccountOverviewDao.Filter(null, "NO-MATCH", null, 20, 0));
        assertEquals(15, search.trackedUrls());
        assertEquals(0, search.pages().total());
        assertEquals(0, service.overview(b, filter(null, 20, 0)).trackedUrls());
        var error =
                assertThrows(
                        AccountError.class,
                        () ->
                                service.pages(
                                        b, new AccountOverviewDao.Filter(null, null, 100L, 20, 0)));
        assertNotNull(error);
        assertFalse(mapper.writeValueAsString(all).contains("token"));
    }

    @Test
    void latestFailureNeverReusesAnOlderPriorityAndActiveAttemptsStaySeparate() throws Exception {
        seed();
        long id = 9_007_199_254_740_993L;
        run(id, 100, 10, "FAILED", "2026-10-13 09:00:00");
        var item =
                service
                        .pages(
                                a,
                                new AccountOverviewDao.Filter(
                                        null, "https://atelier-nova.fr/", 100L, 100, 0))
                        .items()
                        .stream()
                        .filter(p -> p.pageId().equals("100"))
                        .findFirst()
                        .orElseThrow();
        assertEquals(Long.toString(id), item.latestAttempt().runId());
        assertNull(item.result().score().value());
        assertNull(item.result().criticalCount());
        assertEquals("100", item.latestAvailableReport().runId());
        var failed = service.overview(a, filter(null, 20, 0));
        assertEquals(8, failed.priorityUrls());
        assertEquals(4, failed.incompleteUrls());
        run(id + 1, 100, 10, "RUNNING", "2026-10-13 09:00:00");
        var active = service.overview(a, filter("active", 20, 0));
        assertEquals(1, active.activeRuns());
        assertEquals(3, active.incompleteUrls());
        assertEquals(
                Long.toString(id + 1), active.pages().items().getFirst().latestAttempt().runId());
        // A newer run from a different owner of the same shared URL must never win.
        run(id + 2, 100, 20, "COMPLETED", "2026-10-13 09:30:00");
        assertEquals(
                Long.toString(id + 1),
                service.overview(a, filter("active", 20, 0))
                        .activeAttempts()
                        .getFirst()
                        .attempt()
                        .runId());
        // Refresh and pagination are read-only: no new runs or credits.
        assertEquals(68, service.overview(a, filter(null, 1, 50)).usage().available());
    }

    @Test
    void neverAnalysedExpiredUnknownAndCanceledAreNotHealthy() throws Exception {
        seed();
        sql("DELETE FROM ARG_USAGE_RUN WHERE id=114");
        sql("DELETE FROM ARG_AUDIT_RUN WHERE id=114");
        sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-01' WHERE run_id=100");
        sql(
                "UPDATE ARG_AUDIT_REPORT SET"
                        + " diagnostic_json=NULL,critical_count=NULL,important_count=NULL WHERE"
                        + " run_id=101");
        var all = service.overview(a, filter("incomplete", 100, 0));
        assertEquals(5, all.incompleteUrls());
        var never =
                all.pages().items().stream()
                        .filter(p -> p.pageId().equals("114"))
                        .findFirst()
                        .orElseThrow();
        assertNull(never.latestAttempt());
        assertNull(never.result());
        var expired =
                all.pages().items().stream()
                        .filter(p -> p.pageId().equals("100"))
                        .findFirst()
                        .orElseThrow();
        assertNull(expired.latestAvailableReport());
        assertFalse(expired.result().reportAvailable());
        run(2000, 102, 10, "CANCELED", "2026-10-13 09:00:00");
        assertEquals(6, service.overview(a, filter(null, 20, 0)).incompleteUrls());
    }

    @Test
    void queryCountDoesNotGrowWithPageSizeAndReadsNoReportBodies() throws Exception {
        seed();
        for (long id = 3000; id < 3200; id++) {
            execute(
                    "INSERT INTO ARG_AUDIT(id,input_url,normalized_url,domain_id)"
                        + " VALUES(?,?,?,100)",
                    id,
                    "https://atelier-nova.fr/extra-" + id,
                    "https://atelier-nova.fr/extra-" + id);
            execute(
                    "INSERT INTO ARG_ACCOUNT_SITE_URL(id,site_id,audit_id,created_at)"
                        + " VALUES(?,100,?,'2026-10-01')",
                    id,
                    id);
        }
        var sqls = new ArrayList<String>();
        try (var raw = source.getConnection()) {
            var connection =
                    (Connection)
                            java.lang.reflect.Proxy.newProxyInstance(
                                    getClass().getClassLoader(),
                                    new Class<?>[] {Connection.class},
                                    (proxy, method, args) -> {
                                        if (method.getName().equals("prepareStatement"))
                                            sqls.add((String) args[0]);
                                        try {
                                            return method.invoke(raw, args);
                                        } catch (java.lang.reflect.InvocationTargetException e) {
                                            throw e.getCause();
                                        }
                                    });
            var dao = new AccountOverviewDao();
            dao.pages(10, clock.instant(), filter(null, 1, 0), connection);
            int count = sqls.size();
            sqls.clear();
            var large = dao.pages(10, clock.instant(), filter(null, 100, 0), connection);
            assertEquals(215, large.total());
            assertEquals(100, large.items().size());
            assertEquals(count, sqls.size());
            assertEquals(3, count);
            assertTrue(
                    sqls.stream()
                            .noneMatch(
                                    q -> q.contains("report_json") || q.contains("result_json")));
        }
    }

    @Test
    void completenessMigrationUsesTheEngineRuleAndCanResume() throws Exception {
        seed();
        var fixture = SummaryFixture.fixture();
        var spec = fixture.path("domains").get(0).path("pages").get(0);
        var evidence = SummaryFixture.evidence(fixture, spec);
        execute(
                "UPDATE ARG_AUDIT_REPORT SET report_json=?,measurement_completeness=NULL WHERE"
                        + " id=100",
                mapper.writeValueAsString(evidence.report()));
        sql("UPDATE ARG_AUDIT_REPORT SET measurement_completeness=NULL WHERE id=101");
        try (var c = source.getConnection()) {
            var context = org.mockito.Mockito.mock(org.flywaydb.core.api.migration.Context.class);
            org.mockito.Mockito.when(context.getConnection()).thenReturn(c);
            var migration = new db.migration.V25__report_completeness();
            migration.migrate(context);
            migration.migrate(context);
            try (var q = c.createStatement();
                    var r =
                            q.executeQuery(
                                    "SELECT measurement_completeness FROM ARG_AUDIT_REPORT WHERE id"
                                            + " IN (100,101) ORDER BY id")) {
                assertTrue(r.next());
                assertEquals("FULL", r.getString(1));
                assertTrue(r.next());
                assertEquals("UNKNOWN", r.getString(1));
            }
        }
    }
}
