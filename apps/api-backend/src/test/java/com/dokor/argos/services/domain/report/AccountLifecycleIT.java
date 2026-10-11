package com.dokor.argos.services.domain.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.typesafe.config.ConfigFactory;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

@EnabledIfEnvironmentVariable(named = "ARGOS_TEST_CREDENTIALS_URL", matches = ".+")
class AccountLifecycleIT extends MariaDbReportFixture {
    static final String PASSWORD = "a long synthetic fixture passphrase";
    static final String CSRF = "c".repeat(43);

    static class MutableClock extends Clock {
        volatile Instant now = Instant.parse("2026-10-11T08:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    record Message(String recipient, String text) {}

    static class Capture implements AccountMail {
        final List<Message> messages = new CopyOnWriteArrayList<>();
        boolean fail;

        public void send(String recipient, String subject, String text) {
            if (fail) throw new AccountError(503, "mail_unavailable");
            messages.add(new Message(recipient, text));
        }

        String token(String email) {
            String text =
                    messages.stream()
                            .filter(m -> m.recipient().equals(email))
                            .reduce((a, b) -> b)
                            .orElseThrow()
                            .text();
            return text.contains("#token=")
                    ? text.substring(text.indexOf("#token=") + 7)
                    : text.substring(text.lastIndexOf(": ") + 2);
        }
    }

    private MutableClock clock;
    private Capture mail;
    private AccountDao dao;
    private AccountSettings settings;
    private AccountPasswords passwords;
    private AccountSessionService sessions;
    private AccountSessionSigner signer;
    private AccountAuthService auth;
    private AccountRunsService personal;
    private AccountOAuthClient oauthClient;
    private AccountOAuthService oauth;
    private AuditService auditService;

    @BeforeEach
    void accountServices() {
        clock = new MutableClock();
        mail = new Capture();
        settings =
                new AccountSettings(
                        ConfigFactory.parseMap(
                                Map.of(
                                        "account.enabled",
                                        true,
                                        "account.jwt-secret",
                                        "s".repeat(64),
                                        "account.origin",
                                        "http://localhost:3000",
                                        "account.oauth.github.client-id",
                                        "synthetic-client",
                                        "account.oauth.github.client-secret",
                                        "synthetic-secret")));
        dao =
                new AccountDao(
                        new com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl(
                                source,
                                new com.querydsl.sql.Configuration(
                                        com.querydsl.sql.MySQLTemplates.DEFAULT)));
        signer = new AccountSessionSigner(settings, mapper, clock);
        passwords = new AccountPasswords(settings);
        sessions = new AccountSessionService(dao, signer, tokens, settings, clock);
        auth = new AccountAuthService(dao, passwords, sessions, tokens, settings, mail, clock);
        auditService =
                new AuditService(
                        new AuditDao(dao.transactions),
                        new AuditRunService(new AuditRunDao(dao.transactions), tokens, mapper),
                        new UrlNormalizer(),
                        new DomainService(new DomainDao(dao.transactions)));
        personal =
                new AccountRunsService(
                        dao,
                        sessions,
                        auditService,
                        new AuditRunDao(dao.transactions),
                        reader,
                        tokens,
                        clock,
                        settings, new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock));
        oauthClient = mock(AccountOAuthClient.class);
        when(oauthClient.configured(anyString())).thenReturn(true);
        when(oauthClient.authorize(anyString(), anyString(), anyString(), anyString()))
                .thenReturn("https://provider.example/authorize");
        oauth = new AccountOAuthService(dao, sessions, oauthClient, auth, tokens, clock, settings);
    }

    AccountSessionService.Issued user(String email, boolean verified) {
        auth.register(email, PASSWORD, "Fixture");
        if (verified) auth.verify(mail.token(email));
        return auth.login(email, PASSWORD, CSRF);
    }

    String bearer(AccountSessionService.Issued session) {
        return "Bearer " + session.jwt();
    }

    void error(int status, Executable work) {
        var e = assertThrows(AccountError.class, work::run);
        assertEquals(status, e.getResponse().getStatus());
    }

    @FunctionalInterface
    interface Executable {
        void run() throws Exception;
    }

    @Test
    void migrationPreservesAnonymousRowsAndRejectsInvalidOwnerAndDuplicateEmail() throws Exception {
        try (var c = source.getConnection();
                var st = c.createStatement();
                var r = st.executeQuery("SELECT owner_user_id FROM ARG_AUDIT_RUN")) {
            while (r.next()) assertNull(r.getObject(1));
        }
        var u = user("one@example.com", true);
        assertThrows(
                Exception.class,
                () -> sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=999999 WHERE id=1"));
        auth.register("ONE@example.com", PASSWORD, "Other");
        assertEquals(
                1,
                dao.transaction(
                                c ->
                                        dao.transactions
                                                .selectQuery(c)
                                                .select(QAccountUser.table)
                                                .from(QAccountUser.table)
                                                .fetch())
                        .size());
        assertEquals(
                "USER",
                dao.transaction(c -> dao.user(u.context().user().getId(), c, false)).getRole());
    }

    @Test
    void verificationIsAtomicPurposeBoundExpiringAndGetDoesNotConsume() {
        var u = user("pending@example.com", false);
        String token = mail.token("pending@example.com");
        error(403, () -> personal.list(bearer(u), 20));
        assertTrue(
                dao.transaction(
                                        c ->
                                                dao.transactions
                                                        .selectQuery(c)
                                                        .select(QAccountToken.table)
                                                        .from(QAccountToken.table)
                                                        .fetchOne())
                                .getConsumedAt()
                        == null);
        error(400, () -> auth.reset(token, PASSWORD + " reset"));
        auth.verify(token);
        error(400, () -> auth.verify(token));
        assertEquals(0, personal.list(bearer(u), 20).size());
        auth.register("expired@example.com", PASSWORD, "Expired");
        String expired = mail.token("expired@example.com");
        clock.now = clock.now.plus(Duration.ofDays(2));
        error(400, () -> auth.verify(expired));
    }

    @Test
    void twoConcurrentTokenConsumersOnlyOneSucceeds() throws Exception {
        auth.register("race@example.com", PASSWORD, "Race");
        String token = mail.token("race@example.com");
        assertEquals(
                1,
                race(
                        () -> {
                            try {
                                auth.verify(token);
                                return true;
                            } catch (AccountError invalid) {
                                return false;
                            }
                        }));
    }

    @Test
    void resendInvalidatesOldTokenAndFailedDeliveryRollsBackWithoutDuplicates() {
        auth.register("mail@example.com", PASSWORD, "Mail");
        String old = mail.token("mail@example.com");
        auth.send("mail@example.com", "VERIFY");
        String newer = mail.token("mail@example.com");
        error(400, () -> auth.verify(old));
        auth.verify(newer);
        mail.fail = true;
        error(503, () -> auth.register("failure@example.com", PASSWORD, "Failure"));
        assertNull(dao.transaction(c -> dao.email("failure@example.com", c)));
        auth.register("mail@example.com", PASSWORD, "Collision");
        assertNotNull(dao.transaction(c -> dao.email("mail@example.com", c)));
    }

    @Test
    void resetRevokesSessionsRejectsOldPasswordAndNeverActivatesArchivedAccount() {
        var u = user("reset@example.com", true);
        auth.send("reset@example.com", "RESET");
        String token = mail.token("reset@example.com");
        auth.reset(token, PASSWORD + " changed");
        error(401, () -> personal.list(bearer(u), 20));
        error(401, () -> auth.login("reset@example.com", PASSWORD, CSRF));
        error(400, () -> auth.reset(token, PASSWORD));
        var fresh = auth.login("reset@example.com", PASSWORD + " changed", CSRF);
        auth.send("reset@example.com", "RESET");
        String stale = mail.token("reset@example.com");
        auth.archive(bearer(fresh), CSRF, true);
        error(400, () -> auth.reset(stale, PASSWORD));
        error(401, () -> auth.login("reset@example.com", PASSWORD + " changed", CSRF));
        auth.register("reset@example.com", PASSWORD, "Resurrection");
        assertEquals(
                "ARCHIVED", dao.transaction(c -> dao.email("reset@example.com", c)).getState());
    }

    @Test
    void jwtExpirationIdleAbsoluteAndRefreshActivityAreDistinct() {
        var u = user("ttl@example.com", true);
        clock.now = clock.now.plusSeconds(600);
        String renewed = sessions.renew(bearer(u), CSRF);
        assertEquals(
                u.context().session().getAuthenticatedAt(),
                dao.transaction(c -> dao.session(u.context().session().getId(), c, false))
                        .getAuthenticatedAt());
        clock.now = clock.now.plusSeconds(301);
        error(401, () -> sessions.renew(bearer(u), CSRF));
        assertNotNull(personal.list("Bearer " + renewed, 20));
        String latest = sessions.renew("Bearer " + renewed, CSRF);
        clock.now = clock.now.plusSeconds(900);
        error(401, () -> sessions.renew("Bearer " + latest, CSRF));
        // Valid short JWT cannot bypass an expired registry deadline.
        var second = user("absolute@example.com", true);
        dao.transaction(
                c -> {
                    var s = dao.session(second.context().session().getId(), c, true);
                    s.setExpiresAt(clock.instant());
                    dao.save(s, c);
                    return null;
                });
        error(401, () -> personal.list(bearer(second), 20));
        var idle = user("idle@example.com", true);
        dao.transaction(
                c -> {
                    var s = dao.session(idle.context().session().getId(), c, true);
                    s.setLastActivityAt(clock.instant().minusSeconds(1800));
                    dao.save(s, c);
                    return null;
                });
        error(401, () -> personal.list(bearer(idle), 20));
    }

    @Test
    void wrongUsageSignatureSessionOwnerAndCsrfCannotAuthenticate() {
        var a = user("a@example.com", true);
        var b = user("b@example.com", true);
        error(403, () -> sessions.renew(bearer(a), "d".repeat(43)));
        String wrong =
                signer.serializeSession(
                        new ArgosWebSession(
                                "other",
                                "argos-account",
                                "account",
                                a.context().user().getId(),
                                a.context().session().getId(),
                                clock.instant().plusSeconds(60).getEpochSecond()),
                        clock.instant().plusSeconds(60).toEpochMilli());
        error(401, () -> personal.list("Bearer " + wrong, 20));
        error(401, () -> personal.list(bearer(a) + "x", 20));
        String crossed = signer.issue(a.context().user().getId(), b.context().session().getId());
        error(401, () -> personal.list("Bearer " + crossed, 20));
    }

    @Test
    void sameUrlHasIndependentOwnersAndProofIsSeparateFromReportCredential() {
        var a = user("a@example.com", true);
        var b = user("b@example.com", true);
        var ar = personal.create("https://example.com", bearer(a), CSRF);
        var br = personal.create("https://example.com", bearer(b), CSRF);
        var anon = personal.create("https://example.com", null, null);
        assertEquals(ar.audit().auditId(), br.audit().auditId());
        assertNotEquals(ar.audit().runId(), br.audit().runId());
        assertEquals(1, personal.list(bearer(a), 1).size());
        error(404, () -> personal.get(bearer(a), br.audit().runId()));
        error(404, () -> personal.report(bearer(a), br.audit().runId()));
        error(
                404,
                () ->
                        personal.claim(
                                bearer(a), CSRF, anon.audit().runId(), anon.audit().reportToken()));
        personal.claim(bearer(a), CSRF, anon.audit().runId(), anon.proof());
        personal.claim(bearer(a), CSRF, anon.audit().runId(), anon.proof());
        error(404, () -> personal.claim(bearer(b), CSRF, anon.audit().runId(), anon.proof()));
        assertArrayEquals(
                tokens.sha256(anon.audit().reportToken()),
                new AuditRunDao(dao.transactions)
                        .findById(anon.audit().runId())
                        .getReportTokenHash());
    }

    @Test
    void twoClaimantsAndArchiveRacesNeverResurrectSessions() throws Exception {
        var a = user("a@example.com", true);
        var b = user("b@example.com", true);
        var anon = personal.create("https://example.com", null, null);
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first =
                    pool.submit(
                            () -> {
                                barrier.await();
                                try {
                                    personal.claim(
                                            bearer(a), CSRF, anon.audit().runId(), anon.proof());
                                    return 1;
                                } catch (AccountError e) {
                                    return 0;
                                }
                            });
            var second =
                    pool.submit(
                            () -> {
                                barrier.await();
                                try {
                                    personal.claim(
                                            bearer(b), CSRF, anon.audit().runId(), anon.proof());
                                    return 1;
                                } catch (AccountError e) {
                                    return 0;
                                }
                            });
            assertEquals(1, first.get(15, TimeUnit.SECONDS) + second.get(15, TimeUnit.SECONDS));
        }
        var refresh = Executors.newSingleThreadExecutor();
        try {
            var result =
                    refresh.submit(
                            () -> {
                                try {
                                    return sessions.renew(bearer(a), CSRF);
                                } catch (AccountError e) {
                                    return null;
                                }
                            });
            auth.archive(bearer(a), CSRF, true);
            String jwt = result.get(15, TimeUnit.SECONDS);
            if (jwt != null) error(401, () -> personal.list("Bearer " + jwt, 20));
        } finally {
            refresh.shutdownNow();
        }
        error(401, () -> personal.create("https://example.com", bearer(a), CSRF));
    }

    @Test
    void archivePreservesReportLinksAndSharedTechnicalRowsButRevokesAllAccess() throws Exception {
        var a = user("archive@example.com", true);
        dao.transaction(
                c -> {
                    dao.transactions
                            .update(QAuditRun.auditRun, c)
                            .set(QAuditRun.auditRun.ownerUserId, a.context().user().getId())
                            .where(QAuditRun.auditRun.id.eq(1L))
                            .execute();
                    return null;
                });
        auth.archive(bearer(a), CSRF, true);
        error(401, () -> personal.get(bearer(a), 1));
        error(401, () -> sessions.renew(bearer(a), CSRF));
        assertTrue(reader.getByToken("synthetic-existing").isPresent());
        assertTrue(reader.getByToken("synthetic-expired").isEmpty());
        assertNotNull(new AuditDao(dao.transactions).findById(1L));
        assertNotNull(dao.transaction(c -> dao.user(a.context().user().getId(), c, false)));
    }

    @Test
    void claimSupportsAllProcessingPhasesButRejectsExpiredMissingAndPurgedProofs()
            throws Exception {
        var a = user("phases@example.com", true);
        error(404, () -> personal.claim(bearer(a), CSRF, 1, "p".repeat(43)));
        for (String phase : List.of("QUEUED", "RUNNING", "COMPLETED")) {
            var run = personal.create("https://example.com", null, null);
            if (!phase.equals("QUEUED"))
                assertTrue(
                        new AuditRunDao(dao.transactions)
                                .claimRun(
                                        run.audit().runId(), "synthetic-worker", clock.instant()));
            if (phase.equals("COMPLETED"))
                publisher.completeAndPublish(
                        run.audit().runId(),
                        new AuditDao(dao.transactions).findById(run.audit().auditId()),
                        mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),
                        "{}",
                        "synthetic-worker");
            error(404, () -> personal.claim(bearer(a), CSRF, run.audit().runId(), "f".repeat(43)));
            personal.claim(bearer(a), CSRF, run.audit().runId(), run.proof());
            assertEquals(phase, personal.get(bearer(a), run.audit().runId()).get("status"));
            if (phase.equals("COMPLETED")) {
                sql("DELETE FROM ARG_AUDIT_REPORT WHERE run_id=" + run.audit().runId());
                error(404, () -> personal.claim(bearer(a), CSRF, run.audit().runId(), run.proof()));
            }
        }
        var expired = personal.create("https://example.com", null, null);
        dao.transaction(
                c -> {
                    var q = QAccountRunClaim.table;
                    dao.transactions
                            .update(q, c)
                            .set(q.expiresAt, clock.instant())
                            .where(q.runId.eq(expired.audit().runId()))
                            .execute();
                    return null;
                });
        error(404, () -> personal.claim(bearer(a), CSRF, expired.audit().runId(), expired.proof()));
    }

    @Test
    void recentAuthMethodRemovalAndAtomicLastMethodRule() throws Exception {
        var a = user("methods@example.com", true);
        clock.now = clock.now.plusSeconds(301);
        error(403, () -> auth.addPassword(bearer(a), CSRF, PASSWORD + " new"));
        auth.reauth(bearer(a), CSRF, PASSWORD, null);
        dao.transaction(
                c -> {
                    var i = new AccountIdentity();
                    i.setUserId(a.context().user().getId());
                    i.setProvider("github");
                    i.setSubject("123");
                    i.setCreatedAt(clock.instant());
                    dao.save(i, c);
                    return null;
                });
        var methods = dao.transaction(c -> dao.identities(a.context().user().getId(), c));
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> operations = new ArrayList<>();
            for (var method : methods)
                operations.add(
                        pool.submit(
                                () -> {
                                    barrier.await();
                                    try {
                                        auth.removeMethod(bearer(a), CSRF, method.getId());
                                        return true;
                                    } catch (AccountError e) {
                                        return false;
                                    }
                                }));
            int ok = 0;
            for (var result : operations) if (result.get(15, TimeUnit.SECONDS)) ok++;
            assertEquals(1, ok);
        }
        assertEquals(1, dao.transaction(c -> dao.identities(a.context().user().getId(), c)).size());
    }

    @Test
    void socialIdentityCollisionsCannotCapturePrecreatedEmailAndCallbacksAreBoundAndSingleUse() {
        var a = user("victim@example.com", false);
        when(oauthClient.exchange(eq("google"), anyString(), anyString(), anyString()))
                .thenReturn(
                        new AccountOAuthClient.Identity(
                                "issuer|victim", "victim@example.com", true, "Victim"));
        var start = oauth.start("google", "login", "/account", null, CSRF);
        error(
                400,
                () -> oauth.finish("github", start.state(), start.browser(), "code", null, CSRF));
        error(400, () -> oauth.finish("google", start.state(), "b".repeat(43), "code", null, CSRF));
        error(
                409,
                () -> oauth.finish("google", start.state(), start.browser(), "code", null, CSRF));
        error(
                400,
                () -> oauth.finish("google", start.state(), start.browser(), "code", null, CSRF));
        assertEquals(1, dao.transaction(c -> dao.identities(a.context().user().getId(), c)).size());
        when(oauthClient.exchange(eq("github"), anyString(), anyString(), anyString()))
                .thenReturn(new AccountOAuthClient.Identity("456", null, false, "Social"));
        var social = oauth.start("github", "login", "https://attacker.example", null, CSRF);
        var finish = oauth.finish("github", social.state(), social.browser(), "code", null, CSRF);
        assertEquals("/account", finish.returnPath());
        error(403, () -> personal.list("Bearer " + finish.jwt(), 20));
    }

    @Test
    void anUnconfiguredSocialProviderCannotJustifyRemovingTheOnlyUsableMethod() {
        var a = user("usable@example.com", true);
        dao.transaction(
                c -> {
                    var i = new AccountIdentity();
                    i.setUserId(a.context().user().getId());
                    i.setProvider("linkedin");
                    i.setSubject("not-configured");
                    i.setCreatedAt(clock.instant());
                    dao.save(i, c);
                    return null;
                });
        var local =
                dao.transaction(
                        c -> dao.identity("password", a.context().user().getId().toString(), c));
        error(403, () -> auth.removeMethod(bearer(a), CSRF, local.getId()));
        assertNotNull(auth.login("usable@example.com", PASSWORD, CSRF));
    }

    @Test
    void socialLinkRequiresFreshExistingIdentityAndNeverTransfersMethods() {
        var a = user("a@example.com", true);
        var b = user("b@example.com", true);
        when(oauthClient.exchange(eq("github"), anyString(), anyString(), anyString()))
                .thenReturn(new AccountOAuthClient.Identity("789", "b@example.com", true, "Other"));
        var start = oauth.start("github", "link", "/account", bearer(a), CSRF);
        error(
                403,
                () ->
                        oauth.finish(
                                "github", start.state(), start.browser(), "code", bearer(b), CSRF));
        var retry = oauth.start("github", "link", "/account", bearer(a), CSRF);
        oauth.finish("github", retry.state(), retry.browser(), "code", bearer(a), CSRF);
        assertEquals(
                "a@example.com",
                dao.transaction(c -> dao.user(a.context().user().getId(), c, false)).getEmail());
        var collision = oauth.start("github", "link", "/account", bearer(b), CSRF);
        error(
                409,
                () ->
                        oauth.finish(
                                "github",
                                collision.state(),
                                collision.browser(),
                                "code",
                                bearer(b),
                                CSRF));
    }

    @Test
    void emailReauthenticationIsSingleUseAndBoundToItsOriginalSession() {
        var a = user("email@example.com", true);
        var other = auth.login("email@example.com", PASSWORD, CSRF);
        auth.reauth(bearer(a), CSRF, null, null);
        String code = mail.token("email@example.com");
        error(400, () -> auth.reauth(bearer(other), CSRF, null, code));
        auth.reauth(bearer(a), CSRF, null, code);
        error(400, () -> auth.reauth(bearer(a), CSRF, null, code));
    }

    @Test
    void unlinkCommittedAfterLoginSnapshotCannotIssueANewSession() throws Exception {
        var a = user("unlink@example.com", true);
        dao.transaction(
                c -> {
                    var i = new AccountIdentity();
                    i.setUserId(a.context().user().getId());
                    i.setProvider("github");
                    i.setSubject("unlink-social");
                    i.setCreatedAt(clock.instant());
                    dao.save(i, c);
                    return null;
                });
        var local =
                dao.transaction(
                        c -> dao.identity("password", a.context().user().getId().toString(), c));
        var snapshot = new CountDownLatch(1);
        var resume = new CountDownLatch(1);
        var observed = spy(dao);
        doAnswer(
                        call -> {
                            var found = call.callRealMethod();
                            snapshot.countDown();
                            assertTrue(resume.await(10, TimeUnit.SECONDS));
                            return found;
                        })
                .when(observed)
                .email(eq("unlink@example.com"), any(java.sql.Connection.class));
        var paused =
                new AccountAuthService(
                        observed, passwords, sessions, tokens, settings, mail, clock);
        try (var pool = Executors.newSingleThreadExecutor()) {
            var result =
                    pool.submit(
                            () -> {
                                try {
                                    paused.login("unlink@example.com", PASSWORD, CSRF);
                                    return false;
                                } catch (AccountError refused) {
                                    return refused.getResponse().getStatus() == 401;
                                }
                            });
            assertTrue(snapshot.await(10, TimeUnit.SECONDS));
            try {
                auth.removeMethod(bearer(a), CSRF, local.getId());
            } finally {
                resume.countDown();
            }
            assertTrue(result.get(15, TimeUnit.SECONDS));
        }
    }

    @Test
    void archiveRacingLoginResetSocialClaimAndPublicationCannotRestoreAccess() throws Exception {
        for (String action : List.of("login", "reset", "social", "claim", "publish")) {
            String email = "race-" + action + "@example.com";
            var a = user(email, true);
            var anonymous = personal.create("https://example.com", null, null);
            String reset;
            if (action.equals("reset")) {
                auth.send(email, "RESET");
                reset = mail.token(email);
            } else reset = null;
            dao.transaction(
                    c -> {
                        var i = new AccountIdentity();
                        i.setUserId(a.context().user().getId());
                        i.setProvider("github");
                        i.setSubject(action);
                        i.setCreatedAt(clock.instant());
                        dao.save(i, c);
                        return null;
                    });
            when(oauthClient.exchange(eq("github"), anyString(), anyString(), anyString()))
                    .thenReturn(new AccountOAuthClient.Identity(action, email, true, "Fixture"));
            var social = oauth.start("github", "login", "/account", null, CSRF);
            var queued = personal.create("https://example.com", bearer(a), CSRF);
            if (action.equals("publish"))
                assertTrue(
                        new AuditRunDao(dao.transactions)
                                .claimRun(
                                        queued.audit().runId(),
                                        "synthetic-worker",
                                        clock.instant()));
            var barrier = new CyclicBarrier(2);
            try (var pool = Executors.newFixedThreadPool(2)) {
                var operation =
                        pool.submit(
                                () -> {
                                    barrier.await();
                                    try {
                                        return switch (action) {
                                            case "login" -> auth.login(email, PASSWORD, CSRF).jwt();
                                            case "reset" -> {
                                                auth.reset(reset, PASSWORD + " changed");
                                                yield null;
                                            }
                                            case "social" ->
                                                    oauth.finish(
                                                                    "github",
                                                                    social.state(),
                                                                    social.browser(),
                                                                    "code",
                                                                    null,
                                                                    CSRF)
                                                            .jwt();
                                            case "claim" -> {
                                                personal.claim(
                                                        bearer(a),
                                                        CSRF,
                                                        anonymous.audit().runId(),
                                                        anonymous.proof());
                                                yield null;
                                            }
                                            default -> {
                                                var audit =
                                                        new AuditDao(dao.transactions)
                                                                .findById(queued.audit().auditId());
                                                publisher.completeAndPublish(
                                                        queued.audit().runId(),
                                                        audit,
                                                        mock(
                                                                com.dokor.argos.services.analysis
                                                                        .model.AuditReportJson
                                                                        .class),
                                                        "{}",
                                                        "synthetic-worker");
                                                yield null;
                                            }
                                        };
                                    } catch (AccountError refused) {
                                        return null;
                                    }
                                });
                var archive =
                        pool.submit(
                                () -> {
                                    barrier.await();
                                    try {
                                        auth.archive(bearer(a), CSRF, true);
                                        return true;
                                    } catch (AccountError refused) {
                                        return false;
                                    }
                                });
                String issued = operation.get(20, TimeUnit.SECONDS);
                boolean archived = archive.get(20, TimeUnit.SECONDS);
                if (!archived) {
                    var fresh = auth.login(email, PASSWORD + " changed", CSRF);
                    auth.archive(bearer(fresh), CSRF, true);
                }
                if (issued != null) error(401, () -> personal.list("Bearer " + issued, 20));
            }
            assertEquals(
                    "ARCHIVED",
                    dao.transaction(c -> dao.user(a.context().user().getId(), c, false))
                            .getState());
            error(401, () -> personal.create("https://example.com", bearer(a), CSRF));
            assertTrue(reader.getByToken("synthetic-existing").isPresent());
            if (action.equals("publish"))
                assertTrue(reader.getByToken(queued.audit().reportToken()).isPresent());
        }
    }

    private int race(Callable<Boolean> work) throws Exception {
        var start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a =
                    pool.submit(
                            () -> {
                                start.await();
                                return work.call();
                            });
            var b =
                    pool.submit(
                            () -> {
                                start.await();
                                return work.call();
                            });
            return (a.get(15, TimeUnit.SECONDS) ? 1 : 0) + (b.get(15, TimeUnit.SECONDS) ? 1 : 0);
        }
    }

    @Test
    void actualJavaHttpRoutesEnforceTheAccessMatrixAndCsrfBeforeMutations() throws Exception {
        var a = user("http-a@example.com", true);
        var b = user("http-b@example.com", true);
        var pending = user("http-p@example.com", false);
        var owned = personal.create("https://example.com", bearer(a), CSRF);
        try (var http = new HttpFixture()) {
            for (String path :
                    List.of(
                            "/account/me",
                            "/account/runs",
                            "/account/runs/" + owned.audit().runId(),
                            "/account/runs/" + owned.audit().runId() + "/report",
                            "/account/sessions",
                            "/account/methods"))
                assertEquals(401, http.call("GET", path, null, null, false).statusCode(), path);
            assertEquals(
                    200,
                    http.call("GET", "/account/me", bearer(pending), null, false).statusCode());
            assertEquals(
                    403,
                    http.call("GET", "/account/runs", bearer(pending), null, false).statusCode());
            assertEquals(
                    200,
                    http.call(
                                    "GET",
                                    "/account/runs/" + owned.audit().runId(),
                                    bearer(a),
                                    null,
                                    false)
                            .statusCode());
            assertEquals(
                    404,
                    http.call(
                                    "GET",
                                    "/account/runs/" + owned.audit().runId(),
                                    bearer(b),
                                    null,
                                    false)
                            .statusCode());
            assertEquals(
                    404,
                    http.call("GET", "/account/runs/999", bearer(b), null, false).statusCode());
            assertEquals(
                    401,
                    http.call(
                                    "GET",
                                    "/account/me",
                                    "Bearer synthetic-server-credential",
                                    null,
                                    false)
                            .statusCode());
            assertEquals(
                    403,
                    http.call(
                                    "PATCH",
                                    "/account/me",
                                    bearer(a),
                                    "{\"displayName\":\"changed\"}",
                                    false)
                            .statusCode());
            var result =
                    http.call(
                            "PATCH",
                            "/account/me",
                            bearer(a),
                            "{\"displayName\":\"changed\"}",
                            true);
            assertEquals(200, result.statusCode(), result.body());
            assertTrue(
                    result.headers().firstValue("cache-control").orElse("").contains("no-store"));
            http.call(
                    "PATCH",
                    "/account/me",
                    bearer(a),
                    "{\"displayName\":\"changed\",\"role\":\"ADMIN\",\"offer\":\"PREMIUM\",\"emailVerified\":true}",
                    true);
            assertEquals(
                    "USER",
                    dao.transaction(c -> dao.user(a.context().user().getId(), c, false)).getRole());
            assertEquals(
                    "FREE",
                    dao.transaction(c -> dao.user(a.context().user().getId(), c, false))
                            .getOffer());
            assertEquals(
                    403,
                    http.call("POST", "/account/auth/logout", bearer(a), "{}", false).statusCode());
            assertEquals(
                    200,
                    http.call("POST", "/account/auth/logout", bearer(a), "{}", true).statusCode());
            assertEquals(401, http.call("GET", "/account/me", bearer(a), null, false).statusCode());
            assertEquals(
                    401,
                    http.call("POST", "/account/auth/renew", bearer(a), "{}", true).statusCode());
            assertEquals(401, http.create("Bearer forged").statusCode());
            assertEquals(403, http.create(bearer(pending)).statusCode());
            assertEquals(200, http.create(bearer(b)).statusCode());
        }
    }

    @Test
    void actualJavaHttpEmailFlowHasNoTokenInJsonAndArchivedCredentialsFailEveryRoute()
            throws Exception {
        try (var http = new HttpFixture()) {
            String registration =
                    "{\"email\":\"http-new@example.com\",\"password\":\""
                            + PASSWORD
                            + "\",\"displayName\":\"New\"}";
            var registered = http.call("POST", "/account/auth/register", null, registration, true);
            assertEquals(200, registered.statusCode(), registered.body());
            String token = mail.token("http-new@example.com");
            assertFalse(registered.body().contains(token));
            assertEquals(
                    400,
                    http.call(
                                    "POST",
                                    "/account/auth/login",
                                    null,
                                    "{\"password\":\"synthetic-private-input\",broken}",
                                    true)
                            .statusCode());
            assertEquals(
                    405,
                    http.call("GET", "/account/auth/verify?token=" + token, null, null, false)
                            .statusCode());
            assertEquals(
                    200,
                    http.call(
                                    "POST",
                                    "/account/auth/verify",
                                    null,
                                    "{\"token\":\"" + token + "\"}",
                                    true)
                            .statusCode());
            var login =
                    http.call(
                            "POST",
                            "/account/auth/login",
                            null,
                            "{\"email\":\"http-new@example.com\",\"password\":\""
                                    + PASSWORD
                                    + "\"}",
                            true);
            assertEquals(200, login.statusCode(), login.body());
            String jwt = login.headers().firstValue("x-argos-session").orElseThrow();
            assertFalse(login.body().contains(jwt));
            assertTrue(
                    mapper.readValue(
                                    "{\"confirmed\":true}",
                                    com.dokor.argos.webservices.api.account.AccountWs.Confirmation
                                            .class)
                            .confirmed());
            var archived =
                    http.call(
                            "POST",
                            "/account/me/archive",
                            "Bearer " + jwt,
                            "{\"confirmed\":true}",
                            true);
            assertEquals(
                    200,
                    archived.statusCode(),
                    "archive response: "
                            + archived.body()
                            + " headers: "
                            + archived.headers().map().keySet());
            for (String path :
                    List.of(
                            "/account/me",
                            "/account/runs",
                            "/account/sessions",
                            "/account/methods"))
                assertEquals(
                        401, http.call("GET", path, "Bearer " + jwt, null, false).statusCode());
            assertEquals(
                    401,
                    http.call("POST", "/account/auth/renew", "Bearer " + jwt, "{}", true)
                            .statusCode());
        }
    }

    @Test
    void persistentRateLimitReturnsRetryAfterWithoutPermanentLock() {
        var limiter = new AccountRateLimiter(dao, tokens, clock, settings);
        for (int i = 0; i < 5; i++) limiter.check("email", "same@example.com", "127.0.0.1");
        var limited =
                assertThrows(
                        jakarta.ws.rs.WebApplicationException.class,
                        () -> limiter.check("email", "same@example.com", "127.0.0.1"));
        assertEquals(429, limited.getResponse().getStatus());
        assertEquals("900", limited.getResponse().getHeaderString("Retry-After"));
        clock.now = clock.now.plusSeconds(901);
        assertDoesNotThrow(() -> limiter.check("email", "same@example.com", "127.0.0.1"));
    }

    private class HttpFixture implements AutoCloseable {
        final org.glassfish.grizzly.http.server.HttpServer server;
        final String base;
        final java.net.http.HttpClient client =
                java.net.http.HttpClient.newBuilder()
                        .version(java.net.http.HttpClient.Version.HTTP_1_1)
                        .build();

        HttpFixture() throws Exception {
            var json = new com.dokor.argos.jersey.SafeJsonProvider();
            json.setMapper(mapper);
            var access =
                    new com.dokor.argos.webservices.api.account.AccountPermissionProvider(sessions);
            var config =
                    new org.glassfish.jersey.server.ResourceConfig()
                            .register(json)
                            .register(
                                    com.dokor.argos.webservices.api.account.AccountContextFactory
                                            .binding(sessions))
                            .register(com.coreoz.plume.jersey.errors.WsResultExceptionMapper.class)
                            .register(
                                    new com.dokor.argos.webservices.api.account
                                            .AccountFailureAuditFilter(dao, sessions))
                            .register(
                                    com.coreoz.plume.jersey.security.permission
                                            .RequireExplicitAccessControlFeature
                                            .accessControlAnnotations(
                                                    com.coreoz.plume.jersey.security.permission
                                                            .PublicApi.class,
                                                    com.dokor.argos.webservices.api.account
                                                            .AccountAccess.class))
                            .register(
                                    new com.coreoz.plume.jersey.security.permission
                                            .PermissionFeature<>(
                                            access,
                                            com.dokor.argos.webservices.api.account.AccountAccess
                                                    .class,
                                            com.dokor.argos.webservices.api.account.AccountAccess
                                                    ::value))
                            .register(
                                    new com.dokor.argos.webservices.api.account.AccountAuthWs(
                                            auth,
                                            sessions,
                                            oauth,
                                            new AccountCsrf(settings),
                                            new AccountRateLimiter(dao, tokens, clock, settings),
                                            tokens,
                                            settings))
                            .register(
                                    new com.dokor.argos.webservices.api.account.AccountWs(
                                            dao,
                                            sessions,
                                            auth,
                                            personal,
                                            new AccountCsrf(settings),
                                            new AccountRateLimiter(dao, tokens, clock, settings), new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock)));
            var admin = mock(com.dokor.argos.services.configuration.ConfigurationService.class);
            when(admin.adminApiToken()).thenReturn("synthetic-server-credential");
            config.register(
                    new com.dokor.argos.webservices.api.audits.AuditsWs(
                            auditService,
                            mock(AuditQueryService.class),
                            new com.dokor.argos.webservices.api.audits.AdminReadAccess(admin),
                            reader,
                            null,
                            personal,
                            settings,
                            new AccountCsrf(settings)));
            server =
                    org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory
                            .createHttpServer(
                                    java.net.URI.create("http://127.0.0.1:0/"), config, false);
            for (var listener : server.getListeners()) {
                listener.getTransport().setSelectorRunnersCount(1);
                listener.getTransport()
                        .setWorkerThreadPoolConfig(
                                org.glassfish.grizzly.threadpool.ThreadPoolConfig.defaultConfig()
                                        .setCorePoolSize(2)
                                        .setMaxPoolSize(6));
            }
            server.start();
            base = "http://127.0.0.1:" + server.getListeners().iterator().next().getPort();
        }

        java.net.http.HttpResponse<String> call(
                String method, String path, String bearer, String body, boolean csrf)
                throws Exception {
            var r =
                    java.net.http.HttpRequest.newBuilder(java.net.URI.create(base + path))
                            .timeout(Duration.ofSeconds(10))
                            .header("Content-Type", "application/json");
            if (bearer != null) r.header("Authorization", bearer);
            if (csrf)
                r.header("Origin", "http://localhost:3000")
                        .header("X-Argos-CSRF", CSRF)
                        .header("Cookie", "argos_account_csrf=" + CSRF);
            return client.send(
                    r.method(
                                    method,
                                    body == null
                                            ? java.net.http.HttpRequest.BodyPublishers.noBody()
                                            : java.net.http.HttpRequest.BodyPublishers.ofString(
                                                    body))
                            .build(),
                    java.net.http.HttpResponse.BodyHandlers.ofString());
        }

        java.net.http.HttpResponse<String> create(String bearer) throws Exception {
            var r =
                    java.net.http.HttpRequest.newBuilder(java.net.URI.create(base + "/audits"))
                            .header("Content-Type", "application/json")
                            .header("X-Argos-Account-Session", bearer)
                            .header("Origin", "http://localhost:3000")
                            .header("X-Argos-CSRF", CSRF)
                            .header("Cookie", "argos_account_csrf=" + CSRF)
                            .POST(
                                    java.net.http.HttpRequest.BodyPublishers.ofString(
                                            "{\"url\":\"https://example.com\"}"))
                            .build();
            return client.send(r, java.net.http.HttpResponse.BodyHandlers.ofString());
        }

        @Override
        public void close() {
            server.shutdownNow();
        }
    }

    AccountSitesService sites() { return new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock); }
    @Test void personalSitesSeparateOwnersAndDoNotLaunchRuns() throws Exception {
        var a=user("sites-a@example.com",true);var b=user("sites-b@example.com",true);var service=sites();
        var first=service.add(bearer(a),CSRF,null,"https://example.com/path?q=1#fragment");
        var second=service.add(bearer(b),CSRF,null,"https://example.com/path?q=1");
        assertNotEquals(first.site().siteId(),second.site().siteId());
        assertTrue(first.created());assertFalse(service.add(bearer(a),CSRF,null,"https://example.com/path?q=1").created());
        assertEquals(1,service.list(bearer(a),20,null).items().size());
        var page=service.urls(bearer(a),Long.parseLong(first.site().siteId()),20,null);
        assertNull(page.items().getFirst().latestAttempt());assertNull(page.items().getFirst().latestAvailableReport());
        error(404,()->service.get(bearer(a),Long.parseLong(second.site().siteId())));
        error(404,()->service.add(bearer(a),CSRF,Long.parseLong(second.site().siteId()),"https://example.com/other"));
        error(400,()->service.add(bearer(a),CSRF,Long.parseLong(first.site().siteId()),"https://www.example.com/"));
        error(400,()->service.add(bearer(a),CSRF,null,"http://127.0.0.1/"));
        error(403,()->service.add(bearer(a),"wrong",null,"https://example.com/"));
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM ARG_AUDIT_RUN")){r.next();assertEquals(5,r.getInt(1));}
    }
    @Test void personalLastReportSurvivesLaterFailureAndIgnoresOtherOwner() throws Exception {
        var a=user("latest-a@example.com",true);var b=user("latest-b@example.com",true);var service=sites();
        var old=personal.create("https://example.com",bearer(a),CSRF).audit();
        sql("UPDATE ARG_AUDIT_RUN SET status='COMPLETED',created_at='2026-10-10 08:00:00' WHERE id="+old.runId());
        sql("INSERT INTO ARG_AUDIT_REPORT(id,audit_id,run_id,token_hash,domain,target_url,report_json) VALUES(100,"+old.auditId()+","+old.runId()+",UNHEX(SHA2('synthetic-site-report',256)),'example.com','https://example.com','{}')");
        sql("UPDATE ARG_AUDIT_REPORT SET global_score=81,provisional=1 WHERE id=100");
        var failed=personal.create("https://example.com",bearer(a),CSRF).audit();
        sql("UPDATE ARG_AUDIT_RUN SET status='FAILED',created_at='2026-10-11 08:00:00' WHERE id="+failed.runId());
        var foreign=personal.create("https://example.com",bearer(b),CSRF).audit();
        sql("UPDATE ARG_AUDIT_RUN SET created_at='2026-10-12 08:00:00' WHERE id="+foreign.runId());
        var site=service.list(bearer(a),20,null).items().getFirst();
        var row=service.urls(bearer(a),Long.parseLong(site.siteId()),20,null).items().getFirst();
        assertEquals(Long.toString(failed.runId()),row.latestAttempt().runId());assertEquals("FAILED",row.latestAttempt().status());
        assertEquals(Long.toString(old.runId()),row.latestAvailableReport().runId());assertEquals(81,row.latestAvailableReport().globalScore());assertTrue(row.latestAvailableReport().provisional());
        sql("UPDATE ARG_AUDIT_REPORT SET global_score=NULL WHERE id=100");
        assertNull(service.urls(bearer(a),Long.parseLong(site.siteId()),20,null).items().getFirst().latestAvailableReport().globalScore());
        sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2000-01-01' WHERE id=100");
        assertNull(service.urls(bearer(a),Long.parseLong(site.siteId()),20,null).items().getFirst().latestAvailableReport());
    }
    @Test void personalUrlPaginationPreservesNormalizerIdentity() {
        var a=user("pagination@example.com",true);var service=sites();
        var site=service.add(bearer(a),CSRF,null,"https://example.com").site();long id=Long.parseLong(site.siteId());
        for(int n=0;n<24;n++) service.add(bearer(a),CSRF,id,"https://example.com/path?q="+n);
        service.add(bearer(a),CSRF,id,"http://example.com/path?q=0");
        var one=service.urls(bearer(a),id,20,null);var two=service.urls(bearer(a),id,20,one.nextCursor());
        assertEquals(20,one.items().size());assertEquals(6,two.items().size());assertNull(two.nextCursor());
        var ids=new HashSet<String>();one.items().forEach(r->assertTrue(ids.add(r.siteUrlId())));two.items().forEach(r->assertTrue(ids.add(r.siteUrlId())));
        error(400,()->service.urls(bearer(a),id,20,"-1"));error(400,()->service.list(bearer(a),101,null));
        auth.archive(bearer(a),CSRF,true);error(401,()->service.get(bearer(a),id));
    }
    @Test void concurrentFollowIsUniqueAndClaimCreatesPersonalRelations() throws Exception {
        var a=user("concurrent-sites@example.com",true);var service=sites();var pool=Executors.newFixedThreadPool(2);
        try {var tasks=pool.invokeAll(List.<Callable<AccountSitesService.Added>>of(()->service.add(bearer(a),CSRF,null,"https://example.com"),()->service.add(bearer(a),CSRF,null,"https://example.com")));
            assertEquals(tasks.get(0).get().site().siteId(),tasks.get(1).get().site().siteId());
        } finally {pool.shutdownNow();}
        var anonymous=personal.create("https://example.com/claimed",null,null);
        personal.claim(bearer(a),CSRF,anonymous.audit().runId(),anonymous.proof());
        var site=service.list(bearer(a),20,null).items().getFirst();assertEquals(2,site.urlCount());
        assertEquals(2,service.urls(bearer(a),Long.parseLong(site.siteId()),20,null).items().size());
    }

    @Test void sitesHttpRequiresSessionCsrfAndOwnership() throws Exception {
        var a=user("sites-http-a@example.com",true);var b=user("sites-http-b@example.com",true);
        try(var http=new HttpFixture()) {
            assertEquals(401,http.call("GET","/account/sites",null,null,false).statusCode());
            assertEquals(403,http.call("POST","/account/sites",bearer(a),"{\"url\":\"https://example.com\"}",false).statusCode());
            var added=http.call("POST","/account/sites",bearer(a),"{\"url\":\"https://example.com\"}",true);
            assertEquals(200,added.statusCode());assertTrue(added.headers().firstValue("cache-control").orElse("").contains("no-store"));
            String id=mapper.readTree(added.body()).path("site").path("siteId").asText();
            assertEquals(404,http.call("GET","/account/sites/"+id,bearer(b),null,false).statusCode());
            assertEquals(200,http.call("GET","/account/sites/"+id+"/urls",bearer(a),null,false).statusCode());
            assertEquals(400,http.call("GET","/account/sites?cursor=-1",bearer(a),null,false).statusCode());
            assertEquals(400,http.call("POST","/account/sites",bearer(a),"{\"url\":\"http://localhost\"}",true).statusCode());
        }
    }
    @Test void migrationBackfillsAllOwnersIncludingArchivedButNeverAnonymous() throws Exception {
        migrateHistoricalRowsTo("11");
        var a=user("backfill-a@example.com",true);var b=user("backfill-b@example.com",true);
        long aid=a.context().user().getId(),bid=b.context().user().getId();
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id="+aid+" WHERE id IN (1,2)");
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id="+bid+" WHERE id=3");
        try(var c=source.getConnection();var s=c.prepareStatement("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,owner_user_id,created_at) VALUES(?,1,'FAILED',?,'2026-10-09')")) {
            for(int n=0;n<1005;n++){s.setLong(1,1000+n);s.setLong(2,aid);s.addBatch();}s.executeBatch();
        }
        auth.archive(bearer(b),CSRF,true);
        org.flywaydb.core.Flyway.configure().dataSource(source).load().migrate();
        org.flywaydb.core.Flyway.configure().dataSource(source).load().migrate();
        try(var connection=source.getConnection()) {
            new db.migration.V13__backfill_account_sites().migrate(new org.flywaydb.core.api.migration.Context() {
                public java.sql.Connection getConnection(){return connection;}
                public org.flywaydb.core.api.configuration.Configuration getConfiguration(){return null;}
            });
        }
        assertEquals(1,sites().list(bearer(a),20,null).items().size());
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM ARG_ACCOUNT_SITE")){r.next();assertEquals(2,r.getInt(1));}
        error(401,()->sites().list(bearer(b),20,null));
    }

    @Test void manySitesUseBoundedProjectionsAndDeterministicPages() throws Exception {
        var a=user("many-sites@example.com",true);long owner=a.context().user().getId();
        for(int n=0;n<25;n++) {
            int id=1000+n;
            sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES("+id+",'site"+n+".example.com')");
            sql("INSERT INTO ARG_ACCOUNT_SITE(id,owner_user_id,domain_id,created_at) VALUES("+id+","+owner+","+id+",'2026-10-11')");
        }
        var statements=new ArrayList<String>();
        var monitored=(javax.sql.DataSource)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{javax.sql.DataSource.class},(proxy,method,args)->{
            try {
                var result=method.invoke(source,args);
                if(result instanceof java.sql.Connection connection) return java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{java.sql.Connection.class},(cp,cm,ca)->{
                    if(cm.getName().equals("prepareStatement")) statements.add((String)ca[0]);
                    try{return cm.invoke(connection,ca);}catch(java.lang.reflect.InvocationTargetException e){throw e.getCause();}
                });
                return result;
            } catch(java.lang.reflect.InvocationTargetException e){throw e.getCause();}
        });
        var countedDao=new AccountDao(new com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl(monitored,new com.querydsl.sql.Configuration(com.querydsl.sql.MySQLTemplates.DEFAULT)));
        var countedSessions=new AccountSessionService(countedDao,signer,tokens,settings,clock);
        var countedSites=new AccountSitesService(countedDao,countedSessions,new UrlNormalizer(),new DomainService(new DomainDao(countedDao.transactions)),new AuditDao(countedDao.transactions),clock);
        var first=countedSites.list(bearer(a),20,null);
        long reads=statements.stream().filter(s->s.stripLeading().toLowerCase().startsWith("select")).count();
        assertEquals(3,reads,"Two auth locks plus one bounded projection; no per-site query");
        assertTrue(statements.stream().noneMatch(s->s.contains("report_json")||s.contains("result_json")));
        assertTrue(mapper.writeValueAsBytes(first).length<10000);
        var second=countedSites.list(bearer(a),20,first.nextCursor());assertEquals(20,first.items().size());assertEquals(5,second.items().size());assertNull(second.nextCursor());
        var ids=new HashSet<String>();first.items().forEach(s->assertTrue(ids.add(s.siteId())));second.items().forEach(s->assertTrue(ids.add(s.siteId())));
    }
}
