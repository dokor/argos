package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.security.AdminReadAccess;

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

        public void send(String recipient, AccountEmail.Message message) {
            if (fail) throw new AccountError(503, "mail_unavailable");
            messages.add(new Message(recipient, message.text()));
        }

        String token(String email) {
            String text =
                    messages.stream()
                            .filter(m -> m.recipient().equals(email))
                            .reduce((a, b) -> b)
                            .orElseThrow()
                            .text();
            var match = java.util.regex.Pattern.compile("(?:#token=|[Cc]ode de confirmation : |Confirmation code: )([A-Za-z0-9_-]{43})").matcher(text);
            if (!match.find()) throw new AssertionError("No account token in captured email");
            return match.group(1);
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
                        settings, new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock),new AccountRunReadDao(dao.transactions));
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
    void personalStatusReadsExcludeInternalPayloadsOnMariaDb() throws Exception {
        var owner = user("read-owner@example.com", true);
        var other = user("read-other@example.com", true);
        var created = personal.create("https://example.com", bearer(owner), CSRF).audit();
        sql("UPDATE ARG_AUDIT_RUN SET result_json=REPEAT('x',1048576),last_error='internal-only',claim_token='private-worker' WHERE id=" + created.runId());
        var projection = dao.transaction(c -> new AccountRunReadDao(dao.transactions)
            .owned(created.runId(), owner.context().user().getId(), c).orElseThrow());
        assertEquals(created.auditId(), projection.getAuditId());
        assertNull(projection.getResultJson());
        assertNull(projection.getLastError());
        assertNull(projection.getReportTokenHash());
        assertNull(projection.getClaimToken());
        var status = personal.list(bearer(owner), 1).getFirst();
        assertEquals(Set.of("runId", "status", "createdAt", "moduleStatuses", "startedAt", "finishedAt", "profileSnapshot"), status.keySet());
        assertEquals(Long.toString(created.runId()), status.get("runId"));
        assertEquals("QUEUED", status.get("status"));
        assertEquals("PENDING", personal.get(bearer(owner), created.runId()).get("reportAvailability"));
        assertTrue(personal.list(bearer(other), 100).isEmpty());
        error(404, () -> personal.get(bearer(other), created.runId()));
    }
    @Test
    void localizedEmailsCompleteVerificationAndResetWithoutReusingTokens() {
        String email = "localized@example.com";
        auth.register(email, PASSWORD, "Fixture", "en");
        assertTrue(mail.messages.getLast().text().contains("/en/account/verify#token="));
        String verification = mail.token(email);
        auth.verify(verification);
        assertEquals("ACTIVE", auth.login(email, PASSWORD, CSRF).context().user().getState());
        error(400, () -> auth.verify(verification));
        int count = mail.messages.size();
        auth.register(email, PASSWORD, "Fixture", "en");
        auth.send("absent@example.com", "RESET", "en");
        assertEquals(count, mail.messages.size());
        auth.send(email, "RESET", "en");
        assertTrue(mail.messages.getLast().text().contains("/en/account/reset#token="));
        String reset = mail.token(email);
        auth.reset(reset, PASSWORD + " changed");
        assertEquals("ACTIVE", auth.login(email, PASSWORD + " changed", CSRF).context().user().getState());
        error(400, () -> auth.reset(reset, PASSWORD));
        error(401, () -> auth.login(email, PASSWORD, CSRF));
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

    @Test void statisticsHttpRequiresCurrentAdministratorAndOnlyExposesAggregates() throws Exception {
        var admin=administrator(); var ordinary=user("statistics-user@example.com",true);
        try(var http=new HttpFixture()) {
            String path="/account/admin/statistics";
            assertEquals(401,http.call("GET",path,null,null,false).statusCode());
            assertEquals(401,http.call("GET",path,"Bearer synthetic-server-credential",null,false).statusCode());
            assertEquals(403,http.call("GET",path,bearer(ordinary),null,false).statusCode());
            var response=http.call("GET",path+"?period=7",bearer(admin),null,false);
            assertEquals(200,response.statusCode());
            assertEquals("private, no-store",response.headers().firstValue("Cache-Control").orElseThrow());
            var body=mapper.readTree(response.body());
            assertEquals(Set.of("generatedAt","from","period","accounts","analyses","domains"),
                mapper.convertValue(body,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>() {}).keySet());
            assertFalse(response.body().contains("example.com"));
            assertFalse(response.body().contains("reportToken"));
            assertEquals(400,http.call("GET",path+"?period=7&period=30",bearer(admin),null,false).statusCode());
            assertEquals(400,http.call("GET",path+"?period=365",bearer(admin),null,false).statusCode());
            assertEquals(400,http.call("GET",path+"?q=private",bearer(admin),null,false).statusCode());
            sql("UPDATE ARG_ACCOUNT_USER SET role='USER' WHERE id="+admin.context().user().getId());
            assertEquals(403,http.call("GET",path,bearer(admin),null,false).statusCode());
        }
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
                                            new AccountRateLimiter(dao, tokens, clock, settings), new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock),new AccountHistoryService(dao,sessions,mapper,clock)));
            config.register(new com.dokor.argos.webservices.api.account.DomainDiscoveriesWs(discoveries(),new AccountCsrf(settings)));
            config.register(new com.dokor.argos.webservices.api.account.UsageHistoryWs(new UsageHistoryService(sessions,new UsagePolicy(ConfigFactory.empty()),clock)));
            config.register(new com.dokor.argos.webservices.api.account.ConnectedAnalysesWs(connectedAnalyses(),new AccountCsrf(settings)));
            config.register(new com.dokor.argos.webservices.api.account.AdminWs(administration(),new AccountCsrf(settings)));
            config.register(new com.dokor.argos.webservices.api.account.AdminStatisticsWs(new AdminStatisticsService(sessions,new AdminStatisticsDao(),clock)));
            config.register(new com.dokor.argos.webservices.api.feedback.FeedbackWs(feedback(),new AccountCsrf(settings),new AccountRateLimiter(dao,tokens,clock,settings)));
            config.register(new com.dokor.argos.webservices.api.feedback.FeedbackAdminWs(feedback(),new AccountCsrf(settings)));
            config.register(new com.dokor.argos.webservices.api.account.AccountReportIntroductionWs(new AccountReportIntroductionService(sessions,mapper,clock,tokens),new AccountCsrf(settings)));
            var sharing = new ReportSharingService(dao,sessions,reader,tokens,clock,new com.dokor.argos.db.dao.ReportSharingDao());
            config.register(new com.dokor.argos.webservices.api.account.ReportAccessWs(sharing,new AccountCsrf(settings)));
            config.register(new com.dokor.argos.webservices.api.report.SharedReportsWs(sharing));
            var admin = mock(com.dokor.argos.services.configuration.ConfigurationService.class);
            when(admin.adminApiToken()).thenReturn("synthetic-server-credential");
            config.register(
                    new com.dokor.argos.webservices.api.audits.AuditsWs(
                            auditService,
                            mock(AuditQueryService.class),
                            new AdminReadAccess(admin),
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

@Test void administrationQuotaChangeRacingAdmissionSerializesWithoutLosingUsage() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=2");var a=administrator();var u=user("quota-race@example.com",true);
        var admin=administration();long target=u.context().user().getId();var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var change=pool.submit(()->{barrier.await();try{admin.entitlement(bearer(a),CSRF,target,change(target,"FREE",0L));return true;}catch(AccountError e){assertEquals(409,e.getResponse().getStatus());return false;}});
            var launch=pool.submit(()->{
                barrier.await();
                try {personal.create("https://example.com",bearer(u),CSRF);return true;}
                catch(jakarta.ws.rs.WebApplicationException e) {assertEquals(429,e.getResponse().getStatus());return false;}
            });
            boolean changed=change.get(15,TimeUnit.SECONDS);
            boolean accepted=launch.get(15,TimeUnit.SECONDS);assertNotEquals(changed,accepted);
            var view=personal.usage(bearer(u));assertEquals(changed?0:2,view.limit());
            assertEquals(accepted?1:0,view.reserved());assertEquals(0,view.used());
            assertEquals(changed?1:0,count("ARG_ADMIN_EVENT"));assertEquals(accepted?1:0,count("ARG_AUDIT_RUN WHERE owner_user_id="+target));
        }
    }
    AdminService.Entitlement change(long id,String offer,Long limit) {
        long version=dao.transaction(c->dao.user(id,c,false)).getAdminVersion();
        return new AdminService.Entitlement(offer,limit,version,com.dokor.argos.services.connected.contract.ConnectedContracts.AdminReason.PLAN_ADJUSTMENT,true);
    }
    com.dokor.argos.services.connected.contract.ConnectedContracts.SuspensionInput suspendInput(long id,boolean value) {
        return new com.dokor.argos.services.connected.contract.ConnectedContracts.SuspensionInput(value,dao.transaction(c->dao.user(id,c,false)).getAdminVersion(),com.dokor.argos.services.connected.contract.ConnectedContracts.AdminReason.ABUSE_REVIEW,true);
    }
    @Test void administrationSuspensionRevokesBlocksAndRestoresWithoutRevivingSessions() throws Exception {
        var a=administrator();var u=user("suspended@example.com",true);long id=u.context().user().getId();var admin=administration();
        var run=personal.create("https://example.com",bearer(u),CSRF);long totalRuns=count("ARG_AUDIT_RUN"),ledger=count("ARG_USAGE_RUN");
        var stale=change(id,"PRO",10L);
        admin.suspension(bearer(a),CSRF,id,suspendInput(id,true));
        assertEquals("SUSPENDED",admin.user(bearer(a),id).get("state"));
        assertEquals(totalRuns,count("ARG_AUDIT_RUN"));assertEquals(ledger,count("ARG_USAGE_RUN"));
        assertEquals("QUEUED",dao.transactions.selectQuery().select(QAuditRun.auditRun.status).from(QAuditRun.auditRun).where(QAuditRun.auditRun.id.eq(run.audit().runId())).fetchOne());
        error(401,()->auth.login("suspended@example.com",PASSWORD,CSRF));
        error(401,()->sessions.renew(bearer(u),CSRF));error(401,()->personal.create("https://example.com",bearer(u),CSRF));
        var policy=new UsagePolicy(ConfigFactory.empty());var usage=new UsageService(dao.transactions,policy,clock);
        error(403,()->dao.transaction(c->{usage.admit(id,c);return null;}));
        error(409,()->admin.entitlement(bearer(a),CSRF,id,stale));
        var claimed=runs.claim(run.audit().runId()).orElseThrow();var admitted=new AuditRunDao(dao.transactions).findById(run.audit().runId());
        publisher.completeAndPublish(admitted.getId(),new AuditDao(dao.transactions).findById(admitted.getAuditId()),mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),"{}",claimed);
        assertEquals(1,count("ARG_USAGE_RUN WHERE user_id="+id+" AND state='COUNTED'"));
        assertEquals("COMPLETED",new AuditRunDao(dao.transactions).findById(admitted.getId()).getStatus());
        admin.suspension(bearer(a),CSRF,id,suspendInput(id,false));
        assertEquals("ACTIVE",admin.user(bearer(a),id).get("state"));error(401,()->sessions.renew(bearer(u),CSRF));
        assertNotNull(auth.login("suspended@example.com",PASSWORD,CSRF));assertEquals(2,count("ARG_ADMIN_EVENT"));
        var events=admin.events(bearer(a),20,null,Long.toString(id));assertEquals(2,events.items().size());
        assertEquals("SUSPENDED",events.items().getFirst().get("oldState"));assertEquals("ACTIVE",events.items().getFirst().get("newState"));
        assertEquals("ABUSE_REVIEW",events.items().getFirst().get("reasonCode"));assertNotNull(events.items().getFirst().get("requestId"));
    }
    @Test void administrationSuspensionPreservesPendingAndProtectsAllAdmins() throws Exception {
        var a=administrator();var u=user("pending-suspended@example.com",false);long id=u.context().user().getId();var admin=administration();String oldToken=mail.token("pending-suspended@example.com");
        admin.suspension(bearer(a),CSRF,id,suspendInput(id,true));error(400,()->auth.verify(oldToken));
        admin.suspension(bearer(a),CSRF,id,suspendInput(id,false));assertEquals("PENDING",admin.user(bearer(a),id).get("state"));error(400,()->auth.verify(oldToken));
        long actor=a.context().user().getId();error(403,()->admin.suspension(bearer(a),CSRF,actor,suspendInput(actor,true)));
        sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN',state='ACTIVE' WHERE id="+id);error(403,()->admin.suspension(bearer(a),CSRF,id,suspendInput(id,true)));
        assertEquals(2,count("ARG_ADMIN_EVENT"));
    }
    @Test void suspendedAccountCannotCompleteSocialLoginOrResetPassword() throws Exception {
        var a=administrator();var u=user("social-suspended@example.com",true);long id=u.context().user().getId();
        dao.transaction(c->{var identity=new AccountIdentity();identity.setUserId(id);identity.setProvider("github");identity.setSubject("suspended-social");identity.setCreatedAt(clock.instant());dao.save(identity,c);return null;});
        when(oauthClient.exchange(eq("github"),anyString(),anyString(),anyString())).thenReturn(new AccountOAuthClient.Identity("suspended-social","social-suspended@example.com",true,"Fixture"));
        var start=oauth.start("github","login","/account",null,CSRF);
        auth.send("social-suspended@example.com","RESET");String reset=mail.token("social-suspended@example.com");
        administration().suspension(bearer(a),CSRF,id,suspendInput(id,true));
        error(401,()->oauth.finish("github",start.state(),start.browser(),"code",null,CSRF));
        error(400,()->auth.reset(reset,PASSWORD+" changed"));
    }
    @Test void administrationStaleConcurrentWritesProduceExactlyOneEvent() throws Exception {
        var a=administrator();var b=user("second-admin@example.com",true);sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id="+b.context().user().getId());
        var u=user("version-target@example.com",true);long id=u.context().user().getId();var admin=administration();var body=change(id,"PRO",10L);var gate=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var tasks=new ArrayList<Future<Integer>>();
            for(var actor:List.of(a,b))tasks.add(pool.submit(()->{gate.await();try{admin.entitlement(bearer(actor),CSRF,id,body);return 200;}catch(AccountError e){return e.getResponse().getStatus();}}));
            var codes=new ArrayList<Integer>();for(var task:tasks)codes.add(task.get(15,TimeUnit.SECONDS));Collections.sort(codes);assertEquals(List.of(200,409),codes);
        }
        assertEquals(1,count("ARG_ADMIN_EVENT"));assertEquals(2L,((Number)admin.user(bearer(a),id).get("version")).longValue());
    }
    @Test void administrationSuspensionHttpIsStrictAndAtomicOnJournalFailure() throws Exception {
        var a=administrator();var u=user("http-suspend@example.com",true);long id=u.context().user().getId();String path="/account/admin/users/"+id+"/suspension";
        String body="{\"suspended\":true,\"expectedVersion\":1,\"reasonCode\":\"ABUSE_REVIEW\",\"confirmation\":true}";
        try(var http=new HttpFixture()) {
            assertEquals(403,http.call("POST",path,bearer(u),body,true).statusCode());assertEquals(403,http.call("POST",path,bearer(a),body,false).statusCode());
            for(String bad:List.of(body.replace("ABUSE_REVIEW","free text"),body.replace("true","false").replace("\"suspended\":false","\"suspended\":true"),body.replace("}",",\"role\":\"ADMIN\"}")))assertEquals(400,http.call("POST",path,bearer(a),bad,true).statusCode());
            assertEquals(400,http.call("GET","/account/admin/users?limit=1&limit=2",bearer(a),null,false).statusCode());
            assertEquals(200,http.call("GET","/account/admin/entitlement-options",bearer(a),null,false).statusCode());
        }
        var failing=spy(dao);doThrow(new IllegalStateException("synthetic failure")).when(failing).save(any(AdminEvent.class),eq(QAdminEvent.table),any(java.sql.Connection.class));var policy=new UsagePolicy(ConfigFactory.empty());
        var broken=new AdminService(failing,sessions,new UsageService(dao.transactions,policy,clock),policy,reader,mapper,clock);
        assertThrows(IllegalStateException.class,()->broken.suspension(bearer(a),CSRF,id,suspendInput(id,true)));
        assertEquals("ACTIVE",dao.transaction(c->dao.user(id,c,false)).getState());assertNotNull(sessions.renew(bearer(u),CSRF));assertEquals(0,count("ARG_ADMIN_EVENT"));
    }
    boolean bootstrap(long id,boolean apply) throws Exception {
        try(var c=source.getConnection()) {
            return com.dokor.argos.operations.FirstAdminBootstrap.execute(c,c.getCatalog(),id,apply);
        }
    }
    @Test void firstAdminOnFreshDatabaseRequiresVerifiedIdentityAndReauthentication() throws Exception {
        var flyway=org.flywaydb.core.Flyway.configure().dataSource(source).cleanDisabled(false).load();
        flyway.clean();flyway.migrate();
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at) VALUES(43,'no-identity@example.com','Fixture','ACTIVE',CURRENT_TIMESTAMP)");
        assertThrows(IllegalStateException.class,()->bootstrap(43,true));
        sql("UPDATE ARG_ACCOUNT_USER SET state='SUSPENDED' WHERE id=43");
        assertThrows(IllegalStateException.class,()->bootstrap(43,true));
        var pending=user("operator@example.com",false);long id=pending.context().user().getId();
        assertThrows(IllegalStateException.class,()->bootstrap(id,true));
        auth.verify(mail.token("operator@example.com"));
        var verified=auth.login("operator@example.com",PASSWORD,CSRF);
        try(var c=source.getConnection()) {
            assertThrows(IllegalStateException.class,()->com.dokor.argos.operations.FirstAdminBootstrap.execute(c,"wrong_database",id,true));
        }
        long events=count("ARG_ACCOUNT_SECURITY_EVENT");
        assertFalse(bootstrap(id,false));assertEquals(events,count("ARG_ACCOUNT_SECURITY_EVENT"));
        assertEquals("USER",dao.transaction(c->dao.user(id,c,false)).getRole());
        assertNotNull(sessions.renew(bearer(verified),CSRF));
        assertTrue(bootstrap(id,true));
        error(401,()->sessions.renew(bearer(verified),CSRF));
        var fresh=auth.login("operator@example.com",PASSWORD,CSRF);
        assertEquals("ADMIN",fresh.context().user().getRole());assertEquals("FREE",fresh.context().user().getOffer());
        assertEquals(id,Long.parseLong(administration().user(bearer(fresh),id).get("id").toString()));
        assertThrows(IllegalStateException.class,()->bootstrap(id,true));
        sql("UPDATE ARG_ACCOUNT_USER SET state='ARCHIVED' WHERE id="+id);
        assertThrows(IllegalStateException.class,()->bootstrap(id,true));
    }
    @Test void firstAdminIsUniqueUnderConcurrentOperatorsAndRollsBackJournalFailure() throws Exception {
        var a=user("operator-a@example.com",true);var b=user("operator-b@example.com",true);
        long aid=a.context().user().getId(),bid=b.context().user().getId();
        sql("ALTER TABLE ARG_ACCOUNT_SECURITY_EVENT ADD CONSTRAINT ck_bootstrap_fixture CHECK(action <> 'bootstrap_admin')");
        try {
            assertThrows(java.sql.SQLException.class,()->bootstrap(aid,true));
            assertEquals("USER",dao.transaction(c->dao.user(aid,c,false)).getRole());
            assertNotNull(sessions.renew(bearer(a),CSRF));
        } finally {sql("ALTER TABLE ARG_ACCOUNT_SECURITY_EVENT DROP CONSTRAINT ck_bootstrap_fixture");}
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var results=new ArrayList<Future<Boolean>>();
            for(long id:List.of(aid,bid)) results.add(pool.submit(()->{
                start.await();try{return bootstrap(id,true);}catch(IllegalStateException expected){assertEquals("admin_already_exists",expected.getMessage());return false;}
            }));
            start.countDown();int changed=0;for(var result:results)if(result.get(15,TimeUnit.SECONDS))changed++;
            assertEquals(1,changed);
        }
        try(var c=source.getConnection();var st=c.createStatement();var r=st.executeQuery("SELECT COUNT(*) FROM ARG_ACCOUNT_SECURITY_EVENT WHERE action='bootstrap_admin'")) {r.next();assertEquals(1,r.getLong(1));}
    }
    AdminService administration() {
        var policy=new UsagePolicy(ConfigFactory.parseString("usage.offers.FREE.monthly-limit=2\nusage.offers.PRO.monthly-limit=10"));
        return new AdminService(dao,sessions,new UsageService(dao.transactions,policy,clock),policy,reader,mapper,clock);
    }
    @Test void administratorsCanReadEachOtherConcurrentlyWithoutCrossingAccountLocks() throws Exception {
        var a=administrator();var b=user("cross-admin@example.com",true);
        sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id="+b.context().user().getId());
        var ready=new CountDownLatch(2);var release=new CountDownLatch(1);
        var synchronizedSessions=spy(sessions);
        doAnswer(call->{
            var context=call.callRealMethod(); // Both transactions hold their own account/session first.
            ready.countDown();assertTrue(release.await(10,TimeUnit.SECONDS));return context;
        }).when(synchronizedSessions).require(anyString(),isNull(),eq(true),eq(false),any(java.sql.Connection.class));
        var policy=new UsagePolicy(ConfigFactory.parseString("usage.offers.FREE.monthly-limit=2"));
        var service=new AdminService(dao,synchronizedSessions,new UsageService(dao.transactions,policy,clock),policy,reader,mapper,clock);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->service.user(bearer(a),b.context().user().getId()));
            var second=pool.submit(()->service.user(bearer(b),a.context().user().getId()));
            try {assertTrue(ready.await(10,TimeUnit.SECONDS));}finally{release.countDown();}
            assertEquals(b.context().user().getId().toString(),first.get(15,TimeUnit.SECONDS).get("id"));
            assertEquals(a.context().user().getId().toString(),second.get(15,TimeUnit.SECONDS).get("id"));
        }
        assertEquals(0,count("ARG_USAGE_RUN"));assertEquals(0,count("ARG_ADMIN_EVENT"));
    }
    AccountSessionService.Issued administrator() throws Exception {
        var a=user("admin@example.com",true);
        sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id="+a.context().user().getId());
        return a;
    }
    @Test void administrationHttpDeniesEveryReadToNonAdminsAndHonorsRevocation() throws Exception {
        var a=administrator();var regular=user("regular@example.com",true);var pending=user("pending-admin@example.com",false);
        sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id="+pending.context().user().getId());
        try(var http=new HttpFixture()) {
            var routes=List.of("queue","users","users/"+regular.context().user().getId(),"runs","runs/1","runs/1/report","events");
            for(String route:routes) {
                String path="/account/admin/"+route;
                assertEquals(401,http.call("GET",path,null,null,false).statusCode(),path);
                assertEquals(401,http.call("GET",path,"Bearer synthetic-server-credential",null,false).statusCode(),path);
                assertEquals(403,http.call("GET",path,bearer(regular),null,false).statusCode(),path);
                assertEquals(403,http.call("GET",path,bearer(pending),null,false).statusCode(),path);
                var response=http.call("GET",path,bearer(a),null,false);
                assertEquals(200,response.statusCode(),response.body());
                assertTrue(response.headers().firstValue("cache-control").orElse("").contains("no-store"));
            }
            sql("UPDATE ARG_ACCOUNT_USER SET role='USER' WHERE id="+a.context().user().getId());
            for(String route:routes) assertEquals(403,http.call("GET","/account/admin/"+route,bearer(a),null,false).statusCode(),route);
            sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id="+a.context().user().getId());
            sessions.with(bearer(a),CSRF,true,false,(ctx,c)->{sessions.revoke(ctx.session(),c);return null;});
            for(String route:routes) assertEquals(401,http.call("GET","/account/admin/"+route,bearer(a),null,false).statusCode(),route);
            var fresh=dao.transaction(c->sessions.create(dao.user(a.context().user().getId(),c,true),CSRF,c));
            clock.now=clock.now.plus(settings.jwtTtl()).plusSeconds(1);
            for(String route:routes) assertEquals(401,http.call("GET","/account/admin/"+route,bearer(fresh),null,false).statusCode(),route);
            var archived=dao.transaction(c->sessions.create(dao.user(a.context().user().getId(),c,true),CSRF,c));
            sql("UPDATE ARG_ACCOUNT_USER SET state='ARCHIVED' WHERE id="+a.context().user().getId());
            for(String route:routes) assertEquals(401,http.call("GET","/account/admin/"+route,bearer(archived),null,false).statusCode(),route);
        }
    }
    @Test void administrationReadsUnlimitedInheritedAndZeroOverrideQuotas() throws Exception {
        var a=administrator();var u=user("unlimited@example.com",true);
        long id=u.context().user().getId();var policy=new UsagePolicy(ConfigFactory.empty());
        var admin=new AdminService(dao,sessions,new UsageService(dao.transactions,policy,clock),policy,reader,mapper,clock);
        var page=admin.users(bearer(a),"unlimited",null,null,20,null);
        var unlimited=(UsageService.Snapshot)page.items().getFirst().get("usage");
        assertNull(unlimited.limit());assertNull(unlimited.available());assertTrue(unlimited.canLaunch());
        assertNull(((UsageService.Snapshot)admin.user(bearer(a),id).get("usage")).limit());
        admin.entitlement(bearer(a),CSRF,id,change(id,"FREE",0L));
        var zero=(UsageService.Snapshot)admin.user(bearer(a),id).get("usage");
        assertEquals(0L,zero.limit());assertEquals(0L,zero.available());assertFalse(zero.canLaunch());
        admin.entitlement(bearer(a),CSRF,id,change(id,"FREE",null));
        assertNull(((UsageService.Snapshot)admin.user(bearer(a),id).get("usage")).limit());
    }
    @Test void administrationPaginationFiltersQueueAndSafeFailureDetail() throws Exception {
        var a=administrator();var u=user("find-me@example.com",true);var admin=administration();String token=bearer(a);
        var page=admin.users(token,"FIND-ME","ACTIVE","FREE",1,null);
        assertEquals(1,page.items().size());assertEquals(u.context().user().getId().toString(),page.items().getFirst().get("id"));
        page=admin.users(token,null,null,null,1,null);assertNotNull(page.nextCursor());
        assertEquals(1,admin.users(token,null,null,null,1,page.nextCursor()).items().size());
        assertTrue(admin.users(token,"%' OR 1=1 --",null,null,20,null).items().isEmpty());
        assertEquals(1,((Number)admin.queue(token).get("queued")).longValue());
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id="+u.context().user().getId()+",status='FAILED',last_error='secret URL https://example.com/?token=hidden',module_statuses='{\"http\":\"FAILED\",\"html\":\"secret\",\"injected\":\"hidden\"}' WHERE id=2");
        var filtered=admin.runs(token,u.context().user().getId().toString(),"example.com","FAILED",null,null,20,null);
        assertEquals(1,filtered.items().size());assertEquals("2",filtered.items().getFirst().get("id"));
        String json=mapper.writeValueAsString(admin.run(token,2));assertTrue(json.contains("analysis_failed"));assertTrue(json.contains("FAILED"));
        assertFalse(json.contains("hidden"));assertFalse(json.contains("secret"));assertFalse(json.contains("last_error"));
        assertFalse(mapper.writeValueAsString(admin.runs(token,null,null,null,null,null,20,null)).contains("token"));
        assertEquals(4,admin.runs(token,"anonymous",null,null,null,null,20,null).items().size());
        assertTrue(admin.runs(token,null,null,null,"2000-01-01","2000-01-02",20,null).items().isEmpty());
        error(400,()->admin.runs(token,null,null,null,"2026-11-01","2026-10-01",20,null));
        error(400,()->admin.users(token,null,null,null,101,null));
        error(400,()->admin.users(token,null,null,null,20,"9223372036854775808"));
        error(404,()->admin.report(token,3));
        error(404,()->admin.run(token,999999));
    }
    @Test void administrationEntitlementsRequireCsrfRecentSessionAndStrictFieldsOverHttp() throws Exception {
        var a=administrator();var u=user("target@example.com",true);String path="/account/admin/users/"+u.context().user().getId()+"/entitlement";
        String body="{\"offer\":\"PRO\",\"monthlyLimit\":0,\"confirmation\":true,\"expectedVersion\":1,\"reasonCode\":\"PLAN_ADJUSTMENT\"}";
        try(var http=new HttpFixture()) {
            assertEquals(403,http.call("PATCH",path,bearer(u),body,true).statusCode());
            assertEquals(403,http.call("PATCH",path,bearer(a),body,false).statusCode());
            for(String bad:List.of(body.replace("\"PRO\"","\"NOPE\""),body.replace(":0",":-1"),body.replace(":0",":1.5"),body.replace("true","false"),body.replace("\"offer\"","\"role\""),body.replace("}",",\"role\":\"ADMIN\"}"))) {
                assertEquals(400,http.call("PATCH",path,bearer(a),bad,true).statusCode(),bad);
            }
            assertEquals(200,http.call("PATCH",path,bearer(a),body,true).statusCode());
            assertEquals("USER",dao.transaction(c->dao.user(u.context().user().getId(),c,false)).getRole());
            assertEquals(1,count("ARG_ADMIN_EVENT"));
            clock.now=clock.now.plus(settings.recentTtl()).plusSeconds(1);
            assertEquals(403,http.call("PATCH",path,bearer(a),body,true).statusCode());
        }
    }
    @Test void administrationLimitChangesAreAtomicAuditedAndAppliedToAdmission() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=2");var a=administrator();var u=user("quota-admin@example.com",true);
        var admin=administration();long target=u.context().user().getId();String token=bearer(a);
        var created=personal.create("https://example.com",bearer(u),CSRF);
        var modules=(Map<?,?>)admin.run(token,created.audit().runId()).get("modules");
        assertEquals(com.dokor.argos.services.analysis.AuditModule.ordered().size(),modules.size());
        assertTrue(modules.values().stream().allMatch("PENDING"::equals));
        error(409,()->admin.entitlement(token,CSRF,target,change(target,"FREE",0L)));
        assertEquals(0,count("ARG_ADMIN_EVENT"));
        admin.entitlement(token,CSRF,target,change(target,"FREE",1L));
        assertFalse(personal.usage(bearer(u)).canLaunch());assertEquals(1,personal.usage(bearer(u)).reserved());
        assertEquals(429,assertThrows(jakarta.ws.rs.WebApplicationException.class,()->personal.create("https://example.com",bearer(u),CSRF)).getResponse().getStatus());
        assertEquals(false,admin.entitlement(token,CSRF,target,change(target,"FREE",1L)).get("changed"));
        assertEquals(1,count("ARG_ADMIN_EVENT"));
        var event=admin.events(token,20,null).items().getFirst();
        assertEquals(a.context().user().getId().toString(),event.get("actorId"));assertEquals(Long.toString(target),event.get("targetId"));
        assertEquals("quota-admin@example.com", event.get("targetEmail"));
        admin.entitlement(token,CSRF,target,change(target,"FREE",null));
        assertTrue(personal.usage(bearer(u)).canLaunch());assertEquals(2,personal.usage(bearer(u)).limit());
        assertNotNull(created);
        var failing=spy(dao);
        doThrow(new IllegalStateException("synthetic journal failure")).when(failing).save(any(AdminEvent.class),eq(QAdminEvent.table),any(java.sql.Connection.class));
        var policy=new UsagePolicy(ConfigFactory.parseString("usage.offers.PRO.monthly-limit=10"));
        var broken=new AdminService(failing,sessions,new UsageService(dao.transactions,policy,clock),policy,reader,mapper,clock);
        assertThrows(IllegalStateException.class,()->broken.entitlement(token,CSRF,target,change(target,"PRO",5L)));
        assertEquals("FREE",dao.transaction(c->dao.user(target,c,false)).getOffer());
        assertEquals(2,count("ARG_ADMIN_EVENT"));assertNull(admin.user(token,target).get("monthlyLimit"));
        sql("UPDATE ARG_ADMIN_EVENT SET created_at='2000-01-01'");
        assertTrue(admin.events(token,20,null).items().isEmpty());
        admin.entitlement(token,CSRF,target,change(target,"PRO",null));
        assertEquals(1,count("ARG_ADMIN_EVENT"));
        assertEquals(1,dao.transactions.selectQuery().select(QAdminEvent.table).from(QAdminEvent.table).fetch().size());
        assertNotNull(dao.transactions.selectQuery().select(QUsageAccount.table).from(QUsageAccount.table).where(QUsageAccount.table.id.eq(target)).fetchOne());
    }
    @Test void administrativeJournalResolvesCurrentIdentitiesWithoutChangingAuditReferences() throws Exception {
        var a=administrator();var u=user("journal-target@example.com",true);var admin=administration();
        long target=u.context().user().getId(),actor=a.context().user().getId();
        admin.entitlement(bearer(a),CSRF,target,change(target,"PRO",5L));
        sql("UPDATE ARG_ACCOUNT_USER SET display_name='Current name' WHERE id="+target);
        var event=admin.events(bearer(a),1,null,Long.toString(target)).items().getFirst();
        assertEquals("Current name",event.get("targetDisplayName"));
        assertEquals("journal-target@example.com",event.get("targetEmail"));
        assertEquals(Long.toString(actor),event.get("actorId"));assertEquals(Long.toString(target),event.get("targetId"));
        assertNotNull(event.get("actorEmail"));
        error(403,()->admin.events(bearer(u),20,null));error(401,()->admin.events(null,20,null));
        sql("UPDATE ARG_ADMIN_EVENT SET target_id=actor_id");
        event=admin.events(bearer(a),1,null).items().getFirst();
        assertEquals(event.get("actorDisplayName"),event.get("targetDisplayName"));
        assertEquals(event.get("actorEmail"),event.get("targetEmail"));
        sql("UPDATE ARG_ADMIN_EVENT SET target_id="+target);
        sql("UPDATE ARG_ACCOUNT_USER SET state='ARCHIVED' WHERE id="+target);
        event=admin.events(bearer(a),1,null).items().getFirst();
        assertNull(event.get("targetDisplayName"));assertNull(event.get("targetEmail"));
        assertEquals(Long.toString(target),event.get("targetId"));
        sql("UPDATE ARG_ADMIN_EVENT SET target_id=9223372036854775807");
        event=admin.events(bearer(a),1,null).items().getFirst();
        assertNull(event.get("targetDisplayName"));assertNull(event.get("targetEmail"));
        assertEquals("9223372036854775807",event.get("targetId"));
    }
    @Test void administrationCannotChangeArchivedUsersOrOtherAdmins() throws Exception {
        var a=administrator();var b=user("other-admin@example.com",true);var admin=administration();
        long id=b.context().user().getId();sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE id="+id);
        error(403,()->admin.entitlement(bearer(a),CSRF,id,change(id,"FREE",0L)));
        sql("UPDATE ARG_ACCOUNT_USER SET role='USER',state='ARCHIVED' WHERE id="+id);
        error(403,()->admin.entitlement(bearer(a),CSRF,id,change(id,"FREE",0L)));
        assertEquals(0,count("ARG_ADMIN_EVENT"));
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
        // Seed the historical schema directly: current services require later columns.
        long aid=7001,bid=7002;
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at,archived_at) VALUES "
            +"(7001,'backfill-a@example.com','Active owner','ACTIVE','2026-10-01',NULL),"
            +"(7002,NULL,'Archived owner','ARCHIVED','2026-10-01','2026-10-02')");
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id="+aid+" WHERE id IN (1,2)");
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id="+bid+" WHERE id=3");
        try(var c=source.getConnection();var s=c.prepareStatement("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,owner_user_id,created_at) VALUES(?,1,'FAILED',?,'2026-10-09')")) {
            for(int n=0;n<1005;n++){s.setLong(1,1000+n);s.setLong(2,aid);s.addBatch();}s.executeBatch();
        }
        org.flywaydb.core.Flyway.configure().dataSource(source).target("26").load().migrate();
        org.flywaydb.core.Flyway.configure().dataSource(source).target("26").load().migrate();
        try(var connection=source.getConnection()) {
            new db.migration.V13__backfill_account_sites().migrate(new org.flywaydb.core.api.migration.Context() {
                public java.sql.Connection getConnection(){return connection;}
                public org.flywaydb.core.api.configuration.Configuration getConfiguration(){return null;}
            });
        }
        var a=dao.transaction(c->sessions.create(dao.user(aid,c,true),CSRF,c));
        assertEquals(1,sites().list(bearer(a),20,null).items().size());
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM ARG_ACCOUNT_SITE")){r.next();assertEquals(2,r.getInt(1));}
        error(401,()->dao.transaction(c->sessions.create(dao.user(bid,c,true),CSRF,c)));
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

    private com.dokor.argos.services.connected.ConnectedAnalysesService connectedAnalyses() {
        return new com.dokor.argos.services.connected.ConnectedAnalysesService(dao,sessions,sites(),auditService,new UrlNormalizer(),
            new com.dokor.argos.services.connected.ConnectedProfiles(new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy()),mapper,tokens);
    }
    @Test void connectedRecoveryHttpIsOwnerScopedReadOnlyAndPrivatelyCached() throws Exception {
        var a=user("recovery-a@example.com",true);var b=user("recovery-b@example.com",true);
        var key=UUID.randomUUID().toString();
        var accepted=connectedAnalyses().create(bearer(a),CSRF,key,
            new com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput("https://example.com/page","server-default-v1"));
        try(var http=new HttpFixture()) {
            var path="/account/analyses/"+key;
            assertEquals(401,http.call("GET",path,null,null,false).statusCode());
            assertEquals(404,http.call("GET",path,bearer(b),null,false).statusCode());
            var response=http.call("GET",path,bearer(a),null,false);
            assertEquals(200,response.statusCode(),response.body());
            assertEquals("private, no-store",response.headers().firstValue("Cache-Control").orElseThrow());
            assertEquals(accepted.runId(),mapper.readTree(response.body()).path("runId").asText());
            assertEquals(404,http.call("GET","/account/analyses/"+UUID.randomUUID(),bearer(a),null,false).statusCode());
            assertEquals(1,count("ARG_USAGE_RUN WHERE state='RESERVED'"));
            assertEquals(1,count("ARG_AUDIT_RUN WHERE idempotency_key IS NOT NULL"));
        }
    }
    @Test void connectedAdmissionReplaysConcurrentlyAtQuotaAndScopesItsKeyByOwner() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=1");
        var a=user("connected-a@example.com",true); var b=user("connected-b@example.com",true);
        var service=connectedAnalyses(); var key=UUID.randomUUID().toString();
        var input=new com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput("https://example.com/page","server-default-v1");
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->{start.await();return service.create(bearer(a),CSRF,key,input);});
            var second=pool.submit(()->{start.await();return service.create(bearer(a),CSRF,key,input);});
            start.countDown();
            var accepted=first.get(20,TimeUnit.SECONDS);assertEquals(accepted.runId(),second.get(20,TimeUnit.SECONDS).runId());
            assertEquals(1,personal.usage(bearer(a)).reserved());
            assertEquals(accepted.runId(),service.create(bearer(a),CSRF,key,input).runId());
            var run=personal.get(bearer(a),Long.parseLong(accepted.runId()));
            assertEquals("PENDING",run.get("reportAvailability"));
            assertTrue(run.get("profileSnapshot").toString().contains("server-default-v1"));
            error(404,()->personal.get(bearer(b),Long.parseLong(accepted.runId())));
            assertNotEquals(accepted.runId(),service.create(bearer(b),CSRF,key,input).runId());
            error(409,()->service.create(bearer(a),CSRF,key,new com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput("https://example.com/other","server-default-v1")));
            var denied=assertThrows(jakarta.ws.rs.WebApplicationException.class,()->service.create(bearer(a),CSRF,UUID.randomUUID().toString(),input));
            assertEquals(429,denied.getResponse().getStatus());assertEquals(Map.of("error","quota_exceeded","resetsAt",personal.usage(bearer(a)).resetsAt()),denied.getResponse().getEntity());
            assertEquals(2,count("ARG_AUDIT_RUN WHERE idempotency_key IS NOT NULL"));
            assertEquals(2,count("ARG_USAGE_RUN WHERE state='RESERVED'"));
        }
    }
    @Test void connectedAdmissionRejectsUnverifiedPrivateUrlsAndUnsupportedProfilesWithoutReservation() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=1");
        var a=user("connected-valid@example.com",true);var pending=user("connected-pending@example.com",false);
        var service=connectedAnalyses();var key=UUID.randomUUID().toString();
        var input=new com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput("https://example.com","server-default-v1");
        error(401,()->service.create(null,CSRF,key,input));
        error(403,()->service.create(bearer(pending),CSRF,key,input));
        error(400,()->service.create(bearer(a),CSRF,key,new com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput("http://127.0.0.1","server-default-v1")));
        error(400,()->service.create(bearer(a),CSRF,key,new com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput("https://example.com","mobile-v1")));
        assertEquals(0,count("ARG_USAGE_RUN"));assertEquals(0,count("ARG_AUDIT_RUN WHERE idempotency_key IS NOT NULL"));
    }
    @Test void connectedSearchIsOwnerScopedBeforePaginationAndTreatsWildcardsLiterally() {
        var a=user("search-a@example.com",true);var b=user("search-b@example.com",true);
        var service=sites();var one=service.add(bearer(a),CSRF,null,"https://example.com/first");
        service.add(bearer(a),CSRF,null,"https://example.com/needle");
        service.add(bearer(b),CSRF,null,"https://example.com/other");
        assertEquals(1,service.list(bearer(a),1,null,"EXAMPLE").items().size());
        assertTrue(service.list(bearer(a),1,null,"%").items().isEmpty());
        var found=service.urls(bearer(a),Long.parseLong(one.site().siteId()),1,null,"needle");
        assertEquals(1,found.items().size());assertTrue(found.items().getFirst().normalizedUrl().endsWith("/needle"));assertNull(found.nextCursor());
        error(404,()->service.urls(bearer(b),Long.parseLong(one.site().siteId()),1,null,"needle"));
    }
    private void usagePolicy(String config) {
        var usage=new UsageService(dao.transactions,new UsagePolicy(ConfigFactory.parseString(config)),clock);
        var runDao=new AuditRunDao(dao.transactions,usage);
        auditService=new AuditService(new AuditDao(dao.transactions),new AuditRunService(runDao,tokens,mapper),new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)));
        personal=new AccountRunsService(dao,sessions,auditService,runDao,reader,tokens,clock,settings,sites(),new AccountRunReadDao(dao.transactions));
    }
    private long count(String table) throws Exception {
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT COUNT(*) FROM "+table)) {r.next();return r.getLong(1);}
    }
    @Test void claimedPublishedAnonymousReportIsCountedOnceAtOriginalMonthEvenAtZeroQuota() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=0");
        var a=user("usage-claim-a@example.com",true);var b=user("usage-claim-b@example.com",true);
        var anon=personal.create("https://example.com",null,null);
        assertTrue(new AuditRunDao(dao.transactions).claimRun(anon.audit().runId(),"worker",clock.instant()));
        publisher.completeAndPublish(anon.audit().runId(),new AuditDao(dao.transactions).findById(anon.audit().auditId()),mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),"{}","worker");
        sql("UPDATE ARG_AUDIT_REPORT SET created_at='2026-09-15 10:00:00' WHERE run_id="+anon.audit().runId());
        personal.claim(bearer(a),CSRF,anon.audit().runId(),anon.proof());personal.claim(bearer(a),CSRF,anon.audit().runId(),anon.proof());
        error(404,()->personal.claim(bearer(b),CSRF,anon.audit().runId(),anon.proof()));
        assertEquals(0,personal.usage(bearer(a)).used());assertEquals(0,personal.usage(bearer(a)).reserved());
        assertEquals(1,count("ARG_USAGE_RUN WHERE state='COUNTED' AND period='2026-09'"));
        assertNotNull(personal.report(bearer(a),anon.audit().runId()));
    }
    @Test void queuedClaimCannotBypassQuotaAndRollsBackOwnershipAndProofConsumption() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=0");var a=user("usage-queued@example.com",true);
        var anon=personal.create("https://example.com",null,null);
        var denied=assertThrows(jakarta.ws.rs.WebApplicationException.class,()->personal.claim(bearer(a),CSRF,anon.audit().runId(),anon.proof()));
        assertEquals(429,denied.getResponse().getStatus());assertNull(new AuditRunDao(dao.transactions).findById(anon.audit().runId()).getOwnerUserId());
        assertEquals(0,count("ARG_ACCOUNT_SITE"));assertEquals(0,count("ARG_USAGE_RUN"));
        usagePolicy("");personal.claim(bearer(a),CSRF,anon.audit().runId(),anon.proof());assertEquals(1,personal.usage(bearer(a)).reserved());
    }
    @Test void usageHttpRequiresVerifiedSessionAndQuotaDoesNotBlockReadsOrFollowing() throws Exception {
        usagePolicy("usage.offers.FREE.monthly-limit=0");var a=user("usage-http-a@example.com",true);var b=user("usage-http-b@example.com",true);var pending=user("usage-http-pending@example.com",false);
        try(var http=new HttpFixture()) {
            assertEquals(401,http.call("GET","/account/usage",null,null,false).statusCode());
            assertEquals(403,http.call("GET","/account/usage",bearer(pending),null,false).statusCode());
            var usage=http.call("GET","/account/usage",bearer(a),null,false);assertEquals(200,usage.statusCode());
            assertTrue(mapper.readTree(usage.body()).get("resetsAt").isTextual());assertEquals("2026-11-01T00:00:00Z",mapper.readTree(usage.body()).get("resetsAt").asText());
            assertEquals(0,mapper.readTree(usage.body()).get("limit").asInt());assertFalse(mapper.readTree(usage.body()).get("canLaunch").asBoolean());
            var denied=http.create(bearer(a));assertEquals(429,denied.statusCode());
            assertTrue(denied.body().contains("quota_exceeded"));assertTrue(denied.headers().firstValue("retry-after").isPresent());
            assertEquals(200,http.call("POST","/account/sites",bearer(a),"{\"url\":\"https://example.com\"}",true).statusCode());
            assertEquals(200,http.call("GET","/account/sites",bearer(a),null,false).statusCode());
            assertEquals(0,count("ARG_AUDIT_RUN WHERE owner_user_id IS NOT NULL"));
            var anonymous=http.call("POST","/audits",null,"{\"url\":\"https://example.com\"}",false);assertEquals(200,anonymous.statusCode());
            assertEquals(0,personal.usage(bearer(b)).used());
        }
        auth.archive(bearer(a),CSRF,true);error(401,()->personal.usage(bearer(a)));
    }
    @Test void usageReadDoesNotRenewIdleActivity() throws Exception {
        usagePolicy("");var a=user("usage-idle@example.com",true);clock.now=clock.now.plusSeconds(60);
        personal.usage(bearer(a));
        var stored=dao.transaction(c->dao.session(a.context().session().getId(),c,false));
        assertEquals(clock.instant().minusSeconds(60),stored.getLastActivityAt());
    }

    @Test void historyScopesEveryPageAndCursorToOwnerAndUrl() throws Exception {
        var a=user("history-a@example.com",true);var b=user("history-b@example.com",true);
        var first=personal.create("https://example.com",bearer(a),CSRF).audit();
        var foreign=personal.create("https://example.com",bearer(b),CSRF).audit();
        var second=personal.create("https://example.com",bearer(a),CSRF).audit();
        var other=personal.create("https://example.com/other",bearer(a),CSRF).audit();
        sql("UPDATE ARG_AUDIT_RUN SET created_at='2026-10-11 07:00:00' WHERE id IN ("+first.runId()+","+second.runId()+")");
        var history=new AccountHistoryService(dao,sessions,mapper,clock);
        var context=(AccountHistoryService.Context)personal.get(bearer(a),first.runId()).get("historyContext");
        long id=Long.parseLong(context.siteUrlId());
        var page=history.history(bearer(a),id,1,null);
        assertEquals(Long.toString(second.runId()),page.items().getFirst().runId());
        assertEquals(Long.toString(second.runId()),page.nextCursor());
        var older=history.history(bearer(a),id,1,page.nextCursor());
        assertEquals(Long.toString(first.runId()),older.items().getFirst().runId());assertNull(older.nextCursor());
        error(404,()->history.history(bearer(b),id,20,null));
        error(400,()->history.history(bearer(a),id,20,Long.toString(foreign.runId())));
        error(400,()->history.history(bearer(a),id,20,Long.toString(other.runId())));
        error(400,()->history.history(bearer(a),id,101,null));
        error(400,()->history.history(bearer(a),id,20,"9223372036854775808"));
        var empty=sites().add(bearer(a),CSRF,null,"https://example.com/empty");
        assertTrue(history.history(bearer(a),Long.parseLong(empty.siteUrlId()),20,null).items().isEmpty());
        try(var http=new HttpFixture()) {
            String path="/account/urls/"+id+"/history";
            assertEquals(401,http.call("GET",path,null,null,false).statusCode());
            assertEquals(404,http.call("GET",path,bearer(b),null,false).statusCode());
            var response=http.call("GET",path,bearer(a),null,false);
            assertEquals(200,response.statusCode());assertTrue(response.headers().firstValue("cache-control").orElse("").contains("no-store"));
            assertFalse(response.body().contains("token"));assertFalse(response.body().contains("report_json"));
        }
    }

    com.dokor.argos.services.feedback.FeedbackService feedback() {
        return new com.dokor.argos.services.feedback.FeedbackService(dao,new FeedbackDao(dao),sessions,reports,reader,tokens,clock);
    }
    private com.dokor.argos.services.feedback.FeedbackService.Submission feedbackBody(String type,String token,String run,String key) {
        return new com.dokor.argos.services.feedback.FeedbackService.Submission(type,"<script>controlled fixture</script>","REPORT",null,null,null,token,run,key,"");
    }
    private String feedbackReport(long owner) throws Exception {
        String token=tokens.generateToken();
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id="+owner+" WHERE id=1");
        try(var c=source.getConnection();var s=c.prepareStatement("UPDATE ARG_AUDIT_REPORT SET token_hash=?,report_json=? WHERE run_id=1")) {
            s.setBytes(1,tokens.sha256(token));s.setString(2,"{\"domain\":\"example.com\",\"scores\":{\"global\":75},\"issues\":[{\"id\":\"http.hsts\"}]}");s.executeUpdate();
        }
        return token;
    }
    @Test void feedbackRequiresReportAccessAndNeverChangesScoresOrStoresBearerTokens() throws Exception {
        var owner=user("feedback-owner@example.com",true);var stranger=user("feedback-stranger@example.com",true);var a=administrator();
        String token=feedbackReport(owner.context().user().getId());var service=feedback();
        var before=mapper.writeValueAsString(reader.getByRunId(1).orElseThrow());
        error(404,()->service.submit(bearer(stranger),CSRF,feedbackBody("FALSE_POSITIVE",null,"1","http.hsts")));
        error(404,()->service.submit(null,CSRF,feedbackBody("FALSE_POSITIVE",null,"1","http.hsts")));
        error(404,()->service.submit(null,CSRF,feedbackBody("FALSE_POSITIVE",token,null,"forged")));
        var submitted=service.submit(bearer(owner),CSRF,feedbackBody("FALSE_POSITIVE",null,"1","http.hsts"));
        long id=Long.parseLong(submitted.get("receipt").toString());
        assertEquals("1",service.detail(bearer(a),id).get("runId"));
        var shared=service.submit(null,CSRF,feedbackBody("FALSE_POSITIVE",token,null,"http.hsts"));
        assertTrue((boolean)shared.get("accepted"));
        assertFalse(mapper.writeValueAsString(service.detail(bearer(a),id)).contains(token));
        service.treat(bearer(a),CSRF,id,new com.dokor.argos.services.feedback.FeedbackService.Treatment("CONFIRMED","OPEN"));
        assertEquals(before,mapper.writeValueAsString(reader.getByRunId(1).orElseThrow()));
        sql("UPDATE ARG_ACCOUNT_USER SET state='PENDING' WHERE id="+owner.context().user().getId());
        error(404,()->service.submit(bearer(owner),CSRF,feedbackBody("FALSE_POSITIVE",null,"1","http.hsts")));
        sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-10' WHERE run_id=1");
        error(404,()->service.submit(null,CSRF,feedbackBody("FALSE_POSITIVE",token,null,"http.hsts")));
    }
    @Test void feedbackHttpChecksCsrfAdminRolesAndPersistentSpamBudget() throws Exception {
        var a=administrator();var u=user("feedback-regular@example.com",true);String body="{\"type\":\"BUG\",\"description\":\"Click fixture button\"}";
        try(var http=new HttpFixture()) {
            assertEquals(403,http.call("POST","/feedback",null,body,false).statusCode());
            var accepted=http.call("POST","/feedback",null,body,true);assertEquals(200,accepted.statusCode(),accepted.body());
            String id=mapper.readTree(accepted.body()).path("receipt").asText(),path="/account/admin/feedback/"+id;
            for(String route:List.of("/account/admin/feedback",path)) {
                assertEquals(401,http.call("GET",route,null,null,false).statusCode());
                assertEquals(403,http.call("GET",route,bearer(u),null,false).statusCode());
                var detail=http.call("GET",route,bearer(a),null,false);assertEquals(200,detail.statusCode(),detail.body());
                assertTrue(detail.headers().firstValue("cache-control").orElse("").contains("no-store"));
            }
            String treatment="{\"status\":\"PENDING\",\"expectedStatus\":\"OPEN\"}";
            assertEquals(403,http.call("PATCH",path,bearer(a),treatment,false).statusCode());
            assertEquals(403,http.call("PATCH",path,bearer(u),treatment,true).statusCode());
            assertEquals(200,http.call("PATCH",path,bearer(a),treatment,true).statusCode());
            assertEquals(409,http.call("PATCH",path,bearer(a),treatment,true).statusCode());
            for(int i=1;i<5;i++)assertEquals(200,http.call("POST","/feedback",null,body,true).statusCode());
            var limited=http.call("POST","/feedback",null,body,true);assertEquals(429,limited.statusCode());assertTrue(limited.headers().firstValue("retry-after").isPresent());
            sql("UPDATE ARG_ACCOUNT_USER SET role='USER' WHERE id="+a.context().user().getId());
            assertEquals(403,http.call("GET",path,bearer(a),null,false).statusCode());
        }
    }
    @Test void feedbackFiltersPaginationAndRetentionDeleteEventsTogether() throws Exception {
        var a=administrator();var service=feedback();
        long first=Long.parseLong(service.submit(null,CSRF,feedbackBody("BUG",null,null,null)).get("receipt").toString());
        long second=Long.parseLong(service.submit(null,CSRF,feedbackBody("SUGGESTION",null,null,null)).get("receipt").toString());
        var page=service.list(bearer(a),null,null,1,null);assertEquals(Long.toString(second),page.items().getFirst().get("id"));
        assertEquals(Long.toString(first),service.list(bearer(a),null,null,1,page.nextCursor()).items().getFirst().get("id"));
        service.treat(bearer(a),CSRF,first,new com.dokor.argos.services.feedback.FeedbackService.Treatment("PENDING","OPEN"));
        assertEquals(1,service.list(bearer(a),"BUG","PENDING",20,null).items().size());
        assertEquals(1,((List<?>)service.detail(bearer(a),first).get("events")).size());
        sql("UPDATE ARG_FEEDBACK SET created_at='2026-01-01' WHERE id="+first);
        error(404,()->service.detail(bearer(a),first));service.purge();assertEquals(0,count("ARG_FEEDBACK_EVENT"));assertEquals(1,count("ARG_FEEDBACK"));
    }
    @Test void feedbackTreatmentRollsBackWhenTraceCannotBeWritten() throws Exception {
        var a=administrator();var service=feedback();long id=Long.parseLong(service.submit(null,CSRF,feedbackBody("BUG",null,null,null)).get("receipt").toString());
        sql("DROP TABLE ARG_FEEDBACK_EVENT");
        assertThrows(RuntimeException.class,()->service.treat(bearer(a),CSRF,id,new com.dokor.argos.services.feedback.FeedbackService.Treatment("RESOLVED","OPEN")));
        var stored=dao.transaction(c->new FeedbackDao(dao).get(id,clock.instant().minusSeconds(60),c,false));assertEquals("OPEN",stored.getStatus());
    }

    private String historyReport(long run, int score, String fingerprint) throws Exception {
        String token=tokens.generateToken();
        var coverage=new com.dokor.argos.services.analysis.scoring.MeasurementCoverage("v1",.8,
            new com.dokor.argos.services.analysis.scoring.MeasurementCoverage.Aggregate("global",10,10,1,true,true),List.of(),
            List.of(new com.dokor.argos.services.analysis.scoring.MeasurementCoverage.Check("ssl.grade","security","ssl",10,com.dokor.argos.services.analysis.scoring.MeasurementCoverage.State.MEASURED,"fixture","MEASURED")),false);
        var calc=new ReportDto.ScoreCalculation(11,fingerprint,List.of(new ReportDto.DomainCalculation("security",score/10.0,10,score/100.0,1)),Map.of("security",1.0),List.of(new ReportDto.CheckCalculation("ssl.grade","ssl","security",10,score/10.0)));
        var report=new ReportDto("2026-10-11","example.com","https://example.com",null,new ReportDto.Scores(score,100,List.of(),true,calc,coverage),null,List.of(),null,null);
        try(var c=source.getConnection();var s=c.prepareStatement("INSERT INTO ARG_AUDIT_REPORT(audit_id,run_id,token_hash,domain,target_url,report_json,created_at) SELECT audit_id,id,?,'example.com','https://example.com',?,'2026-10-11 07:00:00' FROM ARG_AUDIT_RUN WHERE id=?")) {
            s.setBytes(1,tokens.sha256(token));s.setString(2,mapper.writeValueAsString(report));s.setLong(3,run);s.executeUpdate();
        }
        sql("UPDATE ARG_AUDIT_RUN SET status='COMPLETED',created_at='2026-10-11 07:00:00' WHERE id="+run);
        return token;
    }

    @Test void reportSharingUsesRealMariaDbAndEnforcesAccessRotationExpiryAndRevocation() throws Exception {
        var owner=user("share-owner@example.com",true);var recipient=user("share-recipient@example.com",true);var pending=user("share-pending@example.com",false);
        var run=personal.create("https://example.com",bearer(owner),CSRF).audit();historyReport(run.runId(),92,"share-policy");
        String path="/account/runs/"+run.runId()+"/share";
        try(var http=new HttpFixture()) {
            assertEquals(401,http.call("POST",path,null,"{\"days\":7}",true).statusCode());
            assertEquals(403,http.call("POST",path,bearer(owner),"{\"days\":7}",false).statusCode());
            assertEquals(404,http.call("POST",path,bearer(recipient),"{\"days\":7}",true).statusCode());
            var created=http.call("POST",path,bearer(owner),"{\"days\":7}",true);assertEquals(200,created.statusCode(),created.body());
            String first=mapper.readTree(created.body()).get("token").asText();
            var summary=http.call("GET","/reports/shared/"+first,null,null,false);assertEquals(200,summary.statusCode(),summary.body());
            assertEquals("summary",mapper.readTree(summary.body()).get("access").asText());
            assertTrue(summary.headers().firstValue("cache-control").orElse("").contains("no-store"));
            assertEquals(401,http.call("GET","/account/shared-reports/"+first,null,null,false).statusCode());
            assertEquals(403,http.call("GET","/account/shared-reports/"+first,bearer(pending),null,false).statusCode());
            assertEquals(200,http.call("GET","/account/shared-reports/"+first,bearer(recipient),null,false).statusCode());
            assertEquals(404,http.call("GET","/account/runs/"+run.runId(),bearer(recipient),null,false).statusCode());
            try(var c=source.getConnection();var s=c.prepareStatement("SELECT share_token_hash,share_expires_at FROM ARG_AUDIT_REPORT WHERE run_id=?")) {
                s.setLong(1,run.runId());try(var rows=s.executeQuery()){assertTrue(rows.next());assertArrayEquals(tokens.sha256(first),rows.getBytes(1));assertNotNull(rows.getTimestamp(2));}
            }
            var rotated=http.call("POST",path,bearer(owner),"{\"days\":0}",true);assertEquals(200,rotated.statusCode(),rotated.body());
            String second=mapper.readTree(rotated.body()).get("token").asText();
            assertEquals(404,http.call("GET","/reports/shared/"+first,null,null,false).statusCode());
            assertEquals(200,http.call("GET","/reports/shared/"+second,null,null,false).statusCode());
            sql("UPDATE ARG_AUDIT_REPORT SET share_expires_at='2000-01-01' WHERE run_id="+run.runId());
            assertEquals(404,http.call("GET","/reports/shared/"+second,null,null,false).statusCode());
            var renewed=http.call("POST",path,bearer(owner),"{\"days\":30}",true);assertEquals(200,renewed.statusCode(),renewed.body());
            String third=mapper.readTree(renewed.body()).get("token").asText();
            assertEquals(403,http.call("DELETE",path,bearer(owner),null,false).statusCode());
            assertEquals(404,http.call("DELETE",path,bearer(recipient),null,true).statusCode());
            assertEquals(200,http.call("DELETE",path,bearer(owner),null,true).statusCode());
            assertEquals(404,http.call("GET","/account/shared-reports/"+third,bearer(recipient),null,false).statusCode());
        }
    }

    @Test void reportIntroductionRequiresOwnerCsrfExistingFindingsAndIsSeparatelyRevocable() throws Exception {
        var a=user("intro-a@example.com",true);var b=user("intro-b@example.com",true);
        var run=personal.create("https://example.com",bearer(a),CSRF).audit();String token=historyReport(run.runId(),92,"intro-policy");
        String json="{\"domain\":\"example.com\",\"scores\":{\"global\":92},\"issues\":[{\"id\":\"html.title\"},{\"id\":\"html.h1.count\"}]}";
        try(var c=source.getConnection();var s=c.prepareStatement("UPDATE ARG_AUDIT_REPORT SET report_json=? WHERE run_id=?")) {s.setString(1,json);s.setLong(2,run.runId());s.executeUpdate();}
        String path="/account/report-introduction/"+token,body="{\"author\":\"Provider fixture\",\"context\":\"Context fixture\",\"findingKeys\":[\"html.title\",\"html.h1.count\"],\"nextStep\":\"Review together\"}";
        try(var http=new HttpFixture()) {
            assertEquals(401,http.call("PUT",path,null,body,true).statusCode());
            assertEquals(404,http.call("GET",path,bearer(b),null,false).statusCode());
            assertEquals(404,http.call("PUT",path,bearer(b),body,true).statusCode());
            assertEquals(403,http.call("PUT",path,bearer(a),body,false).statusCode());
            assertEquals(200,http.call("PUT",path,bearer(a),body,true).statusCode());
            assertEquals("Provider fixture",reader.getByToken(token).orElseThrow().introduction().author());
            try(var c=source.getConnection();var s=c.prepareStatement("SELECT report_json FROM ARG_AUDIT_REPORT WHERE run_id=?")){s.setLong(1,run.runId());try(var r=s.executeQuery()){assertTrue(r.next());assertEquals(json,r.getString(1));}}
            assertEquals(400,http.call("PUT",path,bearer(a),body.replace("html.h1.count","other-report.key"),true).statusCode());
            assertEquals(404,http.call("DELETE",path,bearer(b),null,true).statusCode());
            assertEquals(200,http.call("DELETE",path,bearer(a),null,true).statusCode());
            assertNull(reader.getByToken(token).orElseThrow().introduction());
            assertEquals(200,http.call("PUT",path,bearer(a),body,true).statusCode());
            sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-10' WHERE run_id="+run.runId());
            assertEquals(404,http.call("GET",path,bearer(a),null,false).statusCode());
            assertEquals(404,http.call("PUT",path,bearer(a),body,true).statusCode());
            assertTrue(reader.getByToken(token).isEmpty());
        }
    }

    @Test void historyUsesFrozenEvidenceAndSharedTokensNeverGrantHistory() throws Exception {
        var a=user("frozen-a@example.com",true);var b=user("frozen-b@example.com",true);
        var first=personal.create("https://example.com",bearer(a),CSRF).audit();historyReport(first.runId(),50,"method-a");
        var second=personal.create("https://example.com",bearer(a),CSRF).audit();String token=historyReport(second.runId(),80,"method-a");
        var history=new AccountHistoryService(dao,sessions,mapper,clock);
        var context=history.reportContext(bearer(a),token);long id=Long.parseLong(context.siteUrlId());
        var item=history.history(bearer(a),id,1,null).items().getFirst();
        assertEquals(80,item.globalScore());assertEquals(11,item.scoringVersion());assertEquals(1.0,item.coverage());
        assertEquals(30.0,item.comparison().globalDelta());assertTrue(item.reportAvailable());
        assertEquals(50,history.history(bearer(a),id,1,Long.toString(second.runId())).items().getFirst().globalScore());
        error(404,()->history.reportContext(bearer(b),token));
        var third=personal.create("https://example.com",bearer(a),CSRF).audit();historyReport(third.runId(),90,"method-b");
        item=history.history(bearer(a),id,1,null).items().getFirst();
        assertEquals(AuditComparisonService.Reason.METHODOLOGY_CHANGED,item.comparison().reason());assertNull(item.comparison().globalDelta());
        sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-10' WHERE run_id="+third.runId());
        item=history.history(bearer(a),id,1,null).items().getFirst();assertFalse(item.reportAvailable());assertNull(item.globalScore());assertNull(item.comparison().globalDelta());
        sql("UPDATE ARG_AUDIT_REPORT SET expires_at='2026-10-10' WHERE run_id="+second.runId());
        error(404,()->history.reportContext(bearer(a),token));
    }
    @Test void usageHistoryIsOwnerScopedPaginatedAndRetainsPriorMonthReservations() throws Exception {
        var a=user("ledger-a@example.com",true);var b=user("ledger-b@example.com",true);
        var one=personal.create("https://example.com",bearer(a),CSRF).audit();
        var two=personal.create("https://example.com/next",bearer(a),CSRF).audit();
        personal.create("https://example.com/private-other",bearer(b),CSRF);
        sql("UPDATE ARG_USAGE_RUN SET period='2026-09',created_at='2026-09-30 23:59:59' WHERE id="+one.runId());

        long owner=a.context().user().getId();long site=Long.parseLong(sites().list(bearer(a),20,null).items().getFirst().siteId());
        sql("INSERT INTO ARG_DOMAIN_DISCOVERY(id,owner_user_id,site_id,idempotency_key,request_fingerprint,status,parameters_json,effective_limits_json,created_at,finished_at,expires_at) VALUES(66001,"+owner+","+site+",'ledger-discovery',UNHEX(REPEAT('00',32)),'COMPLETED','{}','{}','2026-09-30 23:58:00','2026-09-30 23:59:00','2026-10-01 00:59:00')");
        sql("INSERT INTO ARG_DOMAIN_DISCOVERY_PAGE(id,discovery_id,owner_user_id,site_id,normalized_url,source,depth,eligible) VALUES(66002,66001,"+owner+","+site+",'https://example.com/','INITIAL',0,TRUE)");
        sql("INSERT INTO ARG_DOMAIN_BATCH(id,owner_user_id,site_id,discovery_id,idempotency_key,request_fingerprint,profile_id,profile_snapshot_json,selected_count,status,created_at) VALUES(66003,"+owner+","+site+",66001,'ledger-batch',UNHEX(REPEAT('00',32)),'server-default-v1','{}',1,'RUNNING','2026-09-30 23:59:00')");
        sql("INSERT INTO ARG_DOMAIN_BATCH_PAGE(id,batch_id,owner_user_id,site_id,discovery_id,discovery_page_id,audit_id,run_id,created_at) VALUES(66004,66003,"+owner+","+site+",66001,66002,"+one.auditId()+","+one.runId()+",'2026-09-30 23:59:00')");
        var history=new UsageHistoryService(sessions,new UsagePolicy(ConfigFactory.empty()),clock);
        var first=history.events(bearer(a),"2026-10",1,0);var second=history.events(bearer(a),"2026-10",1,1);
        assertEquals(2,first.total());assertEquals(1,first.items().size());assertEquals(1,second.items().size());assertNotEquals(first.items().getFirst().runId(),second.items().getFirst().runId());
        assertEquals(Long.toString(one.runId()),second.items().getFirst().runId());assertEquals("2026-09",second.items().getFirst().period());assertEquals("2026-10",first.period());
        assertEquals(1,history.events(bearer(b),"2026-10",20,0).total());assertEquals(0,history.events(bearer(a),"2026-08",20,0).total());
        assertNull(first.items().getFirst().batchId());assertEquals("66003",second.items().getFirst().batchId());assertTrue(first.items().getFirst().url().startsWith("https://example.com"));
        error(400,()->history.events(bearer(a),"2026-13",20,0));error(400,()->history.events(bearer(a),"2026-10",101,0));
        assertEquals(0,history.events(bearer(a),"2026-10",20,100).items().size());
        auth.archive(bearer(a),CSRF,true);error(401,()->history.events(bearer(a),null,20,0));
    }
    @Test void usageHistoryHttpEnforcesVerificationAndNeverRenewsSessionActivity() throws Exception {
        var a=user("ledger-http@example.com",true);var pending=user("ledger-pending@example.com",false);personal.create("https://example.com",bearer(a),CSRF);
        var original=dao.transaction(c->dao.session(a.context().session().getId(),c,false)).getLastActivityAt();clock.now=clock.now.plusSeconds(30);
        try(var http=new HttpFixture()){
            assertEquals(401,http.call("GET","/account/usage/events",null,null,false).statusCode());
            assertEquals(403,http.call("GET","/account/usage/events",bearer(pending),null,false).statusCode());
            var response=http.call("GET","/account/usage/events?period=2026-10&limit=1&offset=0",bearer(a),null,false);
            assertEquals(200,response.statusCode(),response.body());assertTrue(response.headers().firstValue("cache-control").orElse("").contains("no-store"));
            assertEquals(1,mapper.readTree(response.body()).get("total").asInt());
        }
        assertEquals(original,dao.transaction(c->dao.session(a.context().session().getId(),c,false)).getLastActivityAt());
    }

    private com.dokor.argos.services.connected.discovery.DiscoveryService discoveries(){
        var policy=new com.dokor.argos.services.connected.discovery.DiscoveryPolicy(ConfigFactory.empty());
        return new com.dokor.argos.services.connected.discovery.DiscoveryService(dao,sessions,new DiscoveryDao(dao.transactions),new DomainService(new DomainDao(dao.transactions)),policy,
            mock(com.dokor.argos.services.connected.discovery.DiscoveryTransport.class),mapper,tokens,clock);
    }
    @Test void discoveryHttpIsPrivateVerifiedAndCancelRequiresCsrf() throws Exception {
        var a=user("discovery-http@example.com",true);var b=user("discovery-other@example.com",true);var pending=user("discovery-pending@example.com",false);
        var item=discoveries().create(bearer(a),CSRF,UUID.randomUUID().toString(),new com.dokor.argos.services.connected.contract.ConnectedContracts.CreateDiscovery("example.com",50L,3L,List.of()));
        String path="/account/domain-discoveries/"+item.id();
        try(var http=new HttpFixture()) {
            for(String route:List.of(path,path+"/pages","/account/domain-discoveries")){
                assertEquals(401,http.call("GET",route,null,null,false).statusCode());assertEquals(403,http.call("GET",route,bearer(pending),null,false).statusCode());
                var response=http.call("GET",route,bearer(a),null,false);assertEquals(200,response.statusCode(),response.body());assertTrue(response.headers().firstValue("cache-control").orElse("").contains("no-store"));
            }
            assertEquals(404,http.call("GET",path,bearer(b),null,false).statusCode());
            assertEquals(400,http.call("POST",path+"/cancel",bearer(a),"{\"ownerId\":1}",true).statusCode());
            assertEquals(403,http.call("POST",path+"/cancel",bearer(a),"{}",false).statusCode());
            assertEquals(404,http.call("POST",path+"/cancel",bearer(b),"{}",true).statusCode());
            assertEquals(200,http.call("POST",path+"/cancel",bearer(a),"{}",true).statusCode());
        }
    }

}
