package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

import java.sql.Timestamp;
import java.time.*;
import java.util.Map;

/** Persistent counters; rate limiting has its own commit even when the operation fails. */
@Singleton
public class AccountRateLimiter {
    private final AccountDao dao;
    private final TokenService tokens;
    private final Clock clock;
    private final AccountSettings settings;

    @Inject
    public AccountRateLimiter(
            AccountDao dao, TokenService tokens, Clock clock, AccountSettings settings) {
        this.dao = dao;
        this.tokens = tokens;
        this.clock = clock;
        this.settings = settings;
    }

    public void check(String action, String account, String remote) {
        int accountLimit =
                settings.integer("rate." + action + ".account", action.equals("login") ? 20 : 5);
        int ipLimit =
                settings.integer(
                        "rate." + action + ".ip",
                        action.equals("login")
                                ? 100
                                : action.equals("oauth") || action.equals("claim") ? 30 : 30);
        boolean allowed = increment(action + ":ip:" + remote, ipLimit);
        if (account != null)
            allowed = increment(action + ":account:" + account, accountLimit) && allowed;
        if (!allowed)
            throw new WebApplicationException(
                    Response.status(429)
                            .header("Retry-After", "900")
                            .header("Cache-Control", "no-store")
                            .entity(Map.of("error", "rate_limited"))
                            .build());
    }

    private boolean increment(String key, int maximum) {
        Instant now = clock.instant();
        long window = now.getEpochSecond() / 900;
        byte[] hash = tokens.sha256(window + ":" + key);
        return dao.transaction(
                c -> {
                    try {
                        try (var cleanup =
                                c.prepareStatement(
                                        "DELETE FROM ARG_ACCOUNT_RATE WHERE expires_at < ? LIMIT"
                                            + " 1000")) {
                            cleanup.setTimestamp(1, Timestamp.from(now));
                            cleanup.executeUpdate();
                        }
                        // MariaDB-specific upsert; all values bound, no raw IP/account stored.
                        try (var insert =
                                c.prepareStatement(
                                        "INSERT INTO"
                                            + " ARG_ACCOUNT_RATE(bucket_hash,attempts,expires_at)"
                                            + " VALUES(?,1,?) ON DUPLICATE KEY UPDATE"
                                            + " attempts=LEAST(attempts+1,1000000)")) {
                            insert.setBytes(1, hash);
                            insert.setTimestamp(
                                    2, Timestamp.from(Instant.ofEpochSecond((window + 1) * 900)));
                            insert.executeUpdate();
                        }
                        try (var read =
                                c.prepareStatement(
                                        "SELECT attempts FROM ARG_ACCOUNT_RATE WHERE"
                                            + " bucket_hash=?")) {
                            read.setBytes(1, hash);
                            try (var result = read.executeQuery()) {
                                return result.next() && result.getInt(1) <= maximum;
                            }
                        }
                    } catch (java.sql.SQLException failure) {
                        throw new AccountError(503, "account_unavailable");
                    }
                });
    }
}
