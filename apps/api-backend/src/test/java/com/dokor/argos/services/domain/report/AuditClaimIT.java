package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditReport;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.Instant;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL", matches=".+")
class AuditClaimIT extends MariaDbReportFixture {
    private AuditRunDao dao;
    @BeforeEach void emptyQueue() throws Exception {
        sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE status='QUEUED'");
        dao=new AuditRunDao(new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT)));
    }
    @Test void twelveConcurrentWorkersClaimExactlyOnceWithoutOverwritingTheWinner() throws Exception {
        long id=runs.createQueuedRun(1,Instant.now()).run().getId();
        var start=new CyclicBarrier(12); int successes=0;
        try(var pool=Executors.newFixedThreadPool(12)) {
            var claims=new java.util.ArrayList<Future<Boolean>>();
            for(int worker=0;worker<12;worker++) {
                String claim="synthetic-claim-"+worker;
                claims.add(pool.submit(() -> { start.await(10,TimeUnit.SECONDS); return dao.claimRun(id,claim,Instant.now()); }));
            }
            for(var claim:claims) if(claim.get(15,TimeUnit.SECONDS)) successes++;
        }
        assertEquals(1,successes);
        var winner=dao.findById(id);
        assertEquals("RUNNING",winner.getStatus()); assertEquals(1,winner.getAttemptCount());
        assertNotNull(winner.getStartedAt());
        assertEquals(id,dao.findByClaimToken(winner.getClaimToken()).orElseThrow().getId());
        assertFalse(dao.claimRun(id,"synthetic-late-claim",Instant.now()));
        assertEquals(winner.getClaimToken(),dao.findById(id).getClaimToken());
    }
    @Test void queueOrdersByCreationAndExcludesClaimedAndTerminalRuns() throws Exception {
        var older=runs.createQueuedRun(1,Instant.now().minusSeconds(30)).run();
        var newer=runs.createQueuedRun(1,Instant.now().minusSeconds(10)).run();
        var invalid=runs.createQueuedRun(1,Instant.now().minusSeconds(60)).run();
        sql("UPDATE ARG_AUDIT_RUN SET claim_token='synthetic-already-owned' WHERE id="+invalid.getId());
        assertEquals(older.getId(),dao.findNextQueuedRun().orElseThrow().getId());
        assertTrue(dao.claimRun(older.getId(),"synthetic-worker",Instant.now()));
        assertEquals(newer.getId(),dao.findNextQueuedRun().orElseThrow().getId());
        assertFalse(dao.claimRun(1,"synthetic-terminal",Instant.now()));
        assertEquals(AuditRunDao.Recovery.STALE, dao.recoverStuck(dao.findById(1L), 3, Instant.now(), runs.initialModuleStatusesJson()));
        assertEquals("COMPLETED",dao.findById(1L).getStatus());
    }
    @Test void retryPreservesCredentialIncrementsAttemptAndCannotReclaimCompletedRun() throws Exception {
        var created=runs.createQueuedRun(1,Instant.now()); long id=created.run().getId();
        assertTrue(dao.claimRun(id,"synthetic-first",Instant.now()));
        assertEquals(AuditRunDao.Recovery.REQUEUED, dao.recoverStuck(dao.findById(id), 3, Instant.now(), runs.initialModuleStatusesJson()));
        assertTrue(dao.claimRun(id,"synthetic-second",Instant.now()));
        assertEquals(2,dao.findById(id).getAttemptCount());
        assertArrayEquals(tokens.sha256(created.reportToken()),dao.findById(id).getReportTokenHash());
    }
    @Test void databaseRejectsDuplicateReportHashesAndLeavesTheExistingLinkReadable() throws Exception {
        long id=runs.createQueuedRun(1,Instant.now()).run().getId();
        var duplicate=new AuditReport(); duplicate.setAuditId(1L); duplicate.setRunId(id);
        duplicate.setTokenHash(tokens.sha256("synthetic-existing")); duplicate.setDomain("example.com");
        duplicate.setTargetUrl("https://example.com"); duplicate.setReportJson("{}"); duplicate.setCreatedAt(Instant.now());
        assertThrows(RuntimeException.class,()->reports.save(duplicate));
        assertTrue(reports.findByRunId(id).isEmpty()); assertTrue(reader.getByToken("synthetic-existing").isPresent());
    }

    @Test void concurrentReapersRecoverAnObservedAttemptOnlyOnce() throws Exception {
        long id = runs.createQueuedRun(1, Instant.now()).run().getId();
        assertTrue(dao.claimRun(id, "old-worker", Instant.now().minusSeconds(3600)));
        runs.updateModuleStatus(id, "http", "COMPLETED", "old-worker");
        var observed = dao.findById(id);
        var start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<AuditRunDao.Recovery> recover = () -> {
                start.await(10, TimeUnit.SECONDS);
                return dao.recoverStuck(observed, 3, Instant.now(), runs.initialModuleStatusesJson());
            };
            var first = pool.submit(recover);
            var second = pool.submit(recover);
            assertEquals(java.util.Set.of(AuditRunDao.Recovery.REQUEUED, AuditRunDao.Recovery.STALE),
                java.util.Set.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)));
        }
        var queued = dao.findById(id);
        assertEquals("QUEUED", queued.getStatus());
        assertNull(queued.getClaimToken());
        assertNull(queued.getStartedAt());
        assertEquals(1, queued.getAttemptCount());
        assertEquals(mapper.readTree(runs.initialModuleStatusesJson()), mapper.readTree(queued.getModuleStatuses()));
    }

    @ParameterizedTest @ValueSource(ints = {1, 3})
    void staleReaperAndWorkerCannotFailResetOrChangeTheNewAttempt(int maxAttempts) throws Exception {
        var created = runs.createQueuedRun(1, Instant.now());
        long id = created.run().getId();
        assertTrue(dao.claimRun(id, "old-worker", Instant.now().minusSeconds(3600)));
        var observed = dao.findById(id);
        assertEquals(AuditRunDao.Recovery.REQUEUED,
            dao.recoverStuck(observed, 3, Instant.now(), runs.initialModuleStatusesJson()));
        assertTrue(dao.claimRun(id, "new-worker", Instant.now()));
        var current = dao.findById(id);
        runs.updateModuleStatus(id, "http", "RUNNING", "new-worker");
        var start = new CyclicBarrier(3);
        try (var pool = Executors.newFixedThreadPool(3)) {
            var reaper = pool.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return dao.recoverStuck(observed, maxAttempts, Instant.now(), "[]");
            });
            var staleWorker = pool.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                runs.failRunningModules(id, "old-worker");
                runs.updateModuleStatus(id, "http", "FAILED", "old-worker");
                runs.updateModuleStatus(id, "ssl", "COMPLETED", "old-worker");
                return dao.markFailed(id, Instant.now(), "stale error", "old-worker");
            });
            var activeWorker = pool.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                runs.updateModuleStatus(id, "html", "COMPLETED", "new-worker");
                return true;
            });
            assertEquals(AuditRunDao.Recovery.STALE, reaper.get(15, TimeUnit.SECONDS));
            assertFalse(staleWorker.get(15, TimeUnit.SECONDS));
            assertTrue(activeWorker.get(15, TimeUnit.SECONDS));
        }
        var after = dao.findById(id);
        assertEquals("RUNNING", after.getStatus());
        assertEquals("new-worker", after.getClaimToken());
        assertEquals(current.getStartedAt(), after.getStartedAt());
        assertEquals(2, after.getAttemptCount());
        assertNull(after.getFinishedAt());
        assertNull(after.getLastError());
        assertArrayEquals(tokens.sha256(created.reportToken()), after.getReportTokenHash());
        assertEquals("RUNNING", moduleStatus(id, "http"));
        assertEquals("COMPLETED", moduleStatus(id, "html"));
        assertEquals("PENDING", moduleStatus(id, "ssl"));
        assertTrue(reports.findByRunId(id).isEmpty());
    }

    @Test void reclaimWaitsForRecoveryAndSeesResetProgressInTheSameCommit() throws Exception {
        long id = runs.createQueuedRun(1, Instant.now()).run().getId();
        assertTrue(dao.claimRun(id, "old-worker", Instant.now().minusSeconds(3600)));
        runs.updateModuleStatus(id, "http", "COMPLETED", "old-worker");
        var observed = dao.findById(id);
        var locked = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var recoveringDao = new AuditRunDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT))) {
            @Override public java.util.Optional<com.dokor.argos.db.generated.AuditRun> lockForPublication(long runId, java.sql.Connection connection) {
                var run = super.lockForPublication(runId, connection);
                locked.countDown();
                try { assertTrue(release.await(10, TimeUnit.SECONDS)); }
                catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
                return run;
            }
        };
        try (var pool = Executors.newFixedThreadPool(2)) {
            var recovery = pool.submit(() -> recoveringDao.recoverStuck(observed, 3, Instant.now(), runs.initialModuleStatusesJson()));
            try {
                assertTrue(locked.await(10, TimeUnit.SECONDS));
                var claimStarted = new CountDownLatch(1);
                var reclaim = pool.submit(() -> {
                    claimStarted.countDown();
                    assertTrue(dao.claimRun(id, "new-worker", Instant.now()));
                    assertEquals("PENDING", moduleStatus(id, "http"));
                    runs.updateModuleStatus(id, "http", "RUNNING", "new-worker");
                    return true;
                });
                assertTrue(claimStarted.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> reclaim.get(200, TimeUnit.MILLISECONDS));
                assertEquals("COMPLETED", moduleStatus(id, "http"));
                release.countDown();
                assertEquals(AuditRunDao.Recovery.REQUEUED, recovery.get(15, TimeUnit.SECONDS));
                assertTrue(reclaim.get(15, TimeUnit.SECONDS));
            } finally { release.countDown(); }
        }
        assertEquals("RUNNING", moduleStatus(id, "http"));
        assertEquals("new-worker", dao.findById(id).getClaimToken());
    }

    @Test void missingClaimNeverAuthorizesProgressOrFailureCleanup() throws Exception {
        long id = runs.createQueuedRun(1, Instant.now()).run().getId();
        assertTrue(dao.claimRun(id, "worker", Instant.now()));
        runs.updateModuleStatus(id, "http", "RUNNING", "worker");
        String initial = runs.initialModuleStatusesJson();
        for (String missing : java.util.Arrays.asList(null, "", " ")) {
            assertFalse(dao.updateModuleStatus(id, "http", "FAILED", initial, true, missing));
            assertFalse(dao.updateModuleStatus(id, "html", "COMPLETED", initial, false, missing));
            assertFalse(dao.markFailed(id, Instant.now(), "missing claim", missing));
        }
        assertEquals("RUNNING", moduleStatus(id, "http"));
        assertEquals("PENDING", moduleStatus(id, "html"));
    }

    private String moduleStatus(long id, String moduleId) throws Exception {
        for (var module : mapper.readTree(dao.findById(id).getModuleStatuses()))
            if (moduleId.equals(module.path("id").asText())) return module.path("status").asText();
        throw new AssertionError("Module missing: " + moduleId);
    }
}
