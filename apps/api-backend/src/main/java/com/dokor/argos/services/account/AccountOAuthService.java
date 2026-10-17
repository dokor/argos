package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;

import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Singleton
public class AccountOAuthService {
    public record Start(String url, String state, String browser) {}

    public record Finish(String jwt, String returnPath) {}

    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final AccountOAuthClient client;
    private final AccountAuthService auth;
    private final TokenService tokens;
    private final Clock clock;
    private final AccountSettings settings;

    @Inject
    public AccountOAuthService(
            AccountDao dao,
            AccountSessionService sessions,
            AccountOAuthClient client,
            AccountAuthService auth,
            TokenService tokens,
            Clock clock,
            AccountSettings settings) {
        this.dao = dao;
        this.sessions = sessions;
        this.client = client;
        this.auth = auth;
        this.tokens = tokens;
        this.clock = clock;
        this.settings = settings;
    }

    public List<String> providers() {
        return AccountOAuthClient.PROVIDERS.keySet().stream()
                .filter(client::configured)
                .sorted()
                .toList();
    }

    public static String returnPath(String raw) {
        if (raw == null) return "/account";
        // Next keeps any report return capability in an HttpOnly browser cookie, never in this DB
        // row.
        if (!List.of("/account", "/en/account").contains(raw)) return "/account";
        return raw;
    }

    public Start start(
            String provider, String intent, String path, String authorization, String csrf) {
        client.provider(provider);
        if (!List.of("login", "link").contains(intent))
            throw new AccountError(400, "oauth_invalid");
        String state = tokens.generateToken(),
                browser = tokens.generateToken(),
                nonce = tokens.generateToken(),
                verifier = tokens.generateToken();
        dao.transaction(
                c -> {
                    var expired = QAccountOauth.table;
                    dao.transactions
                            .delete(expired, c)
                            .where(expired.expiresAt.lt(clock.instant()))
                            .execute();
                    var tx = new AccountOauth();
                    if (intent.equals("link")) {
                        if (!AccountCsrf.valid(csrf)) throw AccountError.forbidden("csrf_invalid");
                        var context = sessions.require(authorization, csrf, true, true, c);
                        sessions.recent(context);
                        tx.setUserId(context.user().getId());
                        tx.setSessionId(context.session().getId());
                    }
                    tx.setStateHash(tokens.sha256(state));
                    tx.setBrowserHash(tokens.sha256(browser));
                    tx.setNonce(nonce);
                    tx.setVerifier(verifier);
                    tx.setProvider(provider);
                    tx.setIntent(intent);
                    tx.setReturnPath(returnPath(path));
                    tx.setExpiresAt(
                            clock.instant()
                                    .plus(settings.duration("oauth-ttl", Duration.ofMinutes(10))));
                    dao.save(tx, c);
                    return null;
                });
        return new Start(client.authorize(provider, state, nonce, verifier), state, browser);
    }

    public Finish finish(
            String provider,
            String raw,
            String browser,
            String code,
            String authorization,
            String csrf) {
        return finish(provider, raw, browser, code, authorization, csrf, "fr");
    }

    public Finish finish(String provider, String raw, String browser, String code,
                         String authorization, String csrf, String language) {
        if (!AccountCsrf.valid(raw) || !AccountCsrf.valid(browser)) {
            AccountOAuthDiagnostics.rejected(provider, AccountOAuthDiagnostics.Stage.CALLBACK_CONTEXT,
                    AccountOAuthDiagnostics.Reason.INVALID_CONTEXT, 0);
            throw new AccountError(400, "oauth_invalid");
        }
        // Burn the state before external I/O. Failure and cancellation cannot replay the
        // transaction.
        var tx =
                dao.transaction(
                        c -> {
                            var q = QAccountOauth.table;
                            var t =
                                    dao.transactions
                                            .selectQuery(c)
                                            .select(q)
                                            .from(q)
                                            .where(q.stateHash.eq(tokens.sha256(raw)))
                                            .forUpdate()
                                            .fetchOne();
                            if (t == null
                                    || t.getConsumedAt() != null
                                    || !t.getExpiresAt().isAfter(clock.instant())
                                    || !provider.equals(t.getProvider())
                                    || !MessageDigest.isEqual(
                                            t.getBrowserHash(), tokens.sha256(browser))) {
                                AccountOAuthDiagnostics.rejected(provider,
                                        AccountOAuthDiagnostics.Stage.TRANSACTION,
                                        AccountOAuthDiagnostics.Reason.INVALID_OR_EXPIRED_TRANSACTION, 0);
                                throw new AccountError(400, "oauth_invalid");
                            }
                            t.setConsumedAt(clock.instant());
                            dao.save(t, c);
                            return t;
                        });
        var identity = client.exchange(provider, code, tx.getNonce(), tx.getVerifier());
        try {
            return dao.transaction(
                    c -> {
                        if (tx.getIntent().equals("link")) {
                            if (!AccountCsrf.valid(csrf)) throw AccountError.forbidden("csrf_invalid");
                            var context = sessions.require(authorization, csrf, true, true, c);
                            sessions.recent(context);
                            if (!context.user().getId().equals(tx.getUserId())
                                    || !context.session().getId().equals(tx.getSessionId()))
                                throw AccountError.forbidden("oauth_invalid");
                            var existing = dao.identity(provider, identity.subject(), c);
                            if (existing != null
                                    && !existing.getUserId().equals(context.user().getId()))
                                throw new AccountError(409, "method_unavailable");
                            if (existing == null) {
                                existing = new AccountIdentity();
                                existing.setUserId(context.user().getId());
                                existing.setProvider(provider);
                                existing.setSubject(identity.subject());
                                existing.setCreatedAt(clock.instant());
                            }
                            existing.setDisabledAt(null);
                            dao.save(existing, c);
                            sessions.revokeAll(
                                    context.user().getId(), context.session().getId(), c);
                            sessions.event(
                                    "method_link",
                                    "accepted",
                                    context.user().getId(),
                                    context.session().getId(),
                                    c);
                            auth.notice(context.user(), AccountEmail.Kind.METHOD_ADDED, language);
                            return new Finish(null, tx.getReturnPath());
                        }
                        var existing = dao.identity(provider, identity.subject(), c);
                        AccountUser user;
                        if (existing != null) {
                            user = dao.user(existing.getUserId(), c, true);
                            // Re-read after the account lock: a concurrent unlink may have disabled
                            // the method.
                            existing = dao.identity(provider, identity.subject(), c, true);
                            if (user == null
                                    || existing.getDisabledAt() != null
                                    || Set.of("ARCHIVED", "SUSPENDED").contains(user.getState()))
                                throw AccountError.unauthorized();
                        } else {
                            String email =
                                    identity.email() == null
                                            ? null
                                            : AccountIdentityValues.email(identity.email());
                            if (email != null && dao.email(email, c) != null)
                                throw new AccountError(409, "use_existing_account");
                            user = new AccountUser();
                            user.setEmail(email);
                            user.setState(
                                    email != null && identity.verified() ? "ACTIVE" : "PENDING");
                            String name =
                                    identity.name() == null || identity.name().isBlank()
                                            ? "Argos"
                                            : identity.name();
                            user.setDisplayName(name.substring(0, Math.min(name.length(), 100)));
                            user.setRole("USER");
                            user.setOffer("FREE");
                            user.setCreatedAt(clock.instant());
                            dao.save(user, c);
                            existing = new AccountIdentity();
                            existing.setUserId(user.getId());
                            existing.setProvider(provider);
                            existing.setSubject(identity.subject());
                            existing.setCreatedAt(clock.instant());
                            dao.save(existing, c);
                            if (email != null && !"ACTIVE".equals(user.getState()))
                                auth.issue(user, "VERIFY", null, c, language);
                        }
                        if (!AccountCsrf.valid(csrf)) throw AccountError.forbidden("csrf_invalid");
                        var issued = sessions.create(user, csrf, c);
                        // An OAuth callback can be silent: it does not prove fresh authentication
                        // for sensitive actions.
                        issued.context().session().setAuthenticatedAt(Instant.EPOCH);
                        dao.save(issued.context().session(), c);
                        sessions.event(
                                "social_login",
                                "accepted",
                                user.getId(),
                                issued.context().session().getId(),
                                c);
                        return new Finish(issued.jwt(), tx.getReturnPath());
                    });
        } catch (RuntimeException failure) {
            if (AccountAuthService.duplicate(failure))
                throw new AccountError(409, tx.getIntent().equals("link")
                        ? "method_unavailable" : "use_existing_account");
            throw failure;
        }
    }
}
