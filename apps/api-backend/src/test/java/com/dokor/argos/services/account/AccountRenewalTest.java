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

class AccountRenewalTest {
    private static final Instant START = Instant.parse("2026-10-27T08:00:00Z");
    private static final String CSRF = "c".repeat(43);
    private final Clock clock = mock(Clock.class);
    private final AccountDao dao = mock(AccountDao.class);
    private final Connection connection = mock(Connection.class);
    private final AccountSettings settings = new AccountSettings(ConfigFactory.parseMap(Map.of(
            "account.enabled", true, "account.jwt-secret", "s".repeat(64))));
    private final AccountSessionSigner signer = new AccountSessionSigner(settings, new ObjectMapper(), clock);
    private final AccountSessionService sessions = new AccountSessionService(dao, signer, new TokenService(), settings, clock);
    private AccountSession session;
    private AccountUser user;
    private String access;
    private String renewal;

    @BeforeEach void registry() {
        when(clock.instant()).thenReturn(START);
        when(clock.millis()).thenAnswer(call -> clock.instant().toEpochMilli());
        when(dao.transaction(any())).thenAnswer(call -> call.<Function<Connection, ?>>getArgument(0).apply(connection));
        user = new AccountUser(); user.setId(1L); user.setState("ACTIVE");
        session = new AccountSession(); session.setId(2L); session.setUserId(1L);
        session.setCreatedAt(START); session.setAuthenticatedAt(START); session.setLastActivityAt(START);
        session.setExpiresAt(START.plus(settings.absoluteTtl()));
        session.setCsrfHash(new TokenService().sha256(CSRF));
        when(dao.user(1L, connection, true)).thenReturn(user);
        when(dao.session(2L, connection, true)).thenReturn(session);
        access = signer.issue(1L, 2L);
        renewal = sessions.renewal(new AccountSessionService.Context(user, session));
    }

    @Test void resumesAfterSleepUntilTheAbsolute24HourBoundary() {
        assertEquals(Duration.ofHours(24), settings.absoluteTtl());
        assertEquals(Duration.ofHours(24), settings.idleTtl());
        when(clock.instant()).thenReturn(START.plus(Duration.ofHours(23)));
        assertNull(signer.parseSession(access, ArgosWebSession.class));
        var resumed = sessions.renew(null, renewal, CSRF);
        assertNotNull(signer.parseSession(resumed.jwt(), ArgosWebSession.class));
        assertEquals(START, resumed.context().session().getAuthenticatedAt());
        assertEquals(START, resumed.context().session().getLastActivityAt());
        assertEquals(START.plus(Duration.ofHours(24)),
                Instant.ofEpochSecond(signer.parseRenewal(sessions.renewal(resumed.context())).exp()));
        when(clock.instant()).thenReturn(START.plus(Duration.ofHours(24)).minusMillis(1));
        assertNotNull(sessions.renew(null, renewal, CSRF));
        when(clock.instant()).thenReturn(START.plus(Duration.ofHours(24)));
        unauthorized(() -> sessions.renew(null, renewal, CSRF));
    }

    @Test void renewalCredentialsCannotAuthenticateNormalReadsOrBeReplacedByAccessTokens() {
        assertNull(signer.parseSession(renewal, ArgosWebSession.class));
        assertNull(signer.parseRenewal(access));
        unauthorized(() -> sessions.require("Bearer " + renewal, null, false, false, connection));
        unauthorized(() -> sessions.renew(null, access, CSRF));
        assertNotNull(sessions.renew("Bearer " + access, null, CSRF));
    }

    @Test void liveRegistryAndCsrfAlwaysOverrideTheRenewalSignature() {
        assertEquals(403, assertThrows(AccountError.class, () -> sessions.renew(null, renewal, "d".repeat(43))).getResponse().getStatus());
        session.setRevokedAt(START); unauthorized(() -> sessions.renew(null, renewal, CSRF));
        session.setRevokedAt(null); session.setExpiresAt(START); unauthorized(() -> sessions.renew(null, renewal, CSRF));
        session.setExpiresAt(START.plusSeconds(86400));
        for (String state : new String[] {"ARCHIVED", "SUSPENDED"}) {
            user.setState(state); unauthorized(() -> sessions.renew(null, renewal, CSRF));
        }
        user.setState("ACTIVE"); session.setUserId(99L); unauthorized(() -> sessions.renew(null, renewal, CSRF));
    }

    @Test void wrongSignatureIssuerAudienceUsageAndMissingExpiryAreRejected() {
        for (var claim : new ArgosWebSession[] {
                new ArgosWebSession("wrong", "argos-account", "account-renewal", 1L, 2L, null),
                new ArgosWebSession("argos-account", "wrong", "account-renewal", 1L, 2L, null),
                new ArgosWebSession("argos-account", "argos-account", "account", 1L, 2L, null)}) {
            assertNull(signer.parseRenewal(signer.serializeSession(claim, START.plusSeconds(86400).toEpochMilli())));
        }
        var claim = new ArgosWebSession("argos-account", "argos-account", "account-renewal", 1L, 2L, null);
        assertNull(signer.parseRenewal(signer.serializeSession(claim, null)));
        var other = new AccountSessionSigner(new AccountSettings(ConfigFactory.parseMap(Map.of(
                "account.enabled", true, "account.jwt-secret", "x".repeat(64)))), new ObjectMapper(), clock);
        assertNull(signer.parseRenewal(other.issueRenewal(1L, 2L, START.plusSeconds(86400))));
    }

    private static void unauthorized(Runnable action) {
        assertEquals(401, assertThrows(AccountError.class, action::run).getResponse().getStatus());
    }
}
