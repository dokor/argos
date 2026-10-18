package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.coreoz.plume.jersey.security.permission.*;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.jersey.SafeJsonProvider;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.webservices.api.account.*;
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

class CiKeysIT extends MariaDbReportFixture {
    private static final String CSRF="c".repeat(43);
    private AccountLifecycleIT.MutableClock clock;
    private AccountDao dao;
    private AccountSettings settings;
    private AccountSessionService sessions;
    private CiTargetsService targets;
    private CiKeysService keys;
    private CiEntitlementService entitlement;
    private AccountUser owner;
    private String auth,targetId;
    private com.typesafe.config.Config config;
    @BeforeEach void ciKeysRegistry() throws Exception {
        clock=new AccountLifecycleIT.MutableClock();clock.now=Instant.parse("2026-10-18T12:00:00Z");
        config=ConfigFactory.parseString("premium-ci.enabled=true\naccount.enabled=true\naccount.jwt-secret=\""+"s".repeat(64)+"\"").withFallback(ConfigFactory.load());
        settings=new AccountSettings(config);
        dao=new AccountDao(new TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT)));
        sessions=new AccountSessionService(dao,new AccountSessionSigner(settings,mapper,clock),tokens,settings,clock);
        entitlement=new CiEntitlementService(new CiPolicy(config),new UsageService(dao.transactions,new UsagePolicy(config),clock),clock);
        var ops=new CiAccountOperations(sessions,new AccountRateLimiter(dao,tokens,clock,settings),entitlement);
        var proof=mock(HttpsTargetProofClient.class);when(proof.matches(anyString(),anyString(),any())).thenReturn(true);
        targets=new CiTargetsService(dao,ops,new CiPolicy(config),entitlement,proof,tokens,clock);
        owner=user("keys@example.com");auth=login(owner);
        targetId=targets.create(auth,CSRF,"https://example.com","fixture").target().id();
        targets.verify(auth,CSRF,targetId,"fixture");
        keys=service(new CiPolicy(config));
    }
    private AccountUser user(String email) throws Exception {
        var user=dao.transaction(c->{var u=new AccountUser();u.setEmail(email);u.setDisplayName("CI fixture");u.setState("ACTIVE");u.setRole("USER");u.setOffer("PREMIUM");u.setCreatedAt(clock.instant());return dao.save(u,c);});
        sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES("+user.getId()+",1,'2028-10-18',NOW())");return user;
    }
    private String login(AccountUser user){return "Bearer "+dao.transaction(c->sessions.create(user,CSRF,c)).jwt();}
    private CiKeysService service(CiPolicy policy) {
        var rights=new CiEntitlementService(policy,new UsageService(dao.transactions,new UsagePolicy(config),clock),clock);
        var ops=new CiAccountOperations(sessions,new AccountRateLimiter(dao,tokens,clock,settings),rights);
        return new CiKeysService(dao,ops,targets,policy,new CiAuthLimiter(dao,tokens,clock),sessions,tokens,mapper,clock);
    }
    private CiKeysService.Input input(String integration){return new CiKeysService.Input("Deployment",List.of("audits:write","results:read","usage:read"),List.of(targetId),integration,null);}
    private CiKeysService.Issued issue(){return keys.create(auth,CSRF,input(null),"fixture");}
    private CiKeysService.Context authenticate(CiKeysService.Issued key){return keys.withCredential("Bearer "+key.credential(),"fixture",null,(ctx,c)->ctx);}
    private CiErrorCode code(WebApplicationException e){return ((CiErrors.Envelope)e.getResponse().getEntity()).error().code();}
    private void unauthorized(Runnable work){assertEquals(CiErrorCode.AUTHENTICATION_FAILED,code(assertThrows(WebApplicationException.class,work::run)));}

    @Test void secretIsShownOnceAndNoRoleOrScopeEscalationIsAccepted() throws Exception {
        var issued=issue();var stored=dao.transactions.selectQuery().select(QCiApiKey.table).from(QCiApiKey.table).fetchOne();
        assertArrayEquals(tokens.sha256(issued.credential()),stored.getSecretHash());
        assertFalse(mapper.writeValueAsString(keys.list(auth,0)).contains(issued.credential()));
        assertFalse(issued.toString().contains(issued.credential()));
        assertEquals("2027-10-18T12:00:00Z",issued.key().expiresAt());
        assertNull(issued.key().lastUsedAt());authenticate(issued);
        assertEquals("2026-10-18T12:00:00Z",keys.list(auth,0).items().getFirst().lastUsedAt());
        for(var scopes:List.of(List.of("admin"),List.of("audits:write","audits:write"),List.<String>of()))
            assertEquals(CiErrorCode.CONFIG_INVALID,code(assertThrows(WebApplicationException.class,
                ()->keys.create(auth,CSRF,new CiKeysService.Input("Bad",scopes,List.of(targetId),null,null),"fixture"))));
        sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN',offer='FREE' WHERE id="+owner.getId());
        assertEquals(CiErrorCode.FEATURE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,this::issue)));
        assertTrue(dao.transactions.selectQuery().select(QUsageRun.table).from(QUsageRun.table).fetch().isEmpty());
    }
    @Test void concurrentCreationHasThreeStableSlotsAndReplacementCannotResetAnIntegration() throws Exception {
        var barrier=new CyclicBarrier(4);var admitted=new ArrayList<CiKeysService.Issued>();
        try(var pool=Executors.newFixedThreadPool(4)) {
            var futures=new ArrayList<Future<CiKeysService.Issued>>();
            for(int n=0;n<4;n++) futures.add(pool.submit(()->{barrier.await();try{return issue();}catch(WebApplicationException e){assertEquals(CiErrorCode.QUOTA_EXCEEDED,code(e));return null;}}));
            for(var future:futures){var key=future.get(20,TimeUnit.SECONDS);if(key!=null) admitted.add(key);}
        }
        assertEquals(3,admitted.size());assertEquals(3,keys.list(auth,0).integrations().size());
        var old=admitted.getFirst();keys.revoke(auth,CSRF,old.key().id(),"fixture");
        assertEquals(CiErrorCode.QUOTA_EXCEEDED,code(assertThrows(WebApplicationException.class,this::issue)));
        var replaced=keys.create(auth,CSRF,input(old.key().integrationId()),"fixture");
        assertEquals(old.key().integrationId(),replaced.key().integrationId());unauthorized(()->authenticate(old));
        assertEquals(authenticate(replaced).integrationPublicId(),old.key().integrationId());
    }
    @Test void rotationPreservesIdentityAndAllowsOnlyOneBoundedOverlap() {
        var first=issue();var second=keys.rotate(auth,CSRF,first.key().id(),"fixture");
        assertEquals(first.key().integrationId(),second.key().integrationId());authenticate(first);authenticate(second);
        assertEquals(CiErrorCode.IDEMPOTENCY_CONFLICT,code(assertThrows(WebApplicationException.class,
            ()->keys.rotate(auth,CSRF,first.key().id(),"fixture"))));
        var third=keys.rotate(auth,CSRF,second.key().id(),"fixture");
        unauthorized(()->authenticate(first));authenticate(second);authenticate(third);
        clock.now=clock.instant().plus(Duration.ofMinutes(15));
        unauthorized(()->authenticate(second));authenticate(third);
    }
    @Test void concurrentRotationDoesNotCreateExtraCredentials() throws Exception {
        var first=issue();var barrier=new CyclicBarrier(2);int success=0;
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> rotate=()->{barrier.await();try{keys.rotate(auth,CSRF,first.key().id(),"fixture");return true;}
                catch(WebApplicationException rejected){assertEquals(CiErrorCode.IDEMPOTENCY_CONFLICT,code(rejected));return false;}};
            var a=pool.submit(rotate);var b=pool.submit(rotate);if(a.get(15,TimeUnit.SECONDS))success++;if(b.get(15,TimeUnit.SECONDS))success++;
        }
        assertEquals(1,success);assertEquals(2,keys.list(auth,0).items().size());
    }
    @Test void revocationExpirationAndAccountStatesAreCurrentAcrossInstances() throws Exception {
        var issued=issue();var other=service(new CiPolicy(config));
        keys.revoke(auth,CSRF,issued.key().id(),"fixture");
        unauthorized(()->other.withCredential("Bearer "+issued.credential(),"fixture",null,(ctx,c)->ctx));
        sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id="+owner.getId());
        sql("UPDATE ARG_ACCOUNT_USER SET offer='PREMIUM' WHERE id="+owner.getId());unauthorized(()->authenticate(issued));
        var active=keys.create(auth,CSRF,input(issued.key().integrationId()),"fixture");
        for(String state:List.of("PENDING","SUSPENDED","ARCHIVED")) {
            sql("UPDATE ARG_ACCOUNT_USER SET state='"+state+"' WHERE id="+owner.getId());unauthorized(()->authenticate(active));
        }
        sql("UPDATE ARG_ACCOUNT_USER SET state='ACTIVE' WHERE id="+owner.getId());authenticate(active);
        clock.now=Instant.parse(active.key().expiresAt());unauthorized(()->authenticate(active));
    }
    @Test void downgradedAccountCanReadWithValidScopeButCannotAdmitAndForeignScopeCannotBeSubstituted() throws Exception {
        var issued=issue();sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id="+owner.getId());
        keys.withCredential("Bearer "+issued.credential(),"fixture","results:read",(ctx,c)->ctx);
        assertEquals(CiErrorCode.FEATURE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->keys.withCredential("Bearer "+issued.credential(),"fixture","audits:write",(ctx,c)->entitlement.admitMany(ctx.owner(),1,c)))));
        var foreign=user("foreign-keys@example.com");var foreignAuth=login(foreign);
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->keys.revoke(foreignAuth,CSRF,issued.key().id(),"fixture"))));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->keys.create(foreignAuth,CSRF,input(issued.key().integrationId()),"fixture"))));
    }
    @Test void permissionChecksAndTargetEpochsRemainIndependentOfValidAuthentication() {
        var limited=keys.create(auth,CSRF,new CiKeysService.Input("Read usage",List.of("usage:read"),List.of(targetId),null,null),"fixture");
        assertEquals(CiErrorCode.PERMISSION_DENIED,code(assertThrows(WebApplicationException.class,
            ()->keys.withCredential("Bearer "+limited.credential(),"fixture","results:read",(ctx,c)->ctx))));
        targets.revoke(auth,CSRF,targetId,"fixture");targets.renew(auth,CSRF,targetId,"fixture");targets.verify(auth,CSRF,targetId,"fixture");
        assertEquals(CiErrorCode.TARGET_VERIFICATION_REQUIRED,code(assertThrows(WebApplicationException.class,
            ()->keys.withCredential("Bearer "+limited.credential(),"fixture","usage:read",(ctx,c)->{targets.requireGrants(ctx.owner(),ctx.targets(),"https://example.com",c);return null;}))));
    }
    @Test void invalidAuthBudgetIsCommittedAndClosedFeatureRejectsEveryCredential() throws Exception {
        var issued=issue();
        try(var pool=Executors.newFixedThreadPool(4)) {
            var barrier=new CyclicBarrier(4);var failures=new ArrayList<Future<?>>();
            for(int n=0;n<12;n++) failures.add(pool.submit(()->{barrier.await();unauthorized(()->keys.withCredential(null,"brute",null,(ctx,c)->ctx));return null;}));
            for(var failure:failures) failure.get(15,TimeUnit.SECONDS);
        }
        for(int n=0;n<48;n++) unauthorized(()->keys.withCredential(null,"brute",null,(ctx,c)->ctx));
        // An invalid caller sharing the proxy/runner peer cannot lock out this valid key.
        keys.withCredential("Bearer "+issued.credential(),"brute",null,(ctx,c)->ctx);
        unauthorized(()->keys.withCredential(null,"brute",null,(ctx,c)->ctx));
        clock.now=clock.instant().plusSeconds(900);
        keys.withCredential("Bearer "+issued.credential(),"brute",null,(ctx,c)->ctx);
        var closed=service(new CiPolicy(ConfigFactory.empty()));
        unauthorized(()->closed.withCredential("Bearer "+issued.credential(),"fixture",null,(ctx,c)->ctx));
        var freshAuth=login(owner);
        assertEquals(CiErrorCode.FEATURE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->closed.create(freshAuth,CSRF,input(null),"fixture"))));
    }
    @Test void realHttpRequiresApiKeyEverywhereAndManagementRequiresBrowserCsrf() throws Exception {
        var issued=issue();var json=new SafeJsonProvider();json.setMapper(mapper);
        var resources=new ResourceConfig().register(json).register(new CiKeyFilter(keys)).register(new CiIdentityWs())
            .register(new CiKeysWs(keys,new AccountCsrf(settings))).register(new CiResponseBoundary())
            .register(RequireExplicitAccessControlFeature.accessControlAnnotations(PublicApi.class,AccountAccess.class))
            .register(new PermissionFeature<>(new AccountPermissionProvider(sessions),AccountAccess.class,AccountAccess::value));
        var server=GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"),resources,false);
        for(var listener:server.getListeners()){listener.getTransport().setSelectorRunnersCount(1);listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));}
        server.start();
        try {
            String base="http://127.0.0.1:"+server.getListeners().iterator().next().getPort();var client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
            for(String path:List.of("/ci/v1/identity","/ci/v1/missing","/ci/v2/unknown","/ci/%76%31/identity",
                    "/ci;ignored=1/v1/identity","/ci;ignored=1/v1/missing")) {
                var response=client.send(HttpRequest.newBuilder(URI.create(base+path)).timeout(Duration.ofSeconds(5)).GET().build(),HttpResponse.BodyHandlers.ofString());
                assertEquals(401,response.statusCode(),path);assertEquals("AUTHENTICATION_FAILED",mapper.readTree(response.body()).path("error").path("code").asText());
            }
            for(String header:List.of(auth,"Bearer synthetic-existing","Basic administrator")) {
                var response=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/identity")).header("Authorization",header).GET().build(),HttpResponse.BodyHandlers.ofString());
                assertEquals(401,response.statusCode());assertFalse(response.body().contains(header));
            }
            var accepted=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/identity")).header("Authorization","Bearer "+issued.credential()).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(200,accepted.statusCode());assertFalse(accepted.body().contains(issued.credential()));
            assertEquals(issued.key().integrationId(),mapper.readTree(accepted.body()).path("integrationId").asText());
            var machineCannotManage=client.send(HttpRequest.newBuilder(URI.create(base+"/account/ci/keys")).header("Authorization","Bearer "+issued.credential()).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(401,machineCannotManage.statusCode());
            var denied=client.send(HttpRequest.newBuilder(URI.create(base+"/account/ci/keys")).header("Authorization",auth).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(input(null)))).build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(403,denied.statusCode());assertEquals("REQUEST_REJECTED",mapper.readTree(denied.body()).path("error").path("code").asText());
            keys.revoke(auth,CSRF,issued.key().id(),"fixture");
            var revoked=client.send(HttpRequest.newBuilder(URI.create(base+"/ci/v1/identity")).header("Authorization","Bearer "+issued.credential()).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(401,revoked.statusCode());assertEquals("private, no-store",revoked.headers().firstValue("cache-control").orElseThrow());
        } finally {server.shutdownNow();}
    }
    @Test void incorrectSecretCannotWaitOnOrHoldTheVictimsAccountLock() throws Exception {
        var issued=issue();String wrong="Bearer argos_ci_"+issued.key().id()+"."+"z".repeat(43);
        var expired=keys.create(auth,CSRF,new CiKeysService.Input("Short fixture",List.of("usage:read"),List.of(targetId),null,clock.instant().plusSeconds(1).toString()),"fixture");
        keys.revoke(auth,CSRF,issued.key().id(),"fixture");clock.now=clock.instant().plusSeconds(1);
        try(var c=source.getConnection();var pool=Executors.newSingleThreadExecutor()) {
            c.setAutoCommit(false);
            try(var s=c.prepareStatement("SELECT id FROM ARG_ACCOUNT_USER WHERE id=? FOR UPDATE")) {
                s.setLong(1,owner.getId());try(var r=s.executeQuery()){assertTrue(r.next());}
            }
            try {
                for(String invalid:List.of(wrong,"Bearer "+issued.credential(),"Bearer "+expired.credential())) {
                    var rejected=pool.submit(()->{try{keys.withCredential(invalid,"attacker",null,(ctx,connection)->ctx);return null;}
                        catch(WebApplicationException denied){return code(denied);}});
                    assertEquals(CiErrorCode.AUTHENTICATION_FAILED,rejected.get(5,TimeUnit.SECONDS));
                }
            }finally{c.rollback();}
        }
    }
}
