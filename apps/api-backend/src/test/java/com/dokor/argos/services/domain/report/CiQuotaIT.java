package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.WebApplicationException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class CiQuotaIT extends MariaDbReportFixture {
    private TransactionManagerQuerydsl tx; private UsageService usage; private AuditRunDao runDao;
    private CiQuotaService quotas; private CiRateService rates; private AccountLifecycleIT.MutableClock clock;
    private final String origin="https://example.com";
    @BeforeEach void setupCiQuotas() throws Exception {
        clock=new AccountLifecycleIT.MutableClock();clock.now=Instant.parse("2026-10-18T12:00:00Z");
        var config=ConfigFactory.parseString("premium-ci.enabled=true").withFallback(ConfigFactory.load());
        tx=new TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT));
        usage=new UsageService(tx,new UsagePolicy(config),clock);runDao=new AuditRunDao(tx,usage);
        runs=new AuditRunService(runDao,tokens,mapper);
        var accounts=new AccountDao(tx);rates=new CiRateService(accounts,tokens,clock);
        quotas=new CiQuotaService(runDao,new CiEntitlementService(new CiPolicy(config),usage,clock),new CiPolicy(config),new UsagePolicy(config),rates,tokens,clock);
        for(int owner:new int[]{10,20,30}) {
            sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES("+owner+",'quota"+owner+"@example.com','Quota','ACTIVE','PREMIUM',NOW())");
            sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES("+owner+",1,'2028-01-01',NOW())");
            sql("INSERT INTO ARG_CI_INTEGRATION(id,public_id,owner_user_id,slot,created_at) VALUES("+owner+",'"+UUID.randomUUID()+"',"+owner+",1,NOW())");
        }
    }
    private CiKeysService.Context identity(long owner,long integration) {return new CiKeysService.Context(owner,integration,UUID.randomUUID().toString(),"0".repeat(32),Set.of("audits:write","usage:read"),List.of());}
    private List<AuditRun> admit(CiKeysService.Context identity,int samples) {
        return usage.transaction(c->{
            quotas.admit(identity,origin,samples,c);var result=new ArrayList<AuditRun>();String intent=UUID.randomUUID().toString();
            for(int n=1;n<=samples;n++) {
                var run=runs.createQueuedRun(1,clock.instant(),identity.owner(),c).run();run.setCiNavigationOrigins("[\"https://example.com\"]");
                tx.update(QAuditRun.auditRun,c).set(QAuditRun.auditRun.ciNavigationOrigins,run.getCiNavigationOrigins()).where(QAuditRun.auditRun.id.eq(run.getId())).execute();
                quotas.attribute(run,identity,origin,intent,n,c);result.add(run);
            }
            return result;
        });
    }
    private CiQuotaService.Snapshot snapshot(CiKeysService.Context who){return usage.transaction(c->quotas.snapshot(who,c));}
    private CiErrorCode code(WebApplicationException e){return ((CiErrors.Envelope)e.getResponse().getEntity()).error().code();}
    private void cancel(AuditRun run){usage.transaction(c->{runDao.requestCancellation(run.getId(),run.getOwnerUserId(),c,clock.instant());return null;});}
    private void counted(long id,long owner,long integration,String period) throws Exception {
        // Historical publication fixture; no admission or hourly execution is performed here.
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,owner_user_id,status,created_at) VALUES("+id+",1,"+owner+",'COMPLETED',NOW())");
        try(var c=source.getConnection();var s=c.prepareStatement("INSERT INTO ARG_USAGE_RUN(id,user_id,period,state,created_at,counted_at,ci_integration_id,ci_target_hash,ci_intent_id,ci_sample) VALUES(?,?,?,'COUNTED',NOW(),NOW(),?,?,?,1)")) {
            s.setLong(1,id);s.setLong(2,owner);s.setString(3,period);s.setLong(4,integration);s.setBytes(5,tokens.sha256(origin));s.setString(6,UUID.randomUUID().toString());s.executeUpdate();
        }
    }
    @Test void pairIsRefusedWithOneCreditAndReplacementKeepsTheSameMonthlyLedger() throws Exception {
        var who=identity(10,10);for(int n=0;n<29;n++)counted(1000+n,10,10,"2026-10");
        assertEquals(CiErrorCode.QUOTA_EXCEEDED,code(assertThrows(WebApplicationException.class,()->admit(who,2))));
        assertEquals(0,snapshot(who).reserved());assertEquals(1,snapshot(who).available());
        var run=admit(who,1).getFirst();assertEquals(0,snapshot(identity(10,10)).available());
        assertEquals(30,snapshot(identity(10,99)).available()); // Another slot never borrows these credits.
        cancel(run);assertEquals(1,snapshot(who).available());
        var row=tx.selectQuery().select(QUsageRun.table).from(QUsageRun.table).where(QUsageRun.table.id.eq(run.getId())).fetchOne();
        assertEquals(10L,row.getCiIntegrationId());assertNotNull(row.getCiIntentId());assertArrayEquals(tokens.sha256(origin),row.getCiTargetHash());
    }
    @Test void outstandingReservationsSurviveTheMonthAndPublicationDebitsTheNewMonthExactlyOnce() {
        var who=identity(10,10);clock.now=Instant.parse("2026-10-31T23:59:59Z");var run=admit(who,1).getFirst();
        clock.now=Instant.parse("2026-11-01T00:00:00Z");assertEquals(1,snapshot(who).reserved());assertEquals(0,snapshot(who).used());
        usage.transaction(c->{usage.published(run,clock.instant(),c);usage.published(run,clock.instant(),c);return null;});
        assertEquals(1,snapshot(who).used());assertEquals(0,snapshot(who).reserved());assertEquals("2026-11",snapshot(who).period());
    }
    @Test void concurrentIntegrationsAndInstancesCannotMultiplyTheAccountQueue() throws Exception {
        var barrier=new CyclicBarrier(4);int admitted=0;
        try(var pool=Executors.newFixedThreadPool(4)) {
            var pending=new ArrayList<Future<Boolean>>();for(int n=0;n<4;n++)pending.add(pool.submit(()->{
                barrier.await();try{admit(identity(10,10),2);return true;}catch(WebApplicationException e){assertEquals(CiErrorCode.CAPACITY_UNAVAILABLE,code(e));return false;}
            }));
            for(var f:pending)if(f.get(20,TimeUnit.SECONDS))admitted++;
        }
        assertEquals(1,admitted);assertEquals(2,snapshot(identity(10,10)).reserved());
    }
    @Test void sharedTargetAndGlobalQueueCapsRefuseBeforeAnyChild() throws Exception {
        admit(identity(10,10),2);admit(identity(20,20),2);
        assertEquals(CiErrorCode.CAPACITY_UNAVAILABLE,code(assertThrows(WebApplicationException.class,()->admit(identity(30,30),1))));
        assertEquals(0,snapshot(identity(30,30)).reserved());
        sql("UPDATE ARG_AUDIT_ADMISSION SET pending=99 WHERE id=1");
        assertEquals(CiErrorCode.CAPACITY_UNAVAILABLE,code(assertThrows(WebApplicationException.class,()->admit(identity(30,30),2))));
    }
    @Test void doubleSamplesClaimSequentiallyAcrossWorkersAndRequeueRetainsReservation() {
        var pair=admit(identity(10,10),2);var first=pair.getFirst();var second=pair.getLast();
        assertFalse(runDao.claimRun(second.getId(),"too-early",clock.instant()));
        assertTrue(runDao.claimRun(first.getId(),"worker-one",clock.instant()));
        assertFalse(runDao.claimRun(second.getId(),"worker-two",clock.instant()));
        assertTrue(runDao.requeueStuckRun(first.getId()));assertEquals(2,snapshot(identity(10,10)).reserved());
        assertTrue(runDao.claimRun(first.getId(),"worker-retry",clock.instant()));
        assertFalse(runDao.markFailed(first.getId(),clock.instant(),"stale","worker-one"));
        assertTrue(runDao.markFailed(first.getId(),clock.instant(),"fixture","worker-retry"));
        assertTrue(runDao.claimRun(second.getId(),"worker-two",clock.instant()));
        assertEquals(1,snapshot(identity(10,10)).reserved());
    }
    @Test void failedAuditsDoNotRefundHourlyCostAndRollbackCreatesNoReservation() {
        var who=identity(10,10);
        assertThrows(IllegalStateException.class,()->usage.transaction(c->{quotas.admit(who,origin,2,c);throw new IllegalStateException("rollback fixture");}));
        assertEquals(0,snapshot(who).reserved());
        for(int n=0;n<6;n++)cancel(admit(who,1).getFirst());
        assertEquals(30,snapshot(who).available());
        assertEquals(CiErrorCode.RATE_LIMITED,code(assertThrows(WebApplicationException.class,()->admit(who,1))));
        clock.now=clock.instant().plusSeconds(3600);assertEquals(1,admit(who,1).size());
    }
    @Test void pollingAndRejectedTrafficBudgetsCommitIndependentlyOfBusinessRollback() {
        var who=identity(10,10);for(int n=0;n<90;n++)rates.traffic(who,false);
        assertEquals(CiErrorCode.RATE_LIMITED,code(assertThrows(WebApplicationException.class,()->rates.traffic(who,false))));
        assertEquals(0,snapshot(who).reserved());clock.now=clock.instant().plusSeconds(60);rates.traffic(who,false);
        for(int n=0;n<6;n++)rates.traffic(who,true);
        assertEquals(CiErrorCode.RATE_LIMITED,code(assertThrows(WebApplicationException.class,()->rates.traffic(who,true))));
    }
}
