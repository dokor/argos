package com.dokor.argos.services.domain.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.scoring.DefaultScorePolicy;
import com.dokor.argos.services.connected.ConnectedProfiles;
import com.dokor.argos.services.connected.batch.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.connected.discovery.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.webservices.api.account.*;
import com.typesafe.config.ConfigFactory;

import jakarta.ws.rs.WebApplicationException;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

@EnabledIfEnvironmentVariable(named = "ARGOS_TEST_CREDENTIALS_URL", matches = ".+")
class BatchIT extends MariaDbReportFixture {
    AccountDao accounts;
    AccountSessionService sessions;
    DiscoveryDao dao;
    DiscoveryService service;
    DiscoveryPolicy policy;
    DiscoveryTransport transport;
    AccountLifecycleIT.MutableClock clock;
    String a, b;
    static final String CSRF = "c".repeat(43);

    @BeforeEach
    void setup() throws Exception {
        clock = new AccountLifecycleIT.MutableClock();
        accounts =
                new AccountDao(
                        new TransactionManagerQuerydsl(
                                source,
                                new com.querydsl.sql.Configuration(
                                        com.querydsl.sql.MySQLTemplates.DEFAULT)));
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
        dao = new DiscoveryDao(accounts.transactions);
        sql(
                "INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at)"
                    + " VALUES(10,'d-a@example.com','A','ACTIVE','2026-10-01'),(20,'d-b@example.com','B','ACTIVE','2026-10-01')");
        a =
                accounts.transaction(
                        c ->
                                "Bearer "
                                        + sessions.create(accounts.user(10, c, false), CSRF, c)
                                                .jwt());
        b =
                accounts.transaction(
                        c ->
                                "Bearer "
                                        + sessions.create(accounts.user(20, c, false), CSRF, c)
                                                .jwt());
        configure("");
    }

    void configure(String config) {
        policy = new DiscoveryPolicy(ConfigFactory.parseString(config));
        transport = mock(DiscoveryTransport.class);
        when(transport.get(anyString(), anyInt(), any()))
                .thenAnswer(
                        call ->
                                new DiscoveryTransport.Response(
                                        call.<String>getArgument(0).endsWith("robots.txt")
                                                        || call.<String>getArgument(0)
                                                                .endsWith("sitemap.xml")
                                                ? 404
                                                : 200,
                                        "text/html",
                                        null,
                                        "<a href='/child'>child</a>"));
        service =
                new DiscoveryService(
                        accounts,
                        sessions,
                        dao,
                        new DomainService(new DomainDao(accounts.transactions)),
                        policy,
                        transport,
                        mapper,
                        tokens,
                        clock);
    }

    CreateDiscovery input() {
        return new CreateDiscovery("example.com", 50L, 3L, List.of());
    }

    Discovery create(String auth) {
        return service.create(auth, CSRF, UUID.randomUUID().toString(), input());
    }

    long count(String table) throws Exception {
        try (var c = source.getConnection();
                var s = c.createStatement();
                var r = s.executeQuery("SELECT COUNT(*) FROM " + table)) {
            r.next();
            return r.getLong(1);
        }
    }

    BatchService batches;
    BatchDao batchDao;
    AuditRunDao runDao;
    UsageService usage;

    void engine(String config) {
        usage =
                new UsageService(
                        accounts.transactions,
                        new UsagePolicy(ConfigFactory.parseString(config)),
                        clock);
        engine(new AuditRunDao(accounts.transactions, usage));
    }

    void engine(AuditRunDao dao) {
        runDao = dao;
        runs = new AuditRunService(dao, tokens, mapper);
        batchDao = new BatchDao(accounts.transactions, tokens);
        var audits = new AuditDao(accounts.transactions);
        var sites =
                new AccountSitesService(
                        accounts,
                        sessions,
                        new UrlNormalizer(),
                        new DomainService(new DomainDao(accounts.transactions)),
                        audits,
                        clock);
        batches =
                new BatchService(
                        accounts,
                        sessions,
                        batchDao,
                        this.dao,
                        transport,
                        audits,
                        runs,
                        dao,
                        sites,
                        new ConnectedProfiles(new DefaultScorePolicy()),
                        mapper,
                        tokens,
                        clock);
    }

    CreateBatch selection(String auth) {
        var discovery = create(auth);
        var worker =
                new DiscoveryWorker(
                        dao, policy, new DomainCrawler(policy, transport), service, clock);
        assertTrue(worker.processNext());
        var ids =
                service
                        .pages(auth, Long.parseLong(discovery.id()), 100, 0, "eligible")
                        .items()
                        .stream()
                        .map(DiscoveredPage::pageId)
                        .toList();
        assertEquals(2, ids.size());
        return new CreateBatch(discovery.id(), ids, ConnectedProfiles.DEFAULT_ID);
    }

    AdmittedBatch launch(CreateBatch in) {
        return batches.create(a, CSRF, UUID.randomUUID().toString(), in);
    }

    long site(AdmittedBatch b) {
        return Long.parseLong(b.domainId());
    }

    long id(AdmittedBatch b) {
        return Long.parseLong(b.id());
    }

    BatchProgress progress(AdmittedBatch b) {
        return batches.get(a, site(b), id(b));
    }

    List<BatchProgressPage> pages(AdmittedBatch b) {
        return batches.pages(a, site(b), id(b), 100, 0, "all").items();
    }

    void error(int status, org.junit.jupiter.api.function.Executable call) {
        assertEquals(
                status,
                assertThrows(WebApplicationException.class, call).getResponse().getStatus());
    }

    ReportPublishService publisher(AuditRunDao d) throws Exception {
        var composer = mock(PublicReportComposer.class);
        var summary = mock(AiReportSummaryService.class);
        when(composer.compose(any()))
                .thenReturn(
                        mapper.readValue(
                                "{\"domain\":\"example.com\",\"scores\":{\"completeness\":100,\"coverage\":{\"global\":{\"expectedWeight\":1,\"ratio\":1,\"available\":true},\"checks\":[{\"weight\":1,\"state\":\"MEASURED\"}]}}}",
                                ReportDto.class));
        when(summary.enrich(any())).thenAnswer(call -> call.getArgument(0));
        return new ReportPublishService(
                accounts.transactions,
                d,
                reports,
                composer,
                summary,
                mock(AhrefsDomainRatingClient.class),
                mapper);
    }

    void publish(long run, String claim) throws Exception {
        var row = runs.getRun(run).orElseThrow();
        var audit = new AuditDao(accounts.transactions).findById(row.getAuditId());
        publisher(runDao).completeAndPublish(run, audit, mock(AuditReportJson.class), "{}", claim);
    }

    @Test
    void admissionReplayOrderConflictOwnershipAndExpiry() throws Exception {
        engine("");
        var input = selection(a);
        String key = UUID.randomUUID().toString();
        var first = batches.create(a, CSRF, key, input);
        var reverse = new ArrayList<>(input.selectedPageIds());
        Collections.reverse(reverse);
        assertEquals(
                first.id(),
                batches.create(
                                a,
                                CSRF,
                                key,
                                new CreateBatch(input.discoveryId(), reverse, input.profileId()))
                        .id());
        error(
                409,
                () ->
                        batches.create(
                                a,
                                CSRF,
                                key,
                                new CreateBatch(
                                        input.discoveryId(),
                                        List.of(reverse.getFirst()),
                                        input.profileId())));
        error(409, () -> launch(input));
        error(404, () -> batches.get(b, site(first), id(first)));
        error(404, () -> batches.cancel(b, CSRF, site(first), id(first)));
        error(404, () -> batches.pages(b, site(first), id(first), 20, 0, "all"));
        assertEquals(2, count("ARG_USAGE_RUN"));
        assertEquals(2, count("ARG_ACCOUNT_SITE_URL"));
        assertEquals(2, progress(first).credits().reserved());
        long version = progress(first).version();
        assertEquals(version, progress(first).version());
        sql(
                "UPDATE ARG_DOMAIN_DISCOVERY SET expires_at=DATE_ADD(created_at,INTERVAL 1 SECOND)"
                        + " WHERE id="
                        + input.discoveryId());
        clock.now = clock.now.plusSeconds(2);
        assertEquals(first.id(), batches.create(a, CSRF, key, input).id());
        batches.cancel(a, CSRF, site(first), id(first));
        error(410, () -> launch(input));
        assertEquals(2, progress(first).credits().released());
        assertEquals(0, batches.active(a).size());
    }

    @Test
    void quotaAndMidAdmissionFailureRollbackAllPrivateState() throws Exception {
        engine("usage.offers.FREE.monthly-limit=1");
        var input = selection(a);
        error(429, () -> launch(input));
        assertEquals(0, count("ARG_DOMAIN_BATCH"));
        assertEquals(0, count("ARG_USAGE_RUN"));
        assertEquals(0, count("ARG_ACCOUNT_SITE_URL"));
        usage =
                new UsageService(
                        accounts.transactions, new UsagePolicy(ConfigFactory.empty()), clock);
        engine(
                new AuditRunDao(accounts.transactions, usage) {
                    int inserted;

                    @Override
                    public AuditRun saveQueued(AuditRun run, java.sql.Connection c) {
                        var saved = super.saveQueued(run, c);
                        if (++inserted == 2) throw new IllegalStateException("admission rollback");
                        return saved;
                    }
                });
        assertThrows(IllegalStateException.class, () -> launch(input));
        assertEquals(0, count("ARG_DOMAIN_BATCH"));
        assertEquals(0, count("ARG_DOMAIN_BATCH_PAGE"));
        assertEquals(0, count("ARG_USAGE_RUN"));
        assertEquals(0, count("ARG_ACCOUNT_SITE_URL"));
        assertEquals(0, count("ARG_AUDIT_RUN WHERE owner_user_id=10"));
        engine("");
        assertEquals(2, progress(launch(input)).counts().queued());
    }

    @Test
    void globalQueueCapacityRollbackDoesNotAdmitSubset() throws Exception {
        engine("");
        var input = selection(a);
        sql("UPDATE ARG_AUDIT_ADMISSION SET pending=99 WHERE id=1");
        error(429, () -> launch(input));
        assertEquals(0, count("ARG_DOMAIN_BATCH"));
        assertEquals(0, count("ARG_USAGE_RUN"));
        assertEquals(0, count("ARG_ACCOUNT_SITE_URL"));
    }

    @Test
    void selectionMustBeTerminalEligibleOwnedAndStillSafe() throws Exception {
        engine("");
        var queued = create(a);
        error(
                409,
                () ->
                        launch(
                                new CreateBatch(
                                        queued.id(), List.of("1"), ConnectedProfiles.DEFAULT_ID)));
        service.cancel(a, CSRF, Long.parseLong(queued.id()));
        var input = selection(a);
        error(404, () -> batches.create(b, CSRF, UUID.randomUUID().toString(), input));
        error(
                404,
                () ->
                        launch(
                                new CreateBatch(
                                        input.discoveryId(), List.of("1"), input.profileId())));
        error(
                400,
                () ->
                        launch(
                                new CreateBatch(
                                        input.discoveryId(), input.selectedPageIds(), "other")));
        sql(
                "UPDATE ARG_DOMAIN_DISCOVERY_PAGE SET"
                        + " eligible=FALSE,exclusion_reason='USER_EXCLUDED' WHERE id="
                        + input.selectedPageIds().getFirst());
        error(400, () -> launch(input));
        sql(
                "UPDATE ARG_DOMAIN_DISCOVERY_PAGE SET eligible=TRUE,exclusion_reason=NULL WHERE id="
                        + input.selectedPageIds().getFirst());
        doThrow(new DiscoveryStop("TARGET_BLOCKED")).when(transport).validate(anyString(), any());
        error(400, () -> launch(input));
        assertEquals(0, count("ARG_USAGE_RUN"));
    }

    @Test
    void simultaneousReplayAndDifferentKeysSerializeAdmission() throws Exception {
        engine("");
        var input = selection(a);
        String key = UUID.randomUUID().toString();
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<String> task =
                    () -> {
                        barrier.await();
                        return batches.create(a, CSRF, key, input).id();
                    };
            var one = pool.submit(task);
            var two = pool.submit(task);
            assertEquals(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
        }
        assertEquals(1, count("ARG_DOMAIN_BATCH"));
        assertEquals(2, count("ARG_USAGE_RUN"));
        var active = batches.active(a).getFirst();
        batches.cancel(a, CSRF, Long.parseLong(active.domainId()), Long.parseLong(active.id()));
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task =
                    () -> {
                        barrier.await();
                        try {
                            launch(input);
                            return true;
                        } catch (AccountError e) {
                            assertEquals(409, e.getResponse().getStatus());
                            return false;
                        }
                    };
            var one = pool.submit(task);
            var two = pool.submit(task);
            assertNotEquals(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
        }
        assertEquals(2, count("ARG_DOMAIN_BATCH"));
        assertEquals(4, count("ARG_USAGE_RUN"));
    }

    @Test
    void twoOwnersShareHostButNeverRunsOrCredits() throws Exception {
        engine("");
        var first = launch(selection(a));
        var second = batches.create(b, CSRF, UUID.randomUUID().toString(), selection(b));
        assertNotEquals(first.domainId(), second.domainId());
        assertEquals(4, count("ARG_USAGE_RUN"));
        assertEquals(2, count("ARG_ACCOUNT_SITE"));
        error(404, () -> batches.get(a, site(second), id(second)));
    }

    @Test
    void restartReconcilesMixedOutcomesWithoutBrowserAndFiltersBeforePagination() throws Exception {
        engine("");
        var input = selection(a);
        var batch = launch(input);
        var p = pages(batch);
        long one = Long.parseLong(p.get(0).runId()), two = Long.parseLong(p.get(1).runId());
        assertTrue(runDao.claimRun(one, "one", clock.instant()));
        assertFalse(runDao.claimRun(one, "two", clock.instant()));
        publish(one, "one");
        assertTrue(runDao.claimRun(two, "two", clock.instant()));
        assertTrue(runDao.markFailed(two, clock.instant(), "fixture", "two"));
        engine("");
        new BatchReconciler(batchDao, batches).tick();
        assertEquals(0, batches.active(a).size());
        var result = progress(batch);
        assertEquals(BatchStatus.PARTIAL, result.status());
        assertEquals(1, result.counts().full());
        assertEquals(1, result.counts().failed());
        assertEquals(1, result.credits().counted());
        assertEquals(1, result.credits().released());
        var filtered = batches.pages(a, site(batch), id(batch), 1, 0, "FAILED");
        assertEquals(1, filtered.total());
        assertEquals(Long.toString(two), filtered.items().getFirst().runId());
        sql("DELETE FROM ARG_AUDIT_REPORT WHERE run_id=" + one);
        assertEquals(1, progress(batch).counts().full());
        assertEquals(1, progress(batch).credits().counted());
        assertFalse(pages(batch).getFirst().reportAvailable());
        assertNotEquals(batch.id(), launch(input).id());
        assertEquals(4, count("ARG_USAGE_RUN"));
    }

    @Test
    void cancellationReleasesQueuedKeepsRunningAndRetainsPublishedReports() throws Exception {
        engine("");
        var batch = launch(selection(a));
        var p = pages(batch);
        long running = Long.parseLong(p.getFirst().runId());
        runDao.claimRun(running, "worker", clock.instant());
        var canceled = batches.cancel(a, CSRF, site(batch), id(batch));
        assertEquals(BatchStatus.RUNNING, canceled.status());
        assertEquals(1, canceled.credits().reserved());
        assertEquals(1, canceled.credits().released());
        assertThrows(RunCanceledException.class, () -> publish(running, "worker"));
        assertEquals(BatchStatus.CANCELED, progress(batch).status());
        assertEquals(2, progress(batch).credits().released());
        var next =
                launch(
                        new CreateBatch(
                                progress(batch).discoveryId(),
                                p.stream().map(BatchProgressPage::discoveryPageId).toList(),
                                ConnectedProfiles.DEFAULT_ID));
        long completed = Long.parseLong(pages(next).getFirst().runId());
        runDao.claimRun(completed, "next", clock.instant());
        publish(completed, "next");
        canceled = batches.cancel(a, CSRF, site(next), id(next));
        assertEquals(1, canceled.credits().counted());
        assertEquals(1, canceled.credits().released());
        assertTrue(reports.findByRunId(completed).isPresent());
    }

    @Test
    void reaperFencesStaleObservationAndRetainsReservationUntilTerminal() throws Exception {
        engine("");
        var batch = launch(selection(a));
        long run = Long.parseLong(pages(batch).getFirst().runId());
        runDao.claimRun(run, "old", clock.instant());
        var observed = runs.getRun(run).orElseThrow();
        assertEquals(
                AuditRunDao.Recovery.REQUEUED,
                runDao.recoverStuck(
                        observed, 3, clock.instant(), runs.initialModuleStatusesJson()));
        assertEquals(2, progress(batch).credits().reserved());
        assertTrue(runDao.claimRun(run, "new", clock.instant()));
        assertFalse(
                runDao.updateModuleStatus(
                        run, "http", "COMPLETED", runs.initialModuleStatusesJson(), false, "old"));
        assertTrue(
                runDao.updateModuleStatus(
                        run, "http", "RUNNING", runs.initialModuleStatusesJson(), false, "new"));

        assertEquals(
                AuditRunDao.Recovery.STALE,
                runDao.recoverStuck(observed, 3, clock.instant(), "bad"));
        assertThrows(IllegalStateException.class, () -> publish(run, "old"));
        assertEquals(2, progress(batch).credits().reserved());
        assertEquals(
                AuditRunDao.Recovery.FAILED,
                runDao.recoverStuck(runs.getRun(run).orElseThrow(), 2, clock.instant(), "[]"));
        assertEquals(1, progress(batch).credits().released());
    }

    @Test
    void cancelAndPublicationNeverDeadlockOrChargeTwice() throws Exception {
        engine("");
        var batch = launch(selection(a));
        long run = Long.parseLong(pages(batch).getLast().runId());
        runDao.claimRun(run, "worker", clock.instant());
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var publication =
                    pool.submit(
                            () -> {
                                barrier.await();
                                try {
                                    publish(run, "worker");
                                } catch (RunCanceledException expected) {
                                }
                                return true;
                            });
            var cancel =
                    pool.submit(
                            () -> {
                                barrier.await();
                                return batches.cancel(a, CSRF, site(batch), id(batch));
                            });
            publication.get(15, TimeUnit.SECONDS);
            cancel.get(15, TimeUnit.SECONDS);
        }
        var result = progress(batch);
        assertEquals(0, result.credits().reserved());
        assertEquals(2, result.credits().counted() + result.credits().released());
        assertEquals(reports.findByRunId(run).isPresent() ? 1 : 0, result.credits().counted());
    }

    @Test
    void publicationFailureRollsBackCompletenessReportAndCreditTogether() throws Exception {
        engine("");
        var batch = launch(selection(a));
        long run = Long.parseLong(pages(batch).getFirst().runId());
        runDao.claimRun(run, "worker", clock.instant());
        var failing =
                new AuditRunDao(accounts.transactions, usage) {
                    @Override
                    public void recordBatchCompleteness(
                            long id, String completeness, java.sql.Connection c) {
                        super.recordBatchCompleteness(id, completeness, c);
                        throw new IllegalStateException("publication rollback");
                    }
                };
        var audit =
                new AuditDao(accounts.transactions)
                        .findById(runs.getRun(run).orElseThrow().getAuditId());
        assertThrows(
                IllegalStateException.class,
                () ->
                        publisher(failing)
                                .completeAndPublish(
                                        run, audit, mock(AuditReportJson.class), "{}", "worker"));
        assertEquals(2, progress(batch).credits().reserved());
        assertEquals(0, progress(batch).counts().completed());
        assertFalse(reports.findByRunId(run).isPresent());
        publish(run, "worker");
        assertEquals(1, progress(batch).credits().counted());
    }

    @Test
    void httpContractsRequireVerifiedOwnerCsrfAndRejectUnknownFields() throws Exception {
        engine("");
        var input = selection(a);
        var settings =
                new AccountSettings(
                        ConfigFactory.parseString(
                                "account.enabled=true\naccount.origin=\"http://localhost:3000\""));
        var json = new com.dokor.argos.jersey.SafeJsonProvider();
        json.setMapper(mapper);
        var config =
                new org.glassfish.jersey.server.ResourceConfig()
                        .register(json)
                        .register(com.coreoz.plume.jersey.errors.WsResultExceptionMapper.class)
                        .register(AccountContextFactory.binding(sessions))
                        .register(
                                com.coreoz.plume.jersey.security.permission
                                        .RequireExplicitAccessControlFeature
                                        .accessControlAnnotations(AccountAccess.class))
                        .register(
                                new com.coreoz.plume.jersey.security.permission.PermissionFeature<>(
                                        new AccountPermissionProvider(sessions),
                                        AccountAccess.class,
                                        AccountAccess::value))
                        .register(new DomainBatchesWs(batches, new AccountCsrf(settings)))
                        .register(new DomainBatchProgressWs(batches, new AccountCsrf(settings)));
        var server =
                org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory.createHttpServer(
                        java.net.URI.create("http://127.0.0.1:0/"), config, false);
        for (var listener : server.getListeners()) {
            listener.getTransport().setSelectorRunnersCount(1);
            listener.getTransport()
                    .setWorkerThreadPoolConfig(
                            org.glassfish.grizzly.threadpool.ThreadPoolConfig.defaultConfig()
                                    .setCorePoolSize(2)
                                    .setMaxPoolSize(4));
        }
        server.start();
        String base = "http://127.0.0.1:" + server.getListeners().iterator().next().getPort();
        try {
            assertEquals(
                    401,
                    http(base, "GET", "/account/domain-batches", null, null, false).statusCode());
            sql("UPDATE ARG_ACCOUNT_USER SET state='PENDING' WHERE id=20");
            assertEquals(
                    403, http(base, "GET", "/account/domain-batches", b, null, false).statusCode());
            sql("UPDATE ARG_ACCOUNT_USER SET state='ACTIVE' WHERE id=20");
            String payload = mapper.writeValueAsString(input);
            assertEquals(
                    403,
                    http(base, "POST", "/account/domain-batches", a, payload, false).statusCode());
            assertEquals(
                    400,
                    http(
                                    base,
                                    "POST",
                                    "/account/domain-batches",
                                    a,
                                    payload.substring(0, payload.length() - 1) + ",\"ownerId\":20}",
                                    true)
                            .statusCode());
            var admitted = http(base, "POST", "/account/domain-batches", a, payload, true);
            assertEquals(202, admitted.statusCode(), admitted.body());
            var batch = mapper.readValue(admitted.body(), AdmittedBatch.class);
            String path = "/account/domains/" + batch.domainId() + "/batches/" + batch.id();
            for (String route : List.of(path + "/progress", path + "/progress/pages")) {
                assertEquals(401, http(base, "GET", route, null, null, false).statusCode());
                assertEquals(404, http(base, "GET", route, b, null, false).statusCode());
                var response = http(base, "GET", route, a, null, false);
                assertEquals(200, response.statusCode(), response.body());
                assertTrue(
                        response.headers()
                                .firstValue("cache-control")
                                .orElse("")
                                .contains("no-store"));
                assertFalse(response.body().contains("token"));
            }
            assertEquals(
                    400,
                    http(base, "POST", path + "/cancel", a, "{\"ownerId\":20}", true).statusCode());
            assertEquals(403, http(base, "POST", path + "/cancel", a, "{}", false).statusCode());
            assertEquals(404, http(base, "POST", path + "/cancel", b, "{}", true).statusCode());
            assertEquals(200, http(base, "POST", path + "/cancel", a, "{}", true).statusCode());
        } finally {
            server.shutdownNow();
        }
    }

    java.net.http.HttpResponse<String> http(
            String base, String method, String path, String auth, String body, boolean csrf)
            throws Exception {
        var request =
                java.net.http.HttpRequest.newBuilder(java.net.URI.create(base + path))
                        .timeout(Duration.ofSeconds(15))
                        .header("Content-Type", "application/json")
                        .header("Idempotency-Key", UUID.randomUUID().toString());
        if (auth != null) request.header("Authorization", auth);
        if (csrf)
            request.header("Origin", "http://localhost:3000")
                    .header("X-Argos-CSRF", CSRF)
                    .header("Cookie", "argos_account_csrf=" + CSRF);
        return java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .build()
                .send(
                        request.method(
                                        method,
                                        body == null
                                                ? java.net.http.HttpRequest.BodyPublishers.noBody()
                                                : java.net.http.HttpRequest.BodyPublishers.ofString(
                                                        body))
                                .build(),
                        java.net.http.HttpResponse.BodyHandlers.ofString());
    }
}
