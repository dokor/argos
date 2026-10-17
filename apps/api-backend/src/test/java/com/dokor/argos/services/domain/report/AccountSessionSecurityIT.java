package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.AccountSession;
import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.services.account.*;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.*;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

/** Real registry transactions; fixed time and bounded waits, without sleeps or provider calls. */
class AccountSessionSecurityIT extends MariaDbReportFixture {
    private static final String CSRF = "c".repeat(43);
    private static final Instant START = Instant.parse("2026-10-17T08:00:00Z");

    private static class MutableClock extends Clock {
        volatile Instant now = START;
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private MutableClock clock;
    private AccountDao dao;
    private AccountSessionService sessions;
    private AccountSessionSigner signer;
    private AccountSettings settings;
    private AccountUser user;
    private AccountSessionService.Issued issued;

    @BeforeEach
    void sessionRegistry() {
        clock = new MutableClock();
        settings = new AccountSettings(ConfigFactory.parseMap(Map.of(
                "account.enabled", true, "account.jwt-secret", "s".repeat(64))));
        dao = new AccountDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
        signer = new AccountSessionSigner(settings, mapper, clock);
        sessions = new AccountSessionService(dao, signer, tokens, settings, clock);
        issued = dao.transaction(c -> {
            user = new AccountUser();
            user.setEmail("session-security@example.com");
            user.setDisplayName("Session fixture");
            user.setState("ACTIVE");
            user.setRole("USER");
            user.setOffer("FREE");
            user.setCreatedAt(clock.instant());
            dao.save(user, c);
            return sessions.create(user, CSRF, c);
        });
    }

    enum Deadline { JWT, IDLE, ABSOLUTE }

    @ParameterizedTest
    @EnumSource(Deadline.class)
    void deadlinesRejectAtTheExactBoundaryWithNoClockSkew(Deadline kind) {
        Instant deadline = START.plus(kind == Deadline.JWT ? settings.jwtTtl() : Duration.ofSeconds(60));
        dao.transaction(c -> {
            var session = dao.session(issued.context().session().getId(), c, true);
            if (kind == Deadline.IDLE) session.setLastActivityAt(deadline.minus(settings.idleTtl()));
            if (kind == Deadline.ABSOLUTE) session.setExpiresAt(deadline);
            dao.save(session, c);
            return null;
        });
        var before = stored();
        clock.now = deadline.minusMillis(1);
        assertAccepted(issued.jwt());
        String renewed = sessions.renew(bearer(issued.jwt()), CSRF);
        assertUnchanged(before, stored());
        clock.now = deadline;
        assertRejected(issued.jwt());
        // A fresh JWT cannot extend either registry deadline.
        if (kind != Deadline.JWT) assertRejected(renewed);
        clock.now = deadline.plusMillis(1);
        assertRejected(issued.jwt());
    }

    @Test
    void repeatedRenewalsDoNotCountAsBusinessActivityOrRecentAuthentication() {
        var before = stored();
        String current = issued.jwt();
        for (int minute : new int[] {10, 20, 29}) {
            clock.now = START.plusSeconds(minute * 60L);
            current = sessions.renew(bearer(current), CSRF);
            var context = assertAccepted(current);
            var error = assertThrows(AccountError.class, () -> sessions.recent(context));
            assertEquals(403, error.getResponse().getStatus());
            assertUnchanged(before, stored());
        }
        clock.now = START.plus(settings.idleTtl());
        assertNotNull(signer.parseSession(current, ArgosWebSession.class));
        assertRejected(current);
    }

    @Test
    void businessActivityMovesOnlyTheIdleDeadlineAndNeverTheAbsoluteDeadline() {
        Instant absolute = START.plus(settings.absoluteTtl());
        String current = issued.jwt();
        for (int minute = 10; minute < 720; minute += 10) {
            clock.now = START.plusSeconds(minute * 60L);
            sessions.with(bearer(current), null, true, true, (ctx, c) -> null);
            current = sessions.renew(bearer(current), CSRF);
            assertEquals(clock.instant(), stored().getLastActivityAt());
            assertEquals(absolute, stored().getExpiresAt());
            assertEquals(START, stored().getAuthenticatedAt());
        }
        clock.now = absolute.minusMillis(1);
        String renewed = sessions.renew(bearer(current), CSRF);
        assertAccepted(renewed);
        clock.now = absolute;
        assertRejected(renewed);
    }

    @Test
    void concurrentTabsShareOneRevocableRegistryAndKeepOldJwtUntilItsExpiry() throws Exception {
        clock.now = START.plusSeconds(600);
        var before = stored();
        var gate = new CyclicBarrier(4);
        var renewed = new ArrayList<String>();
        try (var pool = Executors.newFixedThreadPool(4)) {
            var tasks = new ArrayList<Future<String>>();
            for (int tab = 0; tab < 4; tab++) tasks.add(pool.submit(() -> {
                gate.await(10, TimeUnit.SECONDS);
                return sessions.renew(bearer(issued.jwt()), CSRF);
            }));
            for (var task : tasks) renewed.add(task.get(15, TimeUnit.SECONDS));
        }
        assertUnchanged(before, stored());
        assertAccepted(issued.jwt());
        for (String jwt : renewed) {
            var claim = signer.parseSession(jwt, ArgosWebSession.class);
            assertEquals(user.getId(), claim.uid());
            assertEquals(before.getId(), claim.sid());
            assertAccepted(jwt);
        }
        clock.now = START.plus(settings.jwtTtl());
        assertRejected(issued.jwt());
        for (String jwt : renewed) assertAccepted(jwt);
        revoke(renewed.getFirst());
        for (String jwt : renewed) assertRejected(jwt);
    }

    enum Invalidation { LOGOUT, RESET, ARCHIVE }

    @ParameterizedTest
    @EnumSource(Invalidation.class)
    void renewalInFlightCannotResurrectAnInvalidatedSession(Invalidation action) throws Exception {
        // Pause issuance after validation while the renewal owns the real account/session locks.
        var validated = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var invalidationStarted = new CountDownLatch(1);
        var pausingSigner = new AccountSessionSigner(settings, mapper, clock) {
            @Override public String issue(long uid, long sid) {
                validated.countDown();
                await(release);
                return super.issue(uid, sid);
            }
        };
        var renewing = new AccountSessionService(dao, pausingSigner, tokens, settings, clock);
        var auth = new AccountAuthService(dao, new AccountPasswords(settings), sessions, tokens,
                settings, (recipient, message) -> {}, clock);
        if (action == Invalidation.RESET) dao.transaction(c -> {
            var identity = new com.dokor.argos.db.generated.AccountIdentity();
            identity.setUserId(user.getId());
            identity.setProvider("password");
            identity.setSubject(user.getId().toString());
            identity.setPasswordHash("unused-before-reset");
            identity.setCreatedAt(clock.instant());
            dao.save(identity, c);
            var token = new com.dokor.argos.db.generated.AccountToken();
            token.setUserId(user.getId());
            token.setPurpose("RESET");
            token.setTokenHash(tokens.sha256("r".repeat(43)));
            token.setExpiresAt(clock.instant().plusSeconds(60));
            dao.save(token, c);
            return null;
        });
        try (var pool = Executors.newFixedThreadPool(2)) {
            var renewal = pool.submit(() -> renewing.renew(bearer(issued.jwt()), CSRF));
            try {
                assertTrue(validated.await(10, TimeUnit.SECONDS));
                var invalidation = pool.submit(() -> {
                    invalidationStarted.countDown();
                    switch (action) {
                        case LOGOUT -> revoke();
                        case RESET -> auth.reset("r".repeat(43), "a long synthetic reset passphrase");
                        case ARCHIVE -> auth.archive(bearer(issued.jwt()), CSRF, true);
                    }
                });
                assertTrue(invalidationStarted.await(10, TimeUnit.SECONDS));
                release.countDown();
                String lateJwt = renewal.get(15, TimeUnit.SECONDS);
                invalidation.get(15, TimeUnit.SECONDS);
                assertNotNull(signer.parseSession(lateJwt, ArgosWebSession.class));
                assertRejected(lateJwt);
                assertRejected(issued.jwt());
                assertNotNull(stored().getRevokedAt());
                // Replay and renewal remain refused even though the signature is still valid.
                assertEquals(action == Invalidation.ARCHIVE ? "ARCHIVED" : "ACTIVE",
                        dao.transaction(c -> dao.user(user.getId(), c, false)).getState());
            } finally {
                release.countDown();
            }
        }
    }

    @Test
    void liveAccountStateAndCsrfBindingOverrideEveryStillSignedJwt() {
        String renewed = sessions.renew(bearer(issued.jwt()), CSRF);
        var wrongCsrf = assertThrows(AccountError.class,
                () -> sessions.renew(bearer(renewed), "d".repeat(43)));
        assertEquals(403, wrongCsrf.getResponse().getStatus());
        dao.transaction(c -> {
            var current = dao.user(user.getId(), c, true);
            current.setState("PENDING");
            dao.save(current, c);
            return null;
        });
        assertEquals(403, assertThrows(AccountError.class,
                () -> assertAccepted(renewed)).getResponse().getStatus());
        String pending = sessions.renew(bearer(renewed), CSRF);
        assertEquals("PENDING", sessions.with(bearer(pending), null, false, false,
                (ctx, c) -> ctx.user().getState()));
        sqlState("ARCHIVED");
        assertRejected(pending);
        assertRejected(issued.jwt());
    }

    private void sqlState(String state) {
        dao.transaction(c -> {
            var current = dao.user(user.getId(), c, true);
            current.setState(state);
            dao.save(current, c);
            return null;
        });
    }

    private void revoke() {
        revoke(issued.jwt());
    }

    private void revoke(String jwt) {
        sessions.with(bearer(jwt), CSRF, false, false, (ctx, c) -> {
            sessions.revoke(ctx.session(), c);
            return null;
        });
    }

    private AccountSession stored() {
        return dao.transaction(c -> dao.session(issued.context().session().getId(), c, false));
    }

    private static String bearer(String jwt) { return "Bearer " + jwt; }

    private AccountSessionService.Context assertAccepted(String jwt) {
        return sessions.with(bearer(jwt), null, true, false, (ctx, c) -> ctx);
    }

    private void assertRejected(String jwt) {
        assertEquals(401, assertThrows(AccountError.class, () -> assertAccepted(jwt)).getResponse().getStatus());
        assertEquals(401, assertThrows(AccountError.class, () -> sessions.with(
                bearer(jwt), CSRF, false, true, (ctx, c) -> null)).getResponse().getStatus());
        assertEquals(401, assertThrows(AccountError.class,
                () -> sessions.renew(bearer(jwt), CSRF)).getResponse().getStatus());
    }

    private static void assertUnchanged(AccountSession before, AccountSession after) {
        assertEquals(before.getLastActivityAt(), after.getLastActivityAt());
        assertEquals(before.getAuthenticatedAt(), after.getAuthenticatedAt());
        assertEquals(before.getExpiresAt(), after.getExpiresAt());
        assertEquals(before.getRevokedAt(), after.getRevokedAt());
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("Session lock test timed out");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }
}
