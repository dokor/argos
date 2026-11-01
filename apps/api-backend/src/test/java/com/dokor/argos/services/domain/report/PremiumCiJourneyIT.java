package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.billing.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.connected.discovery.DiscoveryTransport;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.WebApplicationException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.*;
import static com.dokor.argos.services.billing.BillingFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real MariaDB, sessions, rights, keys, admission and publication. Provider, DNS and measurements are synthetic. */
class PremiumCiJourneyIT extends MariaDbReportFixture {
    private static final String CSRF="c".repeat(43), ORIGIN="https://example.com";
    private AccountLifecycleIT.MutableClock clock;
    private AccountDao dao;
    private AccountSessionService sessions;
    private BillingService billing;
    private BillingStore store;
    private StripeWebhookService webhook;
    private Gateway gateway;
    private CiTargetsService targets;
    private CiKeysService keys;
    private CiAdmissionService ci;
    private AuditRunDao runDao;
    private String browser;

    @BeforeEach void setupJourney() throws Exception {
        clock=new AccountLifecycleIT.MutableClock();clock.now=NOW;
        // These opt-ins exist only in this isolated test; reference defaults remain closed.
        var config=ConfigFactory.parseString("premium-ci.enabled=true\naccount.enabled=true\naccount.jwt-secret=\""+"s".repeat(64)+"\"")
            .withFallback(config());
        var tx=new TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT));
        dao=new AccountDao(tx);var settings=new AccountSettings(config);
        sessions=new AccountSessionService(dao,new AccountSessionSigner(settings,mapper,clock),tokens,settings,clock);
        var limiter=new AccountRateLimiter(dao,tokens,clock,settings);
        var policy=new CiPolicy(config);var usage=new UsageService(tx,new UsagePolicy(config),clock);
        var entitlement=new CiEntitlementService(policy,usage,clock);
        var operations=new CiAccountOperations(sessions,limiter,entitlement);
        var proof=mock(HttpsTargetProofClient.class);when(proof.matches(anyString(),anyString(),any())).thenReturn(true);
        targets=new CiTargetsService(dao,operations,policy,entitlement,proof,tokens,clock);
        keys=new CiKeysService(dao,operations,targets,policy,new CiAuthLimiter(dao,tokens,clock),sessions,tokens,mapper,clock);
        runDao=new AuditRunDao(tx,usage);runs=new AuditRunService(runDao,tokens,mapper);
        var rates=new CiRateService(dao,tokens,clock);
        ci=new CiAdmissionService(keys,targets,entitlement,new CiQuotaService(runDao,entitlement,policy,new UsagePolicy(config),rates,tokens,clock),
            new CiRequestDao(tx),runs,dao,mock(DiscoveryTransport.class),mapper,tokens,clock,ReportRetentionPolicy.defaults());
        var billingSettings=new BillingSettings(config);store=new BillingStore(dao,billingSettings,clock);gateway=new Gateway();
        billing=new BillingService(billingSettings,store,gateway,sessions,settings,limiter,clock,policy);
        webhook=new StripeWebhookService(billingSettings,store,clock,mapper);
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES(733,'journey@example.com','Journey','ACTIVE','FREE',NOW())");
        sql("INSERT INTO ARG_BILLING_ACCOUNT(id,binding_id,stripe_account,live_mode,customer_id,next_sync_at) VALUES(733,'"+BINDING+"','acct_fixture733',0,'"+CUSTOMER+"','2026-10-19 12:00:00')");
        browser="Bearer "+dao.transaction(c->sessions.create(dao.user(733,c,false),CSRF,c)).jwt();
    }

    private void event(String id,String type) throws Exception {
        var body=obj("event").put("id",id).put("api_version",BillingSettings.API_VERSION).put("type",type);
        body.putObject("data").putObject("object").put("object","subscription").put("customer",CUSTOMER);
        byte[] bytes=mapper.writeValueAsBytes(body);long time=clock.instant().getEpochSecond();
        var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        mac.update((time+".").getBytes(StandardCharsets.US_ASCII));
        webhook.accept(new ByteArrayInputStream(bytes),"t="+time+",v1="+HexFormat.of().formatHex(mac.doFinal(bytes)),"application/json",null);
    }
    private CiKeysService.Issued issue(String target) {
        return keys.create(browser,CSRF,new CiKeysService.Input("Acceptance",List.of("audits:write","results:read","usage:read"),List.of(target),null,null),"fixture");
    }
    private String provision() throws Exception {
        event("evt_journey467paid","invoice.paid");billing.reconcile(733);
        var target=targets.create(browser,CSRF,ORIGIN,"fixture").target().id();targets.verify(browser,CSRF,target,"fixture");return target;
    }
    private CiAdmissionService.Creation admit(String auth,String intent) {
        return ci.create(auth,"fixture",intent,new CiAdmissionService.Input(ORIGIN,2,"standard-v1"));
    }
    private void denied(CiErrorCode code,org.junit.jupiter.api.function.Executable action) {
        var error=assertThrows(WebApplicationException.class,action);
        assertEquals(code,((CiErrors.Envelope)error.getResponse().getEntity()).error().code());
    }
    private void publish(CiAdmissionService.Creation created) throws Exception {
        for(var view:created.admission().runs()) {
            long id=Long.parseLong(view.id());assertTrue(runDao.claimRun(id,"acceptance-worker",clock.instant()));
            var raw=CiVerdictFixtures.report(mapper);CiVerdictFixtures.finding(raw,"http.security.csp","critical");
            var composer=mock(PublicReportComposer.class);when(composer.compose(any())).thenReturn(mapper.treeToValue(raw,ReportDto.class));
            var score=new com.dokor.argos.services.analysis.scoring.AuditScoreReport(13,"a".repeat(64),
                com.dokor.argos.services.analysis.scoring.ScoreAggregate.of("global",85,100),List.of(),List.of(),List.of(),Map.of(),List.of());
            var internal=new com.dokor.argos.services.analysis.model.AuditReportJson(1,ORIGIN,ORIGIN,clock.instant(),
                Map.of("measurementContractVersion","analysis-measurements-v6"),List.of(),score);
            var publisher=new ReportPublishService(dao.transactions,runDao,reports,composer,mock(AiReportSummaryService.class),mock(AhrefsDomainRatingClient.class),mapper);
            var audit=new Audit();audit.setId(runs.getRun(id).orElseThrow().getAuditId());audit.setNormalizedUrl(ORIGIN);
            publisher.completeAndPublish(id,audit,internal,"{}","acceptance-worker");
        }
    }

    @Test void paidCustomerVerifiesTargetAdmitsPairRotatesAndSurvivesRefundWithoutAnotherDebit() throws Exception {
        denied(CiErrorCode.FEATURE_NOT_AVAILABLE,()->targets.create(browser,CSRF,ORIGIN,"fixture"));
        billing.status(browser);assertTrue(gateway.requests.isEmpty());
        event("evt_journey467paid","invoice.paid");event("evt_journey467paid","invoice.paid");
        assertEquals(1L,dao.transaction(c->store.read(733,c)).getSyncGeneration());
        denied(CiErrorCode.FEATURE_NOT_AVAILABLE,()->targets.create(browser,CSRF,ORIGIN,"fixture"));
        assertTrue(gateway.requests.isEmpty());billing.reconcile(733);
        var target=targets.create(browser,CSRF,ORIGIN,"fixture").target().id();
        denied(CiErrorCode.TARGET_VERIFICATION_REQUIRED,()->issue(target));
        targets.verify(browser,CSRF,target,"fixture");var issued=issue(target);String auth="Bearer "+issued.credential();
        denied(CiErrorCode.AUTHENTICATION_FAILED,()->admit(browser,UUID.randomUUID().toString()));
        String intention=UUID.randomUUID().toString();var created=admit(auth,intention);
        assertEquals(2,ci.usage(auth,"fixture").usage().reserved());assertFalse(admit(auth,intention).created());
        publish(created);var usage=ci.usage(auth,"fixture").usage();assertEquals(2,usage.used());assertEquals(0,usage.reserved());
        assertEquals("SITE_NO_GO",ci.verdict(auth,"fixture",created.admission().id()).outcome());
        var replacement=keys.rotate(browser,CSRF,issued.key().id(),"fixture");String rotated="Bearer "+replacement.credential();
        assertEquals(usage,ci.usage(rotated,"fixture").usage());assertFalse(admit(rotated,intention).created());
        gateway.node("/v1/charges/ch_fixture733").put("amount_refunded",1);
        event("evt_journey467refund","charge.refunded");billing.reconcile(733);
        denied(CiErrorCode.FEATURE_NOT_AVAILABLE,()->admit(rotated,UUID.randomUUID().toString()));
        assertFalse(admit(rotated,intention).created());
        for(int n=0;n<3;n++)assertEquals("SITE_NO_GO",ci.verdict(rotated,"fixture",created.admission().id()).outcome());
        assertEquals(usage,ci.usage(rotated,"fixture").usage());
        assertEquals(2L,dao.transactions.selectQuery().select(QUsageRun.table.id.count()).from(QUsageRun.table).fetchOne());
        assertTrue(gateway.requests.stream().allMatch(p->p.startsWith("GET ")));
        // Each credential can still be revoked after loss of Premium, including the overlap credential.
        keys.revoke(browser,CSRF,issued.key().id(),"fixture");
        denied(CiErrorCode.AUTHENTICATION_FAILED,()->ci.verdict(auth,"fixture",created.admission().id()));
        assertEquals("SITE_NO_GO",ci.verdict(rotated,"fixture",created.admission().id()).outcome());
        keys.revoke(browser,CSRF,replacement.key().id(),"fixture");
        denied(CiErrorCode.AUTHENTICATION_FAILED,()->ci.verdict(rotated,"fixture",created.admission().id()));
    }

    @Test void staleBillingGrantStopsNewAdmissionsButPreservesAnAlreadyReservedPairAndItsReads() throws Exception {
        String auth="Bearer "+issue(provision()).credential();String intention=UUID.randomUUID().toString();
        var admitted=admit(auth,intention);clock.now=clock.now.plus(Duration.ofSeconds(901));store.expire();
        denied(CiErrorCode.FEATURE_NOT_AVAILABLE,()->admit(auth,UUID.randomUUID().toString()));
        assertFalse(admit(auth,intention).created());publish(admitted);
        assertEquals("SITE_NO_GO",ci.verdict(auth,"fixture",admitted.admission().id()).outcome());
        assertEquals(2,ci.usage(auth,"fixture").usage().used());assertEquals(0,ci.usage(auth,"fixture").usage().reserved());
        assertEquals(2L,dao.transactions.selectQuery().select(QUsageRun.table.id.count()).from(QUsageRun.table).fetchOne());
    }
}
