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
import java.util.function.Function;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Real JWT/session/role policy with a mocked registry; SQL/HTTP are covered by AccountLifecycleIT. */
class AccountAdminAccessTest {
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
