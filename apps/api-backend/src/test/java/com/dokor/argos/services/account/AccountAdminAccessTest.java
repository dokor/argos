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
import com.dokor.argos.webservices.api.audits.AdminReadAccess;
import java.util.function.Function;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Real JWT/session/role policy with a mocked registry; SQL/HTTP are covered by AccountLifecycleIT. */
class AccountAdminAccessTest {
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
        var endpoint = new AccountAnalyticsWs(sessions, analytics);
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

    @Test void disabledAccountsCannotInitializeAnAdministrativeSession() {
        var disabled = new AccountSettings(ConfigFactory.parseMap(Map.of("account.enabled", false)));
        var disabledSigner = new AccountSessionSigner(disabled, new ObjectMapper(), clock);
        var error = assertThrows(AccountError.class, () -> disabledSigner.parseSession(authorization.substring(7), ArgosWebSession.class));
        assertEquals(503, error.getResponse().getStatus());
    }
}
