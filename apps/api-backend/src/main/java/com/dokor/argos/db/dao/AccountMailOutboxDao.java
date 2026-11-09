package com.dokor.argos.db.dao;

import com.dokor.argos.db.generated.*;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Singleton
public class AccountMailOutboxDao {
    private static final QAccountMailOutbox q = QAccountMailOutbox.table;
    private final AccountDao dao;

    @Inject
    public AccountMailOutboxDao(AccountDao dao) { this.dao = dao; }

    public void enqueue(byte[] payload, Long tokenId, Instant now, Instant expires, Connection c) {
        var row = new AccountMailOutbox();
        row.setPayload(payload);
        row.setTokenId(tokenId);
        row.setAttempts(0);
        row.setNextAttemptAt(now);
        row.setExpiresAt(expires);
        dao.save(row, q, c);
    }

    /** Claim commits and releases the connection before the worker contacts SMTP. */
    public AccountMailOutbox claim(Instant now) {
        return dao.transaction(c -> {
            dao.transactions.delete(q, c).where(q.expiresAt.loe(now)).execute();
            var row = dao.transactions.selectQuery(c).select(q).from(q)
                    .where(q.nextAttemptAt.loe(now), q.expiresAt.gt(now))
                    .orderBy(q.nextAttemptAt.asc(), q.id.asc()).limit(1).forUpdate().fetchOne();
            if (row == null) return null;
            row.setClaimToken(UUID.randomUUID().toString());
            row.setAttempts(row.getAttempts() + 1);
            // A crashed worker becomes eligible again without holding a SQL lock.
            row.setNextAttemptAt(now.plus(Duration.ofMinutes(5)));
            dao.save(row, q, c);
            return row;
        });
    }

    public boolean tokenUsable(AccountMailOutbox row, Instant now) {
        if (row.getTokenId() == null) return true;
        return dao.transaction(c -> {
            var t = QAccountToken.table;
            return dao.transactions.selectQuery(c).select(t.id).from(t)
                    .where(t.id.eq(row.getTokenId()), t.consumedAt.isNull(), t.expiresAt.gt(now))
                    .fetchOne() != null;
        });
    }

    public void complete(AccountMailOutbox row) {
        dao.transaction(c -> dao.transactions.delete(q, c)
                .where(q.id.eq(row.getId()), q.claimToken.eq(row.getClaimToken())).execute());
    }

    public void retry(AccountMailOutbox row, Instant now) {
        long seconds = Math.min(1800, 30L << Math.min(6, row.getAttempts() - 1));
        dao.transaction(c -> dao.transactions.update(q, c)
                .setNull(q.claimToken).set(q.nextAttemptAt, now.plusSeconds(seconds))
                .where(q.id.eq(row.getId()), q.claimToken.eq(row.getClaimToken())).execute());
    }
}
