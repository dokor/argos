package com.dokor.argos.services.domain.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.connected.discovery.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.typesafe.config.ConfigFactory;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

@EnabledIfEnvironmentVariable(named = "ARGOS_TEST_CREDENTIALS_URL", matches = ".+")
class DiscoveryIT extends MariaDbReportFixture {
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

    @Test
    void replayConflictActiveOwnershipExpiryAndNoCredits() throws Exception {
        long runs = count("ARG_AUDIT_RUN");
        String key = UUID.randomUUID().toString();
        var first = service.create(a, CSRF, key, input());
        assertEquals(first.id(), service.create(a, CSRF, key, input()).id());
        assertEquals(
                409,
                assertThrows(
                                AccountError.class,
                                () ->
                                        service.create(
                                                a,
                                                CSRF,
                                                key,
                                                new CreateDiscovery(
                                                        "example.com", 1L, 0L, List.of())))
                        .getResponse()
                        .getStatus());
        assertNotEquals(first.id(), create(a).id());
        assertEquals(
                404,
                assertThrows(AccountError.class, () -> service.get(b, Long.parseLong(first.id())))
                        .getResponse()
                        .getStatus());
        assertEquals(
                404,
                assertThrows(
                                AccountError.class,
                                () -> service.cancel(b, CSRF, Long.parseLong(first.id())))
                        .getResponse()
                        .getStatus());
        assertEquals(0, count("ARG_USAGE_RUN"));
        assertEquals(runs, count("ARG_AUDIT_RUN"));
        assertEquals(2, service.active(a).size());
        service.cancel(a, CSRF, Long.parseLong(first.id()));
        clock.now = clock.now.plus(Duration.ofHours(25));
        // Renew fixture session so expiry is the discovery's, not the login's.
        a =
                accounts.transaction(
                        c ->
                                "Bearer "
                                        + sessions.create(accounts.user(10, c, false), CSRF, c)
                                                .jwt());
        assertEquals(
                410,
                assertThrows(AccountError.class, () -> service.get(a, Long.parseLong(first.id())))
                        .getResponse()
                        .getStatus());
    }

    @Test
    void simultaneousReplayCreatesExactlyOneSnapshot() throws Exception {
        String key = UUID.randomUUID().toString();
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<String> task =
                    () -> {
                        barrier.await();
                        return service.create(a, CSRF, key, input()).id();
                    };
            var one = pool.submit(task);
            var two = pool.submit(task);
            assertEquals(one.get(10, TimeUnit.SECONDS), two.get(10, TimeUnit.SECONDS));
        }
        assertEquals(1, count("ARG_DOMAIN_DISCOVERY"));
        assertEquals(1, count("ARG_ACCOUNT_SITE"));
    }

    @Test
    void concurrentSameOwnerSubmissionsAreBothDurable() throws Exception {
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task =
                    () -> {
                        barrier.await();
                        try {
                            create(a);
                            return true;
                        } catch (AccountError e) {
                            assertEquals(409, e.getResponse().getStatus());
                            return false;
                        }
                    };
            var one = pool.submit(task);
            var two = pool.submit(task);
            assertTrue(one.get(10, TimeUnit.SECONDS));
            assertTrue(two.get(10, TimeUnit.SECONDS));
        }
        assertEquals(2, count("ARG_DOMAIN_DISCOVERY"));
        assertEquals(0, count("ARG_USAGE_RUN"));
    }

    @Test
    void globalAdmissionIsCurrentUnderConcurrentOwnersAndRollsBackSite() throws Exception {
        configure("discovery.queue-limit=1");
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var one =
                    pool.submit(
                            () -> {
                                barrier.await();
                                try {
                                    create(a);
                                    return true;
                                } catch (AccountError e) {
                                    assertEquals(429, e.getResponse().getStatus());
                                    assertEquals(
                                            "2", e.getResponse().getHeaderString("Retry-After"));
                                    return false;
                                }
                            });
            var two =
                    pool.submit(
                            () -> {
                                barrier.await();
                                try {
                                    create(b);
                                    return true;
                                } catch (AccountError e) {
                                    assertEquals(429, e.getResponse().getStatus());
                                    assertEquals(
                                            "2", e.getResponse().getHeaderString("Retry-After"));
                                    return false;
                                }
                            });
            assertNotEquals(one.get(10, TimeUnit.SECONDS), two.get(10, TimeUnit.SECONDS));
        }
        assertEquals(1, count("ARG_DOMAIN_DISCOVERY"));
        assertEquals(1, count("ARG_ACCOUNT_SITE"));
    }

    @Test
    void workerPersistsSnapshotPaginationAndNeverRunsAudit() throws Exception {
        var first = create(a);
        long runs = count("ARG_AUDIT_RUN");
        var worker =
                new DiscoveryWorker(
                        dao, policy, new DomainCrawler(policy, transport), service, clock);
        assertTrue(worker.processNext());
        assertFalse(worker.processNext());
        var result = service.get(a, Long.parseLong(first.id()));
        assertEquals(ExecutionStatus.COMPLETED, result.status());
        assertEquals(2, result.eligibleCount());
        var page = service.pages(a, Long.parseLong(first.id()), 1, 0, "eligible");
        assertEquals(2, page.total());
        assertEquals(1, page.items().size());
        assertEquals(1, service.pages(a, Long.parseLong(first.id()), 1, 1, "all").items().size());
        assertEquals(0, service.pages(a, Long.parseLong(first.id()), 20, 0, "excluded").total());
        assertEquals(runs, count("ARG_AUDIT_RUN"));
        assertEquals(0, count("ARG_USAGE_RUN"));
        assertEquals(
                404,
                assertThrows(
                                AccountError.class,
                                () -> service.pages(b, Long.parseLong(first.id()), 20, 0, "all"))
                        .getResponse()
                        .getStatus());
    }

    @Test
    void queuedAndRunningCancellationAreIdempotentAndPreservePages() {
        var queued = create(a);
        long id = Long.parseLong(queued.id());
        assertEquals(ExecutionStatus.CANCELED, service.cancel(a, CSRF, id).status());
        assertEquals(ExecutionStatus.CANCELED, service.cancel(a, CSRF, id).status());
        assertNull(dao.claim(policy, clock.instant()));
        var running = create(a);
        var job = dao.claim(policy, clock.instant());
        dao.page(
                job,
                new DomainCrawler.Page(
                        "https://example.com", DiscoverySource.INITIAL, 0, true, null),
                clock.instant());
        assertEquals(
                ExecutionStatus.RUNNING,
                service.cancel(a, CSRF, Long.parseLong(running.id())).status());
        assertTrue(dao.canceled(job, clock.instant()));
        dao.finish(job, new DomainCrawler.Result("CANCELED", false), clock.instant());
        assertEquals(1, service.pages(a, job.getId(), 20, 0, "eligible").total());
        assertEquals(ExecutionStatus.CANCELED, service.get(a, job.getId()).status());
    }

    @Test
    void leaseRecoveryFencesOldWorkerAndFreesOwner() {
        var first = create(a);
        var stale = dao.claim(policy, clock.instant());
        clock.now = clock.now.plusSeconds(70);
        dao.transaction(
                c -> {
                    dao.gate(c);
                    dao.reap(c, clock.instant());
                    return null;
                });
        assertEquals("WORKER_LOST", service.get(a, Long.parseLong(first.id())).stopReason());
        assertThrows(
                DiscoveryStop.class,
                () ->
                        dao.page(
                                stale,
                                new DomainCrawler.Page(
                                        "https://example.com/late",
                                        DiscoverySource.LINK,
                                        1,
                                        true,
                                        null),
                                clock.instant()));
        dao.finish(stale, new DomainCrawler.Result("EXHAUSTED", false), clock.instant());
        assertEquals(ExecutionStatus.FAILED, service.get(a, stale.getId()).status());
        assertNotNull(create(a));
    }

    @Test
    void queuedDurationSnapshotControlsLeaseAfterConfigurationChange() {
        configure("discovery.duration-seconds=120");
        create(a);
        configure("discovery.duration-seconds=10");
        var job = dao.claim(policy, clock.instant());
        assertEquals(clock.instant().plusSeconds(15), job.getLeaseUntil());
    }

    @Test
    void claimsRespectHostCapAcrossOwnersAndArchivedOwnerStops() throws Exception {
        configure("discovery.requests-per-host=1");
        create(a);
        create(b);
        var job = dao.claim(policy, clock.instant());
        assertNotNull(job);
        assertNull(dao.claim(policy, clock.instant()));
        sql("UPDATE ARG_ACCOUNT_USER SET state='ARCHIVED' WHERE id=" + job.getOwnerUserId());
        assertTrue(dao.canceled(job, clock.instant()));
        dao.finish(job, new DomainCrawler.Result("CANCELED", false), clock.instant());
        assertNotNull(dao.claim(policy, clock.instant()));
    }

    @Test void apiRejectsConfiguredOverflowBeforeAdmission() throws Exception {
        for (var input : List.of(new CreateDiscovery("example.com",51L,3L,List.of()),
                new CreateDiscovery("example.com",50L,4L,List.of()))) {
            assertEquals(400,assertThrows(AccountError.class,()->service.create(a,CSRF,UUID.randomUUID().toString(),input)).getResponse().getStatus());
        }
        assertEquals(0,count("ARG_DOMAIN_DISCOVERY"));
        configure("discovery.max-urls=200\ndiscovery.max-depth=5");
        var accepted=service.create(a,CSRF,UUID.randomUUID().toString(),new CreateDiscovery("example.com",200L,5L,List.of()));
        assertEquals(200,accepted.effectiveLimits().maxUrls());
        assertEquals(5,accepted.effectiveLimits().maxDepth());
    }
    @Test void accountQueueIsBoundedAndClaimsOneDomainAtATimeThenRotatesOwners() throws Exception {
        configure("discovery.account-queue-limit=2");
        var first=create(a);
        var second=service.create(a,CSRF,UUID.randomUUID().toString(),new CreateDiscovery("other.example",50L,3L,List.of()));
        var full=assertThrows(AccountError.class,()->create(a));
        assertEquals(429,full.getResponse().getStatus());
        assertEquals(2,count("ARG_DOMAIN_DISCOVERY"));
        var job=dao.claim(policy,clock.instant());
        assertEquals(first.id(),job.getId().toString());
        assertNull(dao.claim(policy,clock.instant()));
        var other=create(b);
        dao.finish(job,new DomainCrawler.Result("EXHAUSTED",false),clock.instant());
        var next=dao.claim(policy,clock.instant());
        assertEquals(other.id(),next.getId().toString());
        var last=dao.claim(policy,clock.instant());
        assertEquals(second.id(),last.getId().toString());
        assertEquals(0,count("ARG_USAGE_RUN"));
    }
    @Test void completedSelectionIsResumableWithoutCreatingAnAudit() {
        var first=create(a);
        new DiscoveryWorker(dao,policy,new DomainCrawler(policy,transport),service,clock).processNext();
        assertEquals(first.id(),service.active(a).getFirst().id());
        assertTrue(service.active(b).isEmpty());
    }
}
