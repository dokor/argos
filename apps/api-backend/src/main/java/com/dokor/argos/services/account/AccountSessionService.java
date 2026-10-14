package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;

import java.security.MessageDigest;
import java.sql.Connection;
import java.time.*;
import java.util.Set;
import java.util.function.BiFunction;

@Singleton
public class AccountSessionService {
    public record Context(AccountUser user, AccountSession session) {}

    public record Issued(String jwt, Context context) {}

    private final AccountDao dao;
    private final AccountSessionSigner signer;
    private final TokenService tokens;
    private final AccountSettings settings;
    private final Clock clock;

    @Inject
    public AccountSessionService(
            AccountDao dao,
            AccountSessionSigner signer,
            TokenService tokens,
            AccountSettings settings,
            Clock clock) {
        this.dao = dao;
        this.signer = signer;
        this.tokens = tokens;
        this.settings = settings;
        this.clock = clock;
    }

    public Context require(
            String authorization, String csrf, boolean verified, boolean activity, Connection c) {
        if (authorization == null || !authorization.startsWith("Bearer "))
            throw AccountError.unauthorized();
        var claim = signer.parseSession(authorization.substring(7), ArgosWebSession.class);
        if (claim == null || claim.uid() == null || claim.sid() == null)
            throw AccountError.unauthorized();
        var user = dao.user(claim.uid(), c, true);
        if (user == null || Set.of("ARCHIVED", "SUSPENDED").contains(user.getState()))
            throw AccountError.unauthorized();
        var session = dao.session(claim.sid(), c, true);
        Instant now = clock.instant();
        if (session == null
                || !user.getId().equals(session.getUserId())
                || session.getRevokedAt() != null
                || !session.getExpiresAt().isAfter(now)
                || !session.getLastActivityAt().plus(settings.idleTtl()).isAfter(now))
            throw AccountError.unauthorized();
        if (csrf != null && !MessageDigest.isEqual(tokens.sha256(csrf), session.getCsrfHash()))
            throw AccountError.forbidden("csrf_invalid");
        if (verified && !"ACTIVE".equals(user.getState()))
            throw AccountError.forbidden("email_unverified");
        if (activity) {
            session.setLastActivityAt(now);
            dao.save(session, c);
        }
        return new Context(user, session);
    }

    public <T> T with(
            String auth,
            String csrf,
            boolean verified,
            boolean activity,
            BiFunction<Context, Connection, T> work) {
        return dao.transaction(c -> work.apply(require(auth, csrf, verified, activity, c), c));
    }

    public void recent(Context context) {
        if (!context.session()
                .getAuthenticatedAt()
                .plus(settings.recentTtl())
                .isAfter(clock.instant())) throw AccountError.forbidden("reauth_required");
    }

    public Issued create(AccountUser user, String csrf, Connection c) {
        if (Set.of("ARCHIVED", "SUSPENDED").contains(user.getState()))
            throw AccountError.unauthorized();
        Instant now = clock.instant();
        var s = new AccountSession();
        s.setUserId(user.getId());
        s.setCsrfHash(tokens.sha256(csrf));
        s.setCreatedAt(now);
        s.setAuthenticatedAt(now);
        s.setLastActivityAt(now);
        s.setExpiresAt(now.plus(settings.absoluteTtl()));
        dao.save(s, c);
        return new Issued(signer.issue(user.getId(), s.getId()), new Context(user, s));
    }

    public String renew(String auth, String csrf) {
        return with(
                auth,
                csrf,
                false,
                false,
                (context, c) -> signer.issue(context.user().getId(), context.session().getId()));
    }

    public void revokeAll(long user, Long except, Connection c) {
        var t = QAccountSession.table;
        var q =
                dao.transactions
                        .update(t, c)
                        .set(t.revokedAt, clock.instant())
                        .where(t.userId.eq(user), t.revokedAt.isNull());
        if (except != null) q.where(t.id.ne(except));
        q.execute();
    }

    public void revoke(AccountSession session, Connection c) {
        session.setRevokedAt(clock.instant());
        dao.save(session, c);
    }

    public void event(String action, String outcome, Long user, Long session, Connection c) {
        var e = new AccountSecurityEvent();
        e.setAction(action);
        e.setOutcome(outcome);
        e.setUserId(user);
        e.setSessionId(session);
        e.setCreatedAt(clock.instant());
        dao.save(e, c);
        var t = QAccountSecurityEvent.table;
        dao.transactions
                .delete(t, c)
                .where(t.createdAt.lt(clock.instant().minus(Duration.ofDays(90))))
                .execute();
    }
}
