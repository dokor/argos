package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AccountMailOutboxDao;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.sql.Connection;
import java.time.Clock;
import java.time.Instant;

@Singleton
public class AccountMailOutboxService {
    private static final Logger logger = LoggerFactory.getLogger(AccountMailOutboxService.class);
    private final AccountMailOutboxDao dao;
    private final AccountMailPayload payload;
    private final AccountMail mail;
    private final AccountSettings settings;
    private final Clock clock;

    @Inject
    public AccountMailOutboxService(AccountMailOutboxDao dao, AccountMailPayload payload,
            AccountMail mail, AccountSettings settings, Clock clock) {
        this.dao = dao;
        this.payload = payload;
        this.mail = mail;
        this.settings = settings;
        this.clock = clock;
    }

    public void enqueue(String recipient, AccountEmail.Message message, Long tokenId,
            Instant expires, Connection c) {
        dao.enqueue(payload.encrypt(recipient, message), tokenId, clock.instant(), expires, c);
    }

    /** Called only by the scheduler, outside any account transaction. */
    public void tick() {
        if (!settings.enabled()) return;
        try {
            for (int i = 0; i < 20 && processNext(); i++) { /* bounded batch */ }
        } catch (RuntimeException failure) {
            // Do not log exception details: mail payloads and JDBC parameters contain secrets.
            logger.warn("Account mail outbox processing interrupted; pending deliveries will resume");
        }
    }

    public boolean processNext() {
        var row = dao.claim(clock.instant());
        if (row == null) return false;
        if (!dao.tokenUsable(row, clock.instant()) || !row.getExpiresAt().isAfter(clock.instant())) {
            dao.complete(row);
            return true;
        }
        try {
            var delivery = payload.decrypt(row.getPayload());
            mail.send(delivery.recipient(), delivery.message(), "argos-account-" + row.getId());
        } catch (RuntimeException failure) {
            dao.retry(row, clock.instant());
            logger.warn("Account mail delivery deferred id={} attempt={}", row.getId(), row.getAttempts());
            return true;
        }
        // If acknowledgement fails after SMTP accepted the mail, retain the claim for recovery.
        dao.complete(row);
        return true;
    }
}
