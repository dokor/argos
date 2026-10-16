package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;


import java.sql.Connection;
import java.time.Clock;
import java.util.*;

@Singleton
public class AccountAuthService {
    private final AccountDao dao;
    private final AccountPasswords passwords;
    private final AccountSessionService sessions;
    private final TokenService tokens;
    private final AccountSettings settings;
    private final AccountMail mail;
    private final Clock clock;

    @Inject
    public AccountAuthService(
            AccountDao dao,
            AccountPasswords passwords,
            AccountSessionService sessions,
            TokenService tokens,
            AccountSettings settings,
            AccountMail mail,
            Clock clock) {
        this.dao = dao;
        this.passwords = passwords;
        this.sessions = sessions;
        this.tokens = tokens;
        this.settings = settings;
        this.mail = mail;
        this.clock = clock;
    }

    public void available() {
        if (!settings.enabled()) throw new AccountError(503, "account_unavailable");
    }

    public void register(String raw, String password, String name) {
        register(raw, password, name, "fr");
    }

    public void register(String raw, String password, String name, String language) {
        available();
        String email = AccountIdentityValues.email(raw);
        String hash = passwords.hash(password);
        String display = AccountIdentityValues.displayName(name);
        try {
            dao.transaction(
                    c -> {
                        if (dao.email(email, c) != null) return null;
                        var u = new AccountUser();
                        u.setEmail(email);
                        u.setDisplayName(display);
                        u.setState("PENDING");
                        u.setRole("USER");
                        u.setOffer("FREE");
                        u.setCreatedAt(clock.instant());
                        dao.save(u, c);
                        password(u, hash, c);
                        issue(u, "VERIFY", null, c, language);
                        sessions.event("register", "accepted", u.getId(), null, c);
                        return null;
                    });
        } catch (RuntimeException failure) {
            if (duplicate(failure)) return;
            throw failure;
        }
    }

    public AccountSessionService.Issued login(String raw, String password, String csrf) {
        available();
        String email = AccountIdentityValues.email(raw);
        return dao.transaction(
                c -> {
                    var found = dao.email(email, c);
                    var u = found == null ? null : dao.user(found.getId(), c, true);
                    var local =
                            u == null
                                    ? null
                                    : dao.identity("password", u.getId().toString(), c, true);
                    boolean valid =
                            passwords.verify(
                                    local == null || local.getDisabledAt() != null
                                            ? null
                                            : local.getPasswordHash(),
                                    password);
                    if (!valid
                            || u == null
                            || Set.of("ARCHIVED", "SUSPENDED").contains(u.getState()))
                        throw AccountError.unauthorized();
                    var result = sessions.create(u, csrf, c);
                    sessions.event(
                            "login", "accepted", u.getId(), result.context().session().getId(), c);
                    return result;
                });
    }

    public void send(String raw, String purpose) {
        send(raw, purpose, "fr");
    }

    public void send(String raw, String purpose, String language) {
        available();
        String email = AccountIdentityValues.email(raw);
        dao.transaction(
                c -> {
                    var found = dao.email(email, c);
                    if (found == null) return null;
                    var u = dao.user(found.getId(), c, true);
                    if (Set.of("ARCHIVED", "SUSPENDED").contains(u.getState())
                            || purpose.equals("VERIFY") && !"PENDING".equals(u.getState())
                            || purpose.equals("RESET")
                                    && dao.identities(u.getId(), c).stream()
                                            .noneMatch(i -> i.getProvider().equals("password")))
                        return null;
                    issue(u, purpose, null, c, language);
                    return null;
                });
    }

    public void verify(String token) {
        consume(
                token,
                "VERIFY",
                null,
                (u, t, c) -> {
                    if (!"PENDING".equals(u.getState()) || u.getEmail() == null)
                        throw new AccountError(400, "token_invalid");
                    u.setState("ACTIVE");
                    u.setAdminVersion(u.getAdminVersion() + 1);
                    dao.save(u, c);
                    sessions.event("verify", "accepted", u.getId(), null, c);
                    return null;
                });
    }

    public void reset(String token, String password) {
        String hash = passwords.hash(password);
        consume(
                token,
                "RESET",
                null,
                (u, t, c) -> {
                    var identity = dao.identity("password", u.getId().toString(), c, true);
                    if (identity == null || identity.getDisabledAt() != null)
                        throw new AccountError(400, "token_invalid");
                    identity.setPasswordHash(hash);
                    dao.save(identity, c);
                    invalidateTokens(u.getId(), c);
                    sessions.revokeAll(u.getId(), null, c);
                    sessions.event("password_reset", "accepted", u.getId(), null, c);
                    notice(u, "Mot de passe modifié / Password changed");
                    return null;
                });
    }

    @FunctionalInterface
    interface TokenAction<T> {
        T apply(AccountUser u, AccountToken token, Connection c);
    }

    private <T> T consume(String raw, String purpose, Long session, TokenAction<T> work) {
        available();
        if (!AccountCsrf.valid(raw)) throw new AccountError(400, "token_invalid");
        return dao.transaction(
                c -> {
                    var q = QAccountToken.table;
                    var candidate =
                            dao.transactions
                                    .selectQuery(c)
                                    .select(q)
                                    .from(q)
                                    .where(q.tokenHash.eq(tokens.sha256(raw)))
                                    .fetchOne();
                    if (candidate == null) throw new AccountError(400, "token_invalid");
                    var u = dao.user(candidate.getUserId(), c, true);
                    var t =
                            dao.transactions
                                    .selectQuery(c)
                                    .select(q)
                                    .from(q)
                                    .where(q.id.eq(candidate.getId()))
                                    .forUpdate()
                                    .fetchOne();
                    if (u == null
                            || Set.of("ARCHIVED", "SUSPENDED").contains(u.getState())
                            || t.getConsumedAt() != null
                            || !purpose.equals(t.getPurpose())
                            || !t.getExpiresAt().isAfter(clock.instant())
                            || !Objects.equals(session, t.getSessionId()))
                        throw new AccountError(400, "token_invalid");
                    t.setConsumedAt(clock.instant());
                    dao.save(t, c);
                    return work.apply(u, t, c);
                });
    }

    public void issue(AccountUser user, String purpose, Long session, Connection c) {
        issue(user, purpose, session, c, "fr");
    }

    private void issue(AccountUser user, String purpose, Long session, Connection c, String language) {
        if (user.getEmail() == null) throw new AccountError(400, "email_required");
        var q = QAccountToken.table;
        dao.transactions
                .update(q, c)
                .set(q.consumedAt, clock.instant())
                .where(q.userId.eq(user.getId()), q.purpose.eq(purpose), q.consumedAt.isNull())
                .execute();
        dao.transactions
                .delete(q, c)
                .where(q.userId.eq(user.getId()), q.expiresAt.lt(clock.instant()))
                .execute();
        String raw = tokens.generateToken();
        var t = new AccountToken();
        t.setUserId(user.getId());
        t.setSessionId(session);
        t.setPurpose(purpose);
        t.setTokenHash(tokens.sha256(raw));
        t.setExpiresAt(clock.instant().plus(settings.tokenTtl(purpose)));
        dao.save(t, c);
        String path = emailPath(purpose, language);
        String message =
                purpose.equals("REAUTH")
                        ? "Code de confirmation / Confirmation code: " + raw
                        : "Confirmez explicitement sur / Confirm explicitly at: "
                                + settings.origin()
                                + path
                                + "#token="
                                + raw;
        mail.send(user.getEmail(), "Argos — " + purpose, message);
    }

    static String emailPath(String purpose, String language) {
        String prefix = "en".equals(language) ? "/en" : "";
        return prefix + ("VERIFY".equals(purpose) ? "/account/verify"
                : "RESET".equals(purpose) ? "/account/reset" : "/account");
    }

    public void reauth(String auth, String csrf, String password, String code) {
        if (code != null && !code.isBlank()) {
            sessions.with(
                    auth,
                    csrf,
                    false,
                    true,
                    (context, c) -> {
                        // Lock order remains user -> session -> token on the same transaction
                        // connection.
                        var q = QAccountToken.table;
                        var t =
                                dao.transactions
                                        .selectQuery(c)
                                        .select(q)
                                        .from(q)
                                        .where(q.tokenHash.eq(tokens.sha256(code)))
                                        .forUpdate()
                                        .fetchOne();
                        if (t == null
                                || !t.getUserId().equals(context.user().getId())
                                || !Objects.equals(t.getSessionId(), context.session().getId())
                                || !"REAUTH".equals(t.getPurpose())
                                || t.getConsumedAt() != null
                                || !t.getExpiresAt().isAfter(clock.instant()))
                            throw new AccountError(400, "token_invalid");
                        t.setConsumedAt(clock.instant());
                        dao.save(t, c);
                        fresh(context, c);
                        return null;
                    });
            return;
        }
        sessions.with(
                auth,
                csrf,
                false,
                true,
                (context, c) -> {
                    var local =
                            dao.identity("password", context.user().getId().toString(), c, true);
                    if (password == null || password.isBlank()) {
                        issue(context.user(), "REAUTH", context.session().getId(), c);
                        return null;
                    }
                    if (!passwords.verify(
                            local == null || local.getDisabledAt() != null
                                    ? null
                                    : local.getPasswordHash(),
                            password)) throw AccountError.unauthorized();
                    fresh(context, c);
                    return null;
                });
    }

    private void fresh(AccountSessionService.Context context, Connection c) {
        context.session().setAuthenticatedAt(clock.instant());
        dao.save(context.session(), c);
        sessions.event("reauth", "accepted", context.user().getId(), context.session().getId(), c);
    }

    public void confirmEmail(String auth, String csrf, String raw) {
        String email = AccountIdentityValues.email(raw);
        try {
            sessions.with(
                    auth,
                    csrf,
                    false,
                    true,
                    (context, c) -> {
                        if (context.user().getEmail() != null
                                && !context.user().getEmail().equals(email))
                            throw AccountError.forbidden("email_readonly");
                        var existing = dao.email(email, c);
                        if (existing != null && !existing.getId().equals(context.user().getId()))
                            throw new AccountError(409, "email_unavailable");
                        if (!"PENDING".equals(context.user().getState()))
                            throw AccountError.forbidden("email_readonly");
                        context.user().setEmail(email);
                        dao.save(context.user(), c);
                        issue(context.user(), "VERIFY", null, c);
                        return null;
                    });
        } catch (RuntimeException failure) {
            if (duplicate(failure)) throw new AccountError(409, "email_unavailable");
            throw failure;
        }
    }

    public void addPassword(String auth, String csrf, String password) {
        String hash = passwords.hash(password);
        sessions.with(
                auth,
                csrf,
                true,
                true,
                (context, c) -> {
                    sessions.recent(context);
                    password(context.user(), hash, c);
                    sessions.revokeAll(context.user().getId(), context.session().getId(), c);
                    sessions.event(
                            "password_change",
                            "accepted",
                            context.user().getId(),
                            context.session().getId(),
                            c);
                    notice(
                            context.user(),
                            "Méthode de connexion modifiée / Sign-in method changed");
                    return null;
                });
    }

    private void password(AccountUser user, String hash, Connection c) {
        var identity = dao.identity("password", user.getId().toString(), c, true);
        if (identity == null) {
            identity = new AccountIdentity();
            identity.setUserId(user.getId());
            identity.setProvider("password");
            identity.setSubject(user.getId().toString());
            identity.setCreatedAt(clock.instant());
        }
        identity.setDisabledAt(null);
        identity.setPasswordHash(hash);
        dao.save(identity, c);
    }

    public void removeMethod(String auth, String csrf, long id) {
        sessions.with(
                auth,
                csrf,
                true,
                true,
                (context, c) -> {
                    sessions.recent(context);
                    var all = dao.identities(context.user().getId(), c);
                    var method =
                            all.stream()
                                    .filter(i -> i.getId() == id)
                                    .findFirst()
                                    .orElseThrow(AccountError::missing);
                    if (all.stream()
                            .filter(i -> !i.getId().equals(method.getId()))
                            .noneMatch(this::usable)) throw AccountError.forbidden("last_method");
                    method.setDisabledAt(clock.instant());
                    method.setPasswordHash(null);
                    dao.save(method, c);
                    sessions.revokeAll(context.user().getId(), context.session().getId(), c);
                    sessions.event(
                            "method_remove",
                            "accepted",
                            context.user().getId(),
                            context.session().getId(),
                            c);
                    notice(context.user(), "Méthode retirée / Sign-in method removed");
                    return null;
                });
    }

    public void archive(String auth, String csrf, boolean confirmed) {
        if (!confirmed) throw new AccountError(400, "confirmation_required");
        sessions.with(
                auth,
                csrf,
                false,
                true,
                (context, c) -> {
                    sessions.recent(context);
                    var user = context.user();
                    user.setState("ARCHIVED");
                    user.setAdminVersion(user.getAdminVersion() + 1);
                    user.setArchivedAt(clock.instant());
                    dao.save(user, c);
                    sessions.revokeAll(user.getId(), null, c);
                    invalidateTokens(user.getId(), c);
                    var i = QAccountIdentity.table;
                    dao.transactions
                            .update(i, c)
                            .set(i.disabledAt, clock.instant())
                            .setNull(i.passwordHash)
                            .where(i.userId.eq(user.getId()))
                            .execute();
                    var o = QAccountOauth.table;
                    dao.transactions
                            .update(o, c)
                            .set(o.consumedAt, clock.instant())
                            .where(o.userId.eq(user.getId()), o.consumedAt.isNull())
                            .execute();
                    sessions.event(
                            "archive", "accepted", user.getId(), context.session().getId(), c);
                    return null;
                });
    }

    private boolean usable(AccountIdentity identity) {
        if (identity.getProvider().equals("password"))
            return identity.getPasswordHash() != null && !identity.getPasswordHash().isBlank();
        return AccountOAuthClient.PROVIDERS.containsKey(identity.getProvider())
                && !settings.value("oauth." + identity.getProvider() + ".client-id", "").isBlank()
                && !settings.value("oauth." + identity.getProvider() + ".client-secret", "")
                        .isBlank();
    }

    public void invalidateTokens(long user, Connection c) {
        var q = QAccountToken.table;
        dao.transactions
                .update(q, c)
                .set(q.consumedAt, clock.instant())
                .where(q.userId.eq(user), q.consumedAt.isNull())
                .execute();
    }

    public void notice(AccountUser user, String text) {
        if (user.getEmail() != null && "ACTIVE".equals(user.getState()))
            mail.send(user.getEmail(), "Argos — sécurité / security", text);
    }

    public static boolean duplicate(Throwable failure) {
        for (Throwable t = failure; t != null; t = t.getCause())
            if (t instanceof java.sql.SQLIntegrityConstraintViolationException) return true;
        return false;
    }
}
