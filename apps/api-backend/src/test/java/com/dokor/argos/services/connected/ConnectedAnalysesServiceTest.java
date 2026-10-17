package com.dokor.argos.services.connected;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.token.TokenService;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.sql.Connection;
import java.util.HexFormat;
import java.util.function.BiFunction;
import com.querydsl.sql.SQLQuery;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConnectedAnalysesServiceTest {
    private static final String KEY="12345678-1234-1234-1234-123456789012";
    private final TransactionManagerQuerydsl tx=mock(TransactionManagerQuerydsl.class);
    @SuppressWarnings("unchecked") private final SQLQuery<AuditRun> query=mock(SQLQuery.class,RETURNS_SELF);
    private final Connection connection=mock(Connection.class);
    private final AccountSessionService sessions=mock(AccountSessionService.class);
    private final AuditService audits=mock(AuditService.class);
    private final AccountSitesService sites=mock(AccountSitesService.class);
    private final UrlNormalizer normalizer=mock(UrlNormalizer.class);
    private final TokenService tokens=new TokenService();
    private ConnectedAnalysesService service;
    private AccountUser user;
    @BeforeEach void setup() {
        doReturn(query).when(tx).selectQuery(connection);
        when(query.select(QAuditRun.auditRun)).thenReturn(query);
        user=new AccountUser();user.setId(10L);
        when(sessions.with(anyString(),nullable(String.class),eq(true),anyBoolean(),any())).thenAnswer(call->{
            BiFunction<AccountSessionService.Context,Connection,?> work=call.getArgument(4);
            return work.apply(new AccountSessionService.Context(user,new AccountSession()),connection);
        });
        service=new ConnectedAnalysesService(new AccountDao(tx),sessions,sites,audits,normalizer,
            new ConnectedProfiles(new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy()),new ObjectMapper(),tokens);
    }
    private void stored(AuditRun run) {
        when(query.fetchOne()).thenReturn(run);
    }
    private AuditRun run(String status) {
        var run=new AuditRun();run.setId(42L);run.setStatus(status);
        run.setRequestFingerprint(HexFormat.of().formatHex(tokens.sha256("https://example.com/page\nserver-default-v1")));
        return run;
    }
    @ParameterizedTest @ValueSource(strings={"QUEUED","RUNNING","COMPLETED","FAILED"})
    void replayAndRecoveryDoNotNeedWorkingDnsOrReserveAgain(String status) {
        stored(run(status));
        when(normalizer.normalize(anyString())).thenThrow(new IllegalArgumentException("DNS unavailable"));
        var input=new SiteAnalysisInput("HTTPS://EXAMPLE.COM:443/section/../page#fragment","server-default-v1");
        assertEquals("42",service.create("auth","csrf",KEY,input).runId());
        assertEquals(status,service.get("auth",KEY).status().name());
        verifyNoInteractions(normalizer,audits,sites);
    }
    @Test void conflictingReplayStillFailsWithoutDns() {
        stored(run("QUEUED"));
        var error=assertThrows(AccountError.class,()->service.create("auth","csrf",KEY,new SiteAnalysisInput("https://example.com/other","server-default-v1")));
        assertEquals(409,error.getResponse().getStatus());verifyNoInteractions(normalizer,audits,sites);
    }
    @Test void newAdmissionStillChecksDnsAndCannotReserveABlockedTarget() {
        when(normalizer.normalize(anyString())).thenThrow(new IllegalArgumentException("Target blocked"));
        var error=assertThrows(AccountError.class,()->service.create("auth","csrf",KEY,new SiteAnalysisInput("https://example.com","server-default-v1")));
        assertEquals(400,error.getResponse().getStatus());verify(normalizer).normalize("https://example.com");
        verifyNoInteractions(audits,sites);
    }
    @Test void syntaxRefusesPrivateTargetsBeforeLookingUpAnIdempotencyKey() {
        var error=assertThrows(AccountError.class,()->service.create("auth","csrf",KEY,new SiteAnalysisInput("http://127.0.0.1","server-default-v1")));
        assertEquals(400,error.getResponse().getStatus());
        verifyNoInteractions(query,normalizer,audits,sites);
    }
    @Test void recoveryCannotReadAnotherOwnerOrAcceptAnInvalidKey() {
        stored(run("QUEUED"));user.setId(20L);
        when(query.fetchOne()).thenReturn(null);
        assertEquals(404,assertThrows(AccountError.class,()->service.get("auth",KEY)).getResponse().getStatus());
        verify(query).where(QAuditRun.auditRun.ownerUserId.eq(20L),QAuditRun.auditRun.idempotencyKey.eq(KEY));
        assertEquals(400,assertThrows(AccountError.class,()->service.get("auth","bad-key")).getResponse().getStatus());
        verifyNoInteractions(normalizer,audits,sites);
    }
}
