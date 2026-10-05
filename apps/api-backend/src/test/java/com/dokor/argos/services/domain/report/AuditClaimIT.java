package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditReport;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
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
        assertFalse(dao.requeueStuckRun(1));
        assertEquals("COMPLETED",dao.findById(1L).getStatus());
    }
    @Test void retryPreservesCredentialIncrementsAttemptAndCannotReclaimCompletedRun() throws Exception {
        var created=runs.createQueuedRun(1,Instant.now()); long id=created.run().getId();
        assertTrue(dao.claimRun(id,"synthetic-first",Instant.now()));
        assertTrue(dao.requeueStuckRun(id));
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
}
