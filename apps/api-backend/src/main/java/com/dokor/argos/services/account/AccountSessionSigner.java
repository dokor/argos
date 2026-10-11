package com.dokor.argos.services.account;

import com.coreoz.plume.admin.websession.JwtSessionSigner;
import com.coreoz.plume.admin.websession.WebSessionSigner;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;

import jakarta.inject.*;

import java.time.Clock;
import java.util.Date;

/** Plume signer with a quiet maintained JJWT reader: raw parser exceptions contain claims. */
@Singleton
public class AccountSessionSigner implements WebSessionSigner {
    private final AccountSettings settings;
    private final ObjectMapper mapper;
    private final Clock clock;
    private volatile JwtSessionSigner signer;
    private volatile JwtParser parser;

    @Inject
    public AccountSessionSigner(AccountSettings settings, ObjectMapper mapper, Clock clock) {
        this.settings = settings;
        this.mapper = mapper;
        this.clock = clock;
    }

    private synchronized void initialize() {
        if (parser != null) return;
        if (!settings.enabled()) throw new AccountError(503, "account_unavailable");
        var secret = settings.secret();
        signer = new JwtSessionSigner(secret, mapper, clock);
        parser =
                Jwts.parser()
                        .verifyWith(
                                Keys.hmacShaKeyFor(
                                        secret.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                        .requireIssuer("argos-account")
                        .requireAudience("argos-account")
                        .require("usage", "account")
                        .clock(() -> new Date(clock.millis()))
                        .build();
    }

    @Override
    public <T> T parseSession(String token, Class<T> type) {
        initialize();
        if (token == null || token.length() > 4096) return null;
        try {
            var claims = parser.parseSignedClaims(token).getPayload();
            if (claims.getExpiration() == null
                    || !claims.getExpiration().toInstant().isAfter(clock.instant())) return null;
            if (type == ArgosWebSession.class)
                return type.cast(
                        new ArgosWebSession(
                                claims.getIssuer(),
                                "argos-account",
                                "account",
                                claims.get("uid", Long.class),
                                claims.get("sid", Long.class),
                                claims.getExpiration().getTime() / 1000));
            return mapper.convertValue(claims, type);
        } catch (RuntimeException invalid) {
            return null;
        }
    }

    @Override
    public String serializeSession(Object info, Long expiration) {
        initialize();
        return signer.serializeSession(info, expiration);
    }

    public String issue(long user, long session) {
        long expiry = clock.instant().plus(settings.jwtTtl()).toEpochMilli();
        return serializeSession(
                new ArgosWebSession(
                        "argos-account", "argos-account", "account", user, session, expiry / 1000),
                expiry);
    }
}
