package com.dokor.argos.services.domain.report;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import jakarta.ws.rs.WebApplicationException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL",matches=".+")
class UsageIT extends MariaDbReportFixture {
    private TransactionManagerQuerydsl tx;
    private UsageService usage;
    private AuditRunDao runDao;
    private AccountLifecycleIT.MutableClock clock;
    @BeforeEach void setupUsage() throws Exception {
        clock=new AccountLifecycleIT.MutableClock();clock.now=Instant.now();
        tx=new TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT));
        configure("usage.offers.FREE.monthly-limit=2");
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES(10,'one@example.com','One','ACTIVE','FREE',NOW()),(20,'two@example.com','Two','ACTIVE','FREE',NOW())");
    }
    private void configure(String config) {
        usage=new UsageService(tx,new UsagePolicy(ConfigFactory.parseString(config)),clock);
        runDao=new AuditRunDao(tx,usage);runs=new AuditRunService(runDao,tokens,mapper);
    }
    private AuditRun reserve(long user) { return runs.createQueuedRun(1,clock.instant(),user,null).run(); }
    private UsageService.Snapshot view(long user) { return usage.transaction(c->usage.snapshot(user,"FREE",c)); }
    private long count(String where) throws Exception {
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM "+where)){r.next();return r.getLong(1);}
    }
    private ReportPublishService publishService(AuditRunDao dao) throws Exception {
        var composer=mock(PublicReportComposer.class);var summary=mock(AiReportSummaryService.class);
        // Partial evidence and no global score still produce a report and consume one analysis.
        when(composer.compose(any())).thenReturn(mapper.readValue("{\"domain\":\"example.com\",\"scores\":{\"coverage\":{\"provisional\":true}}}",ReportDto.class));
        when(summary.enrich(any())).thenAnswer(call->call.getArgument(0));
        return new ReportPublishService(tx,dao,new AuditReportDao(tx),composer,summary,mock(AhrefsDomainRatingClient.class),mapper);
    }
    private Audit audit() { var a=new Audit();a.setId(1L);a.setNormalizedUrl("https://example.com");return a; }
    private void publish(AuditRun run) throws Exception {
        assertTrue(runDao.claimRun(run.getId(),"worker",clock.instant()));
        publishService(runDao).completeAndPublish(run.getId(),audit(),mock(AuditReportJson.class),"{}","worker");
    }
    @Test void reportAndUsageCommitTogetherIncludingPartialAndIdempotentPublication() throws Exception {
        var r=reserve(10);assertEquals(0,view(10).used());assertEquals(1,view(10).reserved());
        publish(r);
        assertEquals(1,view(10).used());assertEquals(0,view(10).reserved());assertEquals(0,view(20).used());
        var p=publishService(runDao);var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Long> task=()->{barrier.await();return p.completeAndPublish(r.getId(),audit(),mock(AuditReportJson.class),"{}","worker");};
            var a=pool.submit(task);var b=pool.submit(task);assertEquals(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
        }
        assertEquals(1,view(10).used());assertEquals(1,count("ARG_USAGE_RUN WHERE state='COUNTED'"));
        assertFalse(runDao.markFailed(r.getId(),clock.instant(),"late","worker"));assertEquals(1,view(10).used());
        sql("DELETE FROM ARG_AUDIT_REPORT WHERE run_id="+r.getId());assertEquals(1,view(10).used(),"Retention must not refund produced reports");
    }
    @Test void failureAndReaperReleaseCapacityButRequeueKeepsIt() throws Exception {
        var a=reserve(10);var b=reserve(10);assertFalse(view(10).canLaunch());
        assertTrue(runDao.claimRun(a.getId(),"worker",clock.instant()));
        assertFalse(runDao.markFailed(a.getId(),clock.instant(),"stale","wrong"));assertEquals(2,view(10).reserved());
        assertTrue(runDao.requeueStuckRun(a.getId()));assertEquals(2,view(10).reserved());
        assertTrue(runDao.claimRun(a.getId(),"new-worker",clock.instant()));
        assertTrue(runDao.markFailed(a.getId(),clock.instant(),"failed","new-worker"));assertTrue(view(10).canLaunch());
        assertTrue(runDao.claimRun(b.getId(),"worker",clock.instant()));assertTrue(runDao.markStuckFailed(b.getId(),clock.instant(),"abandoned"));
        assertEquals(0,view(10).used());assertEquals(0,view(10).reserved());
    }
    @Test void concurrentEntrypointsNeverOverbookAndNoRejectedRunIsInserted() throws Exception {
        var barrier=new CyclicBarrier(8);
        try(var pool=Executors.newFixedThreadPool(8)) {
            var work=new ArrayList<Future<Boolean>>();
            for(int i=0;i<8;i++) work.add(pool.submit(()->{barrier.await();try{reserve(10);return true;}catch(WebApplicationException e){assertEquals(429,e.getResponse().getStatus());assertEquals("quota_exceeded",((Map<?,?>)e.getResponse().getEntity()).get("error"));assertNotNull(e.getResponse().getHeaderString("Retry-After"));return false;}}));
            int accepted=0;for(var f:work) if(f.get(20,TimeUnit.SECONDS)) accepted++;assertEquals(2,accepted);
        }
        assertEquals(2,count("ARG_AUDIT_RUN WHERE owner_user_id=10"));assertEquals(2,view(10).reserved());
        assertTrue(view(20).canLaunch());
    }
    @Test void publicationRollbackDoesNotConsumeOrReleaseReservation() throws Exception {
        var r=reserve(10);runDao.claimRun(r.getId(),"worker",clock.instant());
        var failing=new AuditRunDao(tx,usage){@Override public boolean markCompleted(long id,String claim,Instant at,String json,java.sql.Connection c){super.markCompleted(id,claim,at,json,c);throw new IllegalStateException("rollback fixture");}};
        var p=publishService(failing);
        assertThrows(IllegalStateException.class,()->p.completeAndPublish(r.getId(),audit(),mock(AuditReportJson.class),"{}","worker"));
        assertEquals(0,view(10).used());assertEquals(1,view(10).reserved());assertTrue(reports.findByRunId(r.getId()).isEmpty());
        assertEquals("RUNNING",runs.getRun(r.getId()).orElseThrow().getStatus());
    }
    @Test void zeroAndUnlimitedOffersDoNotDependOnRoles() throws Exception {
        configure("usage.offers.FREE.monthly-limit=0");sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id=10");
        assertFalse(view(10).canLaunch());assertThrows(WebApplicationException.class,()->reserve(10));
        configure("");assertNull(view(10).limit());for(int i=0;i<4;i++) reserve(10);assertTrue(view(10).canLaunch());
    }
    @Test void usageWriteFailureRollsBackReportCompletionAndDebitTogether() throws Exception {
        var r=reserve(10);runDao.claimRun(r.getId(),"worker",clock.instant());
        var failingUsage=new UsageService(tx,new UsagePolicy(ConfigFactory.empty()),clock) {
            @Override public void published(AuditRun run,Instant at,java.sql.Connection c) {super.published(run,at,c);throw new IllegalStateException("usage rollback fixture");}
        };
        var p=publishService(new AuditRunDao(tx,failingUsage));
        assertThrows(IllegalStateException.class,()->p.completeAndPublish(r.getId(),audit(),mock(AuditReportJson.class),"{}","worker"));
        assertEquals(0,view(10).used());assertEquals(1,view(10).reserved());assertTrue(reports.findByRunId(r.getId()).isEmpty());
        assertEquals("RUNNING",runs.getRun(r.getId()).orElseThrow().getStatus());
    }
    @Test void monthBoundaryPreservesInflightCapacityAndCountsAtPublicationMonth() throws Exception {
        clock.now=Instant.parse("2026-12-31T23:59:59Z");var r=reserve(10);
        usage.transaction(c->{usage.published(r,clock.instant(),c);return null;});
        var pending=reserve(10);clock.now=Instant.parse("2027-01-01T00:00:00Z");
        var next=view(10);assertEquals("2027-01",next.period());assertEquals(0,next.used());assertEquals(1,next.reserved());assertTrue(next.canLaunch());
        usage.transaction(c->{usage.published(pending,clock.instant(),c);return null;});
        assertEquals(1,view(10).used());assertEquals(0,view(10).reserved());
        usage.transaction(c->{usage.published(r,clock.instant(),c);return null;});assertEquals(1,view(10).used());
    }
    @Test void migrationIncludesExpiredPartialAndArchivedOwnedReportsAndActiveReservations() throws Exception {
        migrateHistoricalRowsTo("13");
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at) VALUES(10,NULL,'Archived','ARCHIVED',NOW())");
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=10 WHERE id IN(1,2,3)");
        sql("UPDATE ARG_AUDIT_REPORT SET created_at='2026-09-15 08:00:00',provisional=1 WHERE run_id IN(1,3)");
        org.flywaydb.core.Flyway.configure().dataSource(source).target("26").load().migrate();
        assertEquals(2,count("ARG_USAGE_RUN WHERE user_id=10 AND state='COUNTED' AND period='2026-09'"));
        assertEquals(1,count("ARG_USAGE_RUN WHERE user_id=10 AND state='RESERVED'"));assertEquals(3,count("ARG_USAGE_RUN"));
        // The QueryDSL companions project every persisted field.
        var q=QUsageRun.table;assertEquals(3,tx.selectQuery().select(q).from(q).fetch().size());
        assertEquals(1,tx.selectQuery().select(QUsageAccount.table).from(QUsageAccount.table).fetch().size());
    }
    private List<AuditRun> reserveMany(long owner,int count) {
        return usage.transaction(c->{usage.admitMany(owner,count,c);var all=new ArrayList<AuditRun>();
            for(int n=0;n<count;n++)all.add(runs.createQueuedRun(1,clock.instant(),owner,c).run());return all;});
    }
    @Test void manyAdmissionIsAllOrNothingAndSafeAgainstTwoConcurrentRequests() throws Exception {
        configure("usage.offers.FREE.monthly-limit=3");reserve(10);
        long before=count("ARG_AUDIT_RUN"),ledger=count("ARG_USAGE_RUN");
        assertThrows(WebApplicationException.class,()->reserveMany(10,3));
        assertEquals(before,count("ARG_AUDIT_RUN"));assertEquals(ledger,count("ARG_USAGE_RUN"));assertEquals(2,view(10).available());
        var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task=()->{barrier.await();try{reserveMany(10,2);return true;}catch(WebApplicationException e){assertEquals(429,e.getResponse().getStatus());return false;}};
            var one=pool.submit(task);var two=pool.submit(task);assertNotEquals(one.get(20,TimeUnit.SECONDS),two.get(20,TimeUnit.SECONDS));
        }
        assertEquals(3,view(10).reserved());assertEquals(0,view(10).available());assertEquals(0,view(20).reserved());
    }
    @Test void failureHalfwayThroughManyAdmissionRollsBackEveryRunAndQueueSlot() throws Exception {
        configure("");long before=count("ARG_AUDIT_RUN"),ledger=count("ARG_USAGE_RUN");
        assertThrows(IllegalStateException.class,()->usage.transaction(c->{usage.admitMany(10,3,c);runs.createQueuedRun(1,clock.instant(),10L,c);runs.createQueuedRun(1,clock.instant(),10L,c);throw new IllegalStateException("rollback fixture");}));
        assertEquals(before,count("ARG_AUDIT_RUN"));assertEquals(ledger,count("ARG_USAGE_RUN"));assertEquals(0,view(10).reserved());
    }
    @Test void zeroOrInvalidSelectionsNeverReserveAndUnlimitedStillCounts() {
        assertThrows(AccountError.class,()->reserveMany(10,0));assertThrows(AccountError.class,()->reserveMany(10,101));
        configure("usage.offers.FREE.monthly-limit=0");assertEquals(0,view(10).available());assertThrows(WebApplicationException.class,()->reserveMany(10,1));
        configure("");reserveMany(10,3);assertNull(view(10).available());assertEquals(3,view(10).reserved());
    }
    @Test void queuedCancellationIsTerminalAndIdempotentAndReleasesItsQueueSlot() throws Exception {
        var run=reserve(10);
        assertThrows(AccountError.class,()->usage.transaction(c->runDao.requestCancellation(run.getId(),20,c,clock.instant())));
        assertTrue(Boolean.TRUE.equals(usage.transaction(c->runDao.requestCancellation(run.getId(),10,c,clock.instant()))));
        assertFalse(Boolean.TRUE.equals(usage.transaction(c->runDao.requestCancellation(run.getId(),10,c,clock.instant()))));
        assertFalse(runDao.claimRun(run.getId(),"late",clock.instant()));
        assertEquals("CANCELED",runs.getRun(run.getId()).orElseThrow().getStatus());assertEquals(0,view(10).reserved());assertEquals(0,view(10).used());
        assertEquals(1,count("ARG_USAGE_RUN WHERE state='RELEASED' AND released_at IS NOT NULL"));
        usage.transaction(c->{usage.published(run,clock.instant(),c);return null;});assertEquals(0,view(10).used(),"A stale debit cannot resurrect a released reservation");
    }
    @Test void runningCancellationRetainsCreditUntilWorkerTerminalAndRejectsPublication() throws Exception {
        var run=reserve(10);assertTrue(runDao.claimRun(run.getId(),"worker",clock.instant()));
        usage.transaction(c->runDao.requestCancellation(run.getId(),10,c,clock.instant()));
        assertEquals(1,view(10).reserved());assertEquals("RUNNING",runs.getRun(run.getId()).orElseThrow().getStatus());
        var publisher=publishService(runDao);
        assertThrows(RunCanceledException.class,()->publisher.completeAndPublish(run.getId(),audit(),mock(AuditReportJson.class),"{}","worker"));
        assertEquals("CANCELED",runs.getRun(run.getId()).orElseThrow().getStatus());assertEquals(0,view(10).reserved());assertEquals(0,view(10).used());assertTrue(reports.findByRunId(run.getId()).isEmpty());
    }
    @Test void crashAfterCancellationIsRecoveredWithoutRequeueOrStaleWorkerRelease() throws Exception {
        var run=reserve(10);runDao.claimRun(run.getId(),"old",clock.instant());assertTrue(runDao.requeueStuckRun(run.getId()));
        runDao.claimRun(run.getId(),"new",clock.instant());assertFalse(runDao.markFailed(run.getId(),clock.instant(),"late","old"));
        usage.transaction(c->runDao.requestCancellation(run.getId(),10,c,clock.instant()));assertEquals(1,view(10).reserved());
        assertFalse(runDao.requeueStuckRun(run.getId()));assertEquals("CANCELED",runs.getRun(run.getId()).orElseThrow().getStatus());assertEquals(0,view(10).reserved());
    }
    @Test void concurrentPublicationAndCancellationHaveExactlyOneDurableOutcome() throws Exception {
        var run=reserve(10);runDao.claimRun(run.getId(),"worker",clock.instant());var publisher=publishService(runDao);var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)){
            var cancel=pool.submit(()->{barrier.await();return usage.transaction(c->runDao.requestCancellation(run.getId(),10,c,clock.instant()));});
            var publish=pool.submit(()->{barrier.await();try{publisher.completeAndPublish(run.getId(),audit(),mock(AuditReportJson.class),"{}","worker");return true;}catch(RunCanceledException e){return false;}});
            boolean canceled=cancel.get(20,TimeUnit.SECONDS),published=publish.get(20,TimeUnit.SECONDS);assertNotEquals(canceled,published);
            assertEquals(published ? 1:0,view(10).used());assertEquals(0,view(10).reserved());assertEquals(published,reports.findByRunId(run.getId()).isPresent());
        }
    }
    @Test void manyReservationsSurviveMonthBoundaryAndPartialCancellation() {
        configure("usage.offers.FREE.monthly-limit=3");clock.now=Instant.parse("2026-12-31T23:59:59Z");var admitted=reserveMany(10,3);
        clock.now=Instant.parse("2027-01-01T00:00:00Z");assertEquals(3,view(10).reserved());assertEquals(0,view(10).available());
        usage.transaction(c->runDao.requestCancellation(admitted.getFirst().getId(),10,c,clock.instant()));
        usage.transaction(c->{usage.published(admitted.get(1),clock.instant(),c);return null;});
        assertEquals(1,view(10).used());assertEquals(1,view(10).reserved());assertEquals(1,view(10).available());
    }
    @Test void effectiveOfferAndOverrideUseCurrentReadsEvenAfterAnEarlierRepeatableRead() {
        configure("usage.offers.FREE.monthly-limit=10\nusage.offers.PREMIUM.monthly-limit=0");
        usage.transaction(c->{
            try(var q=c.prepareStatement("SELECT offer FROM ARG_ACCOUNT_USER WHERE id=10")){try(var rows=q.executeQuery()){rows.next();assertEquals("FREE",rows.getString(1));}}
            catch(Exception e){throw new IllegalStateException(e);}
            try(var other=source.getConnection();var q=other.createStatement()){q.executeUpdate("UPDATE ARG_ACCOUNT_USER SET offer='PREMIUM' WHERE id=10");}
            catch(Exception e){throw new IllegalStateException(e);}
            var current=usage.snapshot(10,"FREE",c);assertEquals("PREMIUM",current.offer());assertEquals(0,current.available());assertFalse(current.canLaunch());return null;
        });
    }

}
