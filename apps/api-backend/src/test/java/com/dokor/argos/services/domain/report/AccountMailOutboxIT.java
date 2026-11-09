package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.*;
import javax.sql.DataSource;
import java.lang.reflect.*;
import java.sql.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountMailOutboxIT extends MariaDbReportFixture {
    private final AccountLifecycleIT.MutableClock clock = new AccountLifecycleIT.MutableClock();
    private AccountDao accounts;
    private AccountMailOutboxDao queue;
    private AccountSettings settings;
    private AccountMailPayload payload;
    private AccountAuthService auth;
    private AccountMail mail;
    private AccountMailOutboxService worker;

    @BeforeEach void services() {
        settings = new AccountSettings(ConfigFactory.parseMap(Map.of(
                "account.enabled", true, "account.jwt-secret", "s".repeat(64))));
        accounts = dao(source);
        queue = new AccountMailOutboxDao(accounts);
        payload = new AccountMailPayload(settings, mapper);
        mail = mock(AccountMail.class);
        worker = worker(queue, mail);
        auth = auth(accounts, worker);
    }

    private AccountDao dao(DataSource source) {
        return new AccountDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
    }

    private AccountMailOutboxService worker(AccountMailOutboxDao queue, AccountMail transport) {
        return new AccountMailOutboxService(queue, payload, transport, settings, clock);
    }

    private AccountAuthService auth(AccountDao dao, AccountMailOutboxService outbox) {
        var sessions = new AccountSessionService(dao,
                new AccountSessionSigner(settings, mapper, clock), tokens, settings, clock);
        return new AccountAuthService(dao, new AccountPasswords(settings), sessions, tokens, settings, outbox, clock);
    }

    private void register() {
        auth.register("outbox@example.com", AccountLifecycleIT.PASSWORD, "Fixture");
    }

    private long pending() {
        return accounts.transaction(c -> accounts.transactions.selectQuery(c)
                .select(QAccountMailOutbox.table.id.count()).from(QAccountMailOutbox.table).fetchOne());
    }

    @Test void commitsBeforeSmtpAndAcknowledgedMailIsNeverReplayed() {
        register();
        verifyNoInteractions(mail);
        assertEquals(1, pending());
        doAnswer(call -> {
            // The account transaction must have committed and released its user lock.
            try (var c = source.getConnection(); var s = c.createStatement()) {
                s.execute("SET innodb_lock_wait_timeout=1");
                c.setAutoCommit(false);
                try (var rows = s.executeQuery("SELECT id FROM ARG_ACCOUNT_USER WHERE email='outbox@example.com' FOR UPDATE")) {
                    assertTrue(rows.next());
                }
                c.rollback();
            }
            return null;
        }).when(mail).send(anyString(), any(), anyString());
        worker.tick();
        worker(queue, mail).tick();
        verify(mail, times(1)).send(anyString(), any(), anyString());
        assertEquals(0, pending());
    }

    @Test void rollbackLeavesNeitherTokenNorQueuedMessage() {
        assertThrows(IllegalStateException.class, () -> accounts.transaction(c -> {
            worker.enqueue("outbox@example.com", notice(), null, clock.instant().plusSeconds(60), c);
            throw new IllegalStateException("synthetic rollback");
        }));
        worker.tick();
        assertEquals(0, pending());
        verifyNoInteractions(mail);
    }

    @Test void failedCommitNeverDeliversUncommittedRegistration() {
        DataSource failingSource = (DataSource) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{DataSource.class}, (proxy, method, args) -> {
                    try {
                        Object result = method.invoke(source, args);
                        if (!(result instanceof Connection connection)) return result;
                        return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{Connection.class},
                                (p, m, a) -> {
                                    if (m.getName().equals("commit")) throw new SQLException("synthetic commit failure");
                                    try { return m.invoke(connection, a); }
                                    catch (InvocationTargetException e) { throw e.getCause(); }
                                });
                    } catch (InvocationTargetException e) { throw e.getCause(); }
                });
        var failing = dao(failingSource);
        assertThrows(RuntimeException.class, () -> auth(failing,
                worker(new AccountMailOutboxDao(failing), mail)).register(
                        "outbox@example.com", AccountLifecycleIT.PASSWORD, "Fixture"));
        worker.tick();
        assertNull(accounts.transaction(c -> accounts.email("outbox@example.com", c)));
        assertEquals(0, pending());
        verifyNoInteractions(mail);
    }

    @Test void smtpFailureRetriesAfterBackoffAcrossWorkerRestart() {
        register();
        doThrow(new AccountError(503, "mail_unavailable")).doNothing()
                .when(mail).send(anyString(), any(), anyString());
        worker.tick();
        assertNotNull(accounts.transaction(c -> accounts.email("outbox@example.com", c)));
        assertEquals(1, pending());
        worker.tick();
        verify(mail, times(1)).send(anyString(), any(), anyString());
        clock.now = clock.now.plusSeconds(30);
        worker(queue, mail).tick();
        var ids = org.mockito.ArgumentCaptor.forClass(String.class);
        var messages = org.mockito.ArgumentCaptor.forClass(AccountEmail.Message.class);
        verify(mail, times(2)).send(anyString(), messages.capture(), ids.capture());
        assertEquals(ids.getAllValues().getFirst(), ids.getAllValues().getLast());
        assertEquals(messages.getAllValues().getFirst(), messages.getAllValues().getLast());
        assertEquals(0, pending());
    }

    @Test void expiredAndSupersededChallengesAreDiscarded() {
        register();
        auth.send("outbox@example.com", "VERIFY");
        worker.tick();
        verify(mail, times(1)).send(anyString(), any(), anyString());
        auth.send("outbox@example.com", "VERIFY");
        clock.now = clock.now.plus(Duration.ofDays(1));
        worker.tick();
        verifyNoMoreInteractions(mail);
        assertEquals(0, pending());
    }

    @Test void crashedClaimRecoversAndOldOwnerCannotAcknowledgeNewClaim() {
        register();
        var old = queue.claim(clock.instant());
        assertNull(queue.claim(clock.instant()));
        clock.now = clock.now.plus(Duration.ofMinutes(5));
        var recovered = queue.claim(clock.instant());
        assertEquals(old.getId(), recovered.getId());
        assertNotEquals(old.getClaimToken(), recovered.getClaimToken());
        queue.complete(old);
        queue.retry(old, clock.instant());
        assertEquals(1, pending());
        assertNull(queue.claim(clock.instant()));
        clock.now = clock.now.plus(Duration.ofMinutes(5));
        worker(queue, mail).tick();
        verify(mail).send(anyString(), any(), anyString());
        assertEquals(0, pending());
    }

    @Test void concurrentWorkersDoNotDeliverAnActiveClaimTwice() throws Exception {
        register();
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(call -> {
            entered.countDown();
            assertTrue(release.await(10, TimeUnit.SECONDS));
            return null;
        }).when(mail).send(anyString(), any(), anyString());
        try (var executor = Executors.newSingleThreadExecutor()) {
            var sending = executor.submit(worker::tick);
            try {
                assertTrue(entered.await(10, TimeUnit.SECONDS));
                worker(queue, mail).tick();
                verify(mail, times(1)).send(anyString(), any(), anyString());
            } finally { release.countDown(); }
            sending.get(10, TimeUnit.SECONDS);
        }
        assertEquals(0, pending());
    }

    @Test void acknowledgementFailureRedeliversWithSameMessageIdAfterLeaseExpires() {
        register();
        var unreliable = spy(queue);
        doThrow(new IllegalStateException("synthetic acknowledgement failure")).when(unreliable).complete(any());
        worker(unreliable, mail).tick();
        assertEquals(1, pending());
        clock.now = clock.now.plus(Duration.ofMinutes(5));
        worker(queue, mail).tick();
        var ids = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail, times(2)).send(anyString(), any(), ids.capture());
        assertEquals(ids.getAllValues().getFirst(), ids.getAllValues().getLast());
        assertEquals(0, pending());
    }

    private AccountEmail.Message notice() {
        return AccountEmail.render(AccountEmail.Kind.PASSWORD_CHANGED, "fr", settings.origin(), null, null);
    }
}
