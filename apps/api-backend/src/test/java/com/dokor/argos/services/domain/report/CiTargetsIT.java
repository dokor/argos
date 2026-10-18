package com.dokor.argos.services.domain.report;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.*;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.WebApplicationException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CiTargetsIT extends MariaDbReportFixture {
    private static final String CSRF="c".repeat(43);
    private AccountLifecycleIT.MutableClock clock;
    private AccountDao dao;
    private AccountSessionService sessions;
    private CiTargetsService targets;
    private HttpsTargetProofClient proofs;
    private AccountUser owner;
    private String auth;
    @BeforeEach void ciRegistry() {
        clock=new AccountLifecycleIT.MutableClock();clock.now=Instant.parse("2026-10-18T12:00:00Z");
        var config=ConfigFactory.parseString("premium-ci.enabled=true\naccount.enabled=true\naccount.jwt-secret=\""+"s".repeat(64)+"\"").withFallback(ConfigFactory.load());
        var settings=new AccountSettings(config);
        dao=new AccountDao(new TransactionManagerQuerydsl(source,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT)));
        sessions=new AccountSessionService(dao,new AccountSessionSigner(settings,mapper,clock),tokens,settings,clock);
        var entitlement=new CiEntitlementService(new CiPolicy(config),new UsageService(dao.transactions,new UsagePolicy(config),clock),clock);
        var operations=new CiAccountOperations(sessions,new AccountRateLimiter(dao,tokens,clock,settings),entitlement);
        proofs=mock(HttpsTargetProofClient.class);
        targets=new CiTargetsService(dao,operations,new CiPolicy(config),entitlement,proofs,tokens,clock);
        owner=dao.transaction(c->{var u=new AccountUser();u.setEmail("targets@example.com");u.setDisplayName("Targets");u.setState("ACTIVE");u.setOffer("PREMIUM");u.setRole("USER");u.setCreatedAt(clock.instant());return dao.save(u,c);});
        try {sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES("+owner.getId()+",1,'2027-10-18',NOW())");}
        catch(Exception failed){throw new IllegalStateException(failed);}
        login();
    }
    private void login() {auth="Bearer "+dao.transaction(c->sessions.create(owner,CSRF,c)).jwt();}
    private CiTargetsService.Challenge create(String origin) {return targets.create(auth,CSRF,origin,"fixture");}
    private String verified(String origin) {
        var challenge=create(origin);when(proofs.matches(anyString(),anyString(),any())).thenReturn(true);
        assertEquals("VERIFIED",targets.verify(auth,CSRF,challenge.target().id(),"fixture").state());return challenge.target().id();
    }
    private CiErrorCode code(WebApplicationException e) {return ((CiErrors.Envelope)e.getResponse().getEntity()).error().code();}
    @Test void proofIsBoundToOwnerAndOriginAndSecretCannotBeReadBack() {
        var challenge=create("https://example.com");
        assertEquals("PENDING",challenge.target().state());assertTrue(challenge.content().startsWith("argos-ci-v1="));
        var row=dao.transactions.selectQuery().select(QCiTarget.table).from(QCiTarget.table).fetchOne();
        assertArrayEquals(tokens.sha256(challenge.content()),row.getChallengeHash());
        assertFalse(targets.list(auth,0).toString().contains(challenge.content()));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->dao.transaction(c->targets.grants(owner.getId()+1,List.of(challenge.target().id()),c)))));
        assertEquals(CiErrorCode.RESOURCE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,
            ()->dao.transaction(c->targets.grants(owner.getId(),List.of(UUID.randomUUID().toString()),c)))));
        assertEquals(CiErrorCode.TARGET_VERIFICATION_REQUIRED,code(assertThrows(WebApplicationException.class,
            ()->dao.transaction(c->targets.grants(owner.getId(),List.of(challenge.target().id()),c)))));
    }
    @Test void expiryRenewalAndRevocationNeverTransferScopeOrResurrectAnOldGrant() {
        String id=verified("https://example.com");
        var grants=dao.transaction(c->targets.grants(owner.getId(),List.of(id),c));
        verified("https://www.example.com");
        dao.transaction(c->{targets.requireGrants(owner.getId(),grants,"https://example.com/path",c);return null;});
        assertEquals(CiErrorCode.TARGET_REJECTED,code(assertThrows(WebApplicationException.class,
            ()->dao.transaction(c->{targets.requireGrants(owner.getId(),grants,"https://www.example.com",c);return null;}))));
        targets.revoke(auth,CSRF,id,"fixture");targets.renew(auth,CSRF,id,"fixture");targets.verify(auth,CSRF,id,"fixture");
        assertEquals(CiErrorCode.TARGET_VERIFICATION_REQUIRED,code(assertThrows(WebApplicationException.class,
            ()->dao.transaction(c->{targets.requireGrants(owner.getId(),grants,"https://example.com",c);return null;}))));
        clock.now=clock.instant().plus(Duration.ofDays(7));login();
        assertEquals("EXPIRED",targets.list(auth,0).items().getFirst().state());
    }
    @Test void expiredChallengeCannotVerifyAndRenewInvalidatesAnInflightResponse() {
        var challenge=create("https://example.com");clock.now=clock.instant().plus(Duration.ofDays(1));login();
        assertEquals(CiErrorCode.TARGET_VERIFICATION_REQUIRED,code(assertThrows(WebApplicationException.class,
            ()->targets.verify(auth,CSRF,challenge.target().id(),"fixture"))));
        targets.renew(auth,CSRF,challenge.target().id(),"fixture");
        when(proofs.matches(anyString(),anyString(),any())).thenAnswer(invocation->{targets.renew(auth,CSRF,challenge.target().id(),"fixture");return true;});
        assertEquals(CiErrorCode.TARGET_VERIFICATION_REQUIRED,code(assertThrows(WebApplicationException.class,
            ()->targets.verify(auth,CSRF,challenge.target().id(),"fixture"))));
        assertEquals("PENDING",targets.list(auth,0).items().getFirst().state());
    }
    @Test void recheckClosesOnControlLossAndRecoversWithoutNewAuditOrReservation() {
        verified("https://tenant.github.io");clock.now=clock.instant().plus(Duration.ofDays(1));
        when(proofs.matches(anyString(),anyString(),any())).thenReturn(false);targets.tick();login();
        assertEquals("EXPIRED",targets.list(auth,0).items().getFirst().state());
        clock.now=clock.instant().plus(Duration.ofMinutes(5));when(proofs.matches(anyString(),anyString(),any())).thenReturn(true);targets.tick();login();
        assertEquals("VERIFIED",targets.list(auth,0).items().getFirst().state());
        assertTrue(dao.transactions.selectQuery().select(QUsageRun.table).from(QUsageRun.table).fetch().isEmpty());
    }
    @Test void invalidCsrfStaleAuthenticationAndDowngradeCannotStartProofTraffic() throws Exception {
        assertEquals(CiErrorCode.REQUEST_REJECTED,code(assertThrows(WebApplicationException.class,()->targets.create(auth,null,"https://example.com","fixture"))));
        clock.now=clock.instant().plus(Duration.ofMinutes(6));
        assertEquals(CiErrorCode.REAUTHENTICATION_REQUIRED,code(assertThrows(WebApplicationException.class,()->create("https://example.com"))));
        login();sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id="+owner.getId());
        assertEquals(CiErrorCode.FEATURE_NOT_AVAILABLE,code(assertThrows(WebApplicationException.class,()->create("https://example.com"))));
        verifyNoInteractions(proofs);
    }
}
