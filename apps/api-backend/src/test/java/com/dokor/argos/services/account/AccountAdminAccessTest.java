package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.AccountSession;
import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import java.sql.Connection;
import java.time.*;
import java.util.Map;
import java.util.List;
import com.dokor.argos.services.analytics.ProductAnalyticsDao;
import com.dokor.argos.services.analytics.ProductAnalyticsService;
import com.dokor.argos.webservices.api.account.AccountAnalyticsWs;
import com.dokor.argos.services.security.AdminReadAccess;
import java.util.function.Function;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Real JWT/session/role policy with a mocked registry; SQL/HTTP are covered by AccountLifecycleIT. */
class AccountAdminAccessTest {
    @Test void businessStatisticsRecheckLiveRoleAndSessionBeforeAggregation() {
        var aggregates=mock(com.dokor.argos.db.dao.AdminStatisticsDao.class);
        var snapshot=new com.dokor.argos.db.dao.AdminStatisticsDao.Snapshot(
            new com.dokor.argos.db.dao.AdminStatisticsDao.Accounts(0,0,0,0,0,0,0,0),
            new com.dokor.argos.db.dao.AdminStatisticsDao.Analyses(0,0,0,0,0,0,0),
            new com.dokor.argos.db.dao.AdminStatisticsDao.Domains(0,0));
        when(aggregates.read(eq(connection),any(),eq(now))).thenReturn(snapshot);
        var statistics=new AdminStatisticsService(sessions,aggregates,clock);
        assertEquals(now.minus(Duration.ofDays(7)),statistics.read(authorization,"7").from());
        assertNull(statistics.read(authorization,"all").from());
        assertEquals(400,assertThrows(AccountError.class,()->statistics.read(authorization,"365")).getResponse().getStatus());
        assertThrows(AccountError.class,()->statistics.read(null,"all"));
        assertThrows(AccountError.class,()->statistics.read("Bearer legacy-secret","all"));
        user.setRole("USER"); assertThrows(AccountError.class,()->statistics.read(authorization,"all"));
        user.setRole("ADMIN"); user.setState("PENDING"); assertThrows(AccountError.class,()->statistics.read(authorization,"all"));
        user.setState("SUSPENDED"); assertThrows(AccountError.class,()->statistics.read(authorization,"all"));
        user.setState("ARCHIVED"); assertThrows(AccountError.class,()->statistics.read(authorization,"all"));
        user.setState("ACTIVE"); session.setRevokedAt(now); assertThrows(AccountError.class,()->statistics.read(authorization,"all"));
        verify(aggregates,times(2)).read(eq(connection),nullable(Instant.class),eq(now));
    }
    @Test void measurementSettingsAndRunLookupsRejectNonAdminsAndForgedCsrfBeforeStorage() throws Exception {
        var control = new com.dokor.argos.services.analytics.ProductMeasurementControl(dao,sessions,clock,ConfigFactory.parseString("product-analytics.enabled=true"));
        session.setCsrfHash(new TokenService().sha256("c".repeat(43)));
        assertEquals(401,assertThrows(AccountError.class,()->control.read(null)).getResponse().getStatus());
        assertEquals(403,assertThrows(AccountError.class,()->control.change(authorization,"d".repeat(43),new com.dokor.argos.services.analytics.ProductMeasurementControl.Change(true,0L,true))).getResponse().getStatus());
        user.setRole("USER");
        assertEquals(403,assertThrows(AccountError.class,()->control.read(authorization)).getResponse().getStatus());
        assertEquals(403,assertThrows(AccountError.class,()->control.change(authorization,"c".repeat(43),new com.dokor.argos.services.analytics.ProductMeasurementControl.Change(true,0L,true))).getResponse().getStatus());
        assertThrows(AccountError.class,()->journal().runOptions(authorization,"user","Alice",20,null));
        verify(connection,never()).prepareStatement(anyString());
    }

    @Test void analysisListUsesOneIdentityJoinAndDropsRawUrls() throws Exception {
        var statement=mock(java.sql.PreparedStatement.class);var rows=mock(java.sql.ResultSet.class);var meta=mock(java.sql.ResultSetMetaData.class);
        when(connection.prepareStatement(anyString())).thenReturn(statement);when(statement.executeQuery()).thenReturn(rows);when(rows.getMetaData()).thenReturn(meta);
        var names=List.of("id","userId","site","rawTarget","resolvedUserId","userDisplayName","userEmail","batchId","pageCount");
        var values=java.util.Arrays.asList(42L,10L,"www.example.com","https://www.example.com/catalogue?token=secret#private",10L,"Alice","alice@example.com",null,null);
        when(meta.getColumnCount()).thenReturn(names.size());for(int i=0;i<names.size();i++){when(meta.getColumnLabel(i+1)).thenReturn(names.get(i));when(rows.getObject(i+1)).thenReturn(values.get(i));}
        when(rows.next()).thenReturn(true,false);
        var result=journal().runs(authorization,"anonymous","www.example.com","FAILED","2026-10-01","2026-10-16",20,null);
        assertEquals("https://www.example.com/catalogue",result.items().getFirst().get("displayUrl"));
        assertEquals("Alice",result.items().getFirst().get("userDisplayName"));assertFalse(result.items().getFirst().containsKey("rawTarget"));
        var sql=org.mockito.ArgumentCaptor.forClass(String.class);verify(connection,times(1)).prepareStatement(sql.capture());
        assertTrue(sql.getValue().contains("LEFT JOIN ARG_ACCOUNT_USER"));assertTrue(sql.getValue().contains("u.state<>'ARCHIVED'"));
        assertTrue(sql.getValue().contains("r.owner_user_id IS NULL"));assertTrue(sql.getValue().contains("d.hostname=?"));
    }
    @Test void connectedProfilesUseTheRealPolicyAndRequireAnActiveVerifiedSession() {
        var policy = new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy();
        var profiles = new com.dokor.argos.services.connected.ConnectedProfiles(policy);
        var endpoint = new com.dokor.argos.webservices.api.account.ConnectedProfilesWs(sessions, profiles);
        user.setRole("USER");
        var response = endpoint.get(authorization);
        assertEquals(200, response.getStatus());
        assertEquals("private, no-store", response.getHeaderString("Cache-Control"));
        var catalogue = (com.dokor.argos.services.connected.contract.ConnectedContracts.AnalysisProfiles) response.getEntity();
        assertEquals(1, catalogue.items().size());
        assertEquals("server-default-v1", catalogue.defaultProfileId());
        assertEquals(policy.fingerprint(), catalogue.items().getFirst().snapshot().scoringFingerprint());
        assertEquals(policy.version(), catalogue.items().getFirst().snapshot().scoringVersion());
        assertThrows(AccountError.class, () -> profiles.snapshot("mobile-v1"));
        assertThrows(AccountError.class, () -> endpoint.get(null));
        user.setState("PENDING");
        assertEquals(403, assertThrows(AccountError.class, () -> endpoint.get(authorization)).getResponse().getStatus());
        user.setState("ARCHIVED");
        assertEquals(401, assertThrows(AccountError.class, () -> endpoint.get(authorization)).getResponse().getStatus());
    }
    private final Instant now = Instant.parse("2026-10-13T08:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);
    private final AccountDao dao = mock(AccountDao.class);
    private final Connection connection = mock(Connection.class);
    private final AccountSettings settings = new AccountSettings(ConfigFactory.parseMap(
            Map.of("account.enabled", true, "account.jwt-secret", "s".repeat(64))));
    private final AccountSessionSigner signer = new AccountSessionSigner(settings, new ObjectMapper(), clock);
    private final AccountSessionService sessions = new AccountSessionService(dao, signer, new TokenService(), settings, clock);
    private AccountUser user;
    private AccountSession session;
    private String authorization;

    @BeforeEach void prepare() {
        user = new AccountUser(); user.setId(1L); user.setState("ACTIVE"); user.setRole("ADMIN");
        session = new AccountSession(); session.setId(2L); session.setUserId(1L);
        session.setExpiresAt(now.plusSeconds(3600)); session.setLastActivityAt(now);
        when(dao.user(1L, connection, true)).thenReturn(user);
        when(dao.session(2L, connection, true)).thenReturn(session);
        when(dao.transaction(any())).thenAnswer(invocation -> {
            Function<Connection, ?> work = invocation.getArgument(0);
            return work.apply(connection);
        });
        authorization = "Bearer " + signer.issue(1L, 2L);
    }

    private void authorize(String bearer) {
        sessions.with(bearer, null, true, false, (ctx, c) -> {
            AdminService.requireAdmin(ctx);
            return null;
        });
    }

    private void denied(int status, String bearer) {
        var error = assertThrows(AccountError.class, () -> authorize(bearer));
        assertEquals(status, error.getResponse().getStatus());
        assertEquals("private, no-store", error.getResponse().getHeaderString("Cache-Control"));
    }

    @Test void onlyTheCurrentActiveAdministratorIsAllowed() {
        authorize(authorization);
        user.setRole("USER");
        denied(403, authorization); // Same signed JWT, role removed in the registry.
        user.setRole("ADMIN"); user.setState("PENDING");
        denied(403, authorization);
        user.setState("ARCHIVED");
        denied(401, authorization);
    }

    @Test void metricsEndpointRechecksTheAccountSessionAndCurrentRole() {
        var metricsDao = mock(ProductAnalyticsDao.class);
        when(metricsDao.sample(any(), any())).thenReturn(new ProductAnalyticsDao.Sample(List.of(), List.of(), false));
        var analytics = new ProductAnalyticsService(ConfigFactory.parseString("product-analytics.enabled=false"),
            metricsDao, mock(AdminReadAccess.class), mock(com.dokor.argos.db.dao.AuditReportDao.class), new TokenService());
        var endpoint = new AccountAnalyticsWs(sessions, analytics, mock(com.dokor.argos.services.analytics.ProductMeasurementControl.class), new AccountCsrf(settings));
        assertEquals(200, endpoint.metrics(30, authorization).getStatus());
        for (String state : List.of("USER", "PENDING", "ARCHIVED", "REVOKED", "EXPIRED")) {
            user.setState("ACTIVE"); user.setRole("ADMIN"); session.setRevokedAt(null); session.setExpiresAt(now.plusSeconds(3600));
            switch (state) {
                case "USER" -> user.setRole("USER");
                case "PENDING", "ARCHIVED" -> user.setState(state);
                case "REVOKED" -> session.setRevokedAt(now);
                case "EXPIRED" -> session.setExpiresAt(now);
            }
            assertThrows(AccountError.class, () -> endpoint.metrics(30, authorization), state);
        }
        assertThrows(AccountError.class, () -> endpoint.metrics(30, null));
        assertThrows(AccountError.class, () -> endpoint.metrics(30, "Bearer legacy-secret"));
        verify(metricsDao, times(1)).sample(any(), any());
    }

    @Test void anonymousForgedAndLegacyCredentialsNeverAuthorizeAccountAdministration() {
        denied(401, null);
        denied(401, "Bearer synthetic-legacy-server-secret");
        denied(401, "Bearer " + signer.issue(1L, 2L) + "forged");
        verify(dao, never()).user(anyLong(), any(), anyBoolean());
        verify(dao, never()).session(anyLong(), any(), anyBoolean());
    }

    @ParameterizedTest @ValueSource(strings = {"jwt-expired", "session-expired", "idle-expired", "revoked", "wrong-owner", "missing-session", "missing-user"})
    void staleOrInvalidSessionsNeverReachAdministrativeWork(String state) {
        switch (state) {
            case "jwt-expired" -> authorization = "Bearer " + new AccountSessionSigner(settings, new ObjectMapper(),
                    Clock.fixed(now.minusSeconds(901), ZoneOffset.UTC)).issue(1L, 2L);
            case "session-expired" -> session.setExpiresAt(now);
            case "idle-expired" -> session.setLastActivityAt(now.minus(settings.idleTtl()));
            case "revoked" -> session.setRevokedAt(now);
            case "wrong-owner" -> session.setUserId(3L);
            case "missing-session" -> when(dao.session(2L, connection, true)).thenReturn(null);
            case "missing-user" -> when(dao.user(1L, connection, true)).thenReturn(null);
            default -> throw new AssertionError(state);
        }
        denied(401, authorization);
    }

    private AdminService journal() {
        return new AdminService(dao,sessions,null,null,null,new ObjectMapper(),clock);
    }

    @Test void journalReadsRequireAnActiveAdministratorBeforeQueryingIdentities() throws Exception {
        assertThrows(AccountError.class,()->journal().events(null,10,null));
        user.setRole("USER");
        assertThrows(AccountError.class,()->journal().events(authorization,10,null));
        user.setRole("ADMIN");user.setState("ARCHIVED");
        assertThrows(AccountError.class,()->journal().events(authorization,10,null));
        verify(connection,never()).prepareStatement(anyString());
    }

    @Test void journalProjectsCurrentIdentitiesAndExactIdsWithOneStatementPerPage() throws Exception {
        var statement=mock(java.sql.PreparedStatement.class);
        var rows=mock(java.sql.ResultSet.class);
        var meta=mock(java.sql.ResultSetMetaData.class);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(rows);when(rows.getMetaData()).thenReturn(meta);
        var names=List.of("id","actorId","targetId","actorDisplayName","actorEmail","targetDisplayName","targetEmail");
        when(meta.getColumnCount()).thenReturn(names.size());
        Object[] values={9L,9007199254740993L,9007199254740993L,"Admin","admin@example.com",null,null};
        for(int n=1;n<=names.size();n++){when(meta.getColumnLabel(n)).thenReturn(names.get(n-1));when(rows.getObject(n)).thenReturn(values[n-1]);}
        when(rows.next()).thenReturn(true,false);
        var page=journal().events(authorization,10,null);
        assertEquals("9007199254740993",page.items().getFirst().get("actorId"));
        assertEquals("Admin",page.items().getFirst().get("actorDisplayName"));
        assertEquals("admin@example.com",page.items().getFirst().get("actorEmail"));
        assertNull(page.items().getFirst().get("targetDisplayName"));assertNull(page.items().getFirst().get("targetEmail"));
        assertNull(page.nextCursor());
        verify(connection,times(1)).prepareStatement(argThat(sql->sql.contains("LEFT JOIN ARG_ACCOUNT_USER actor")&&sql.contains("LEFT JOIN ARG_ACCOUNT_USER target")&&sql.contains("actor.state<>'ARCHIVED'")&&sql.contains("target.state<>'ARCHIVED'")));
    }

    @Test void disabledAccountsCannotInitializeAnAdministrativeSession() {
        var disabled = new AccountSettings(ConfigFactory.parseMap(Map.of("account.enabled", false)));
        var disabledSigner = new AccountSessionSigner(disabled, new ObjectMapper(), clock);
        var error = assertThrows(AccountError.class, () -> disabledSigner.parseSession(authorization.substring(7), ArgosWebSession.class));
        assertEquals(503, error.getResponse().getStatus());
    }
}
