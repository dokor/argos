package com.dokor.argos.services.account;

import com.typesafe.config.Config;

import jakarta.inject.*;

import java.net.URI;
import java.time.Duration;

@Singleton
public class AccountSettings {
    private final Config config;

    @Inject
    public AccountSettings(Config config) {
        this.config = config;
    }

    public boolean enabled() {
        return config.hasPath("account.enabled") && config.getBoolean("account.enabled");
    }

    public String secret() {
        String value = value("jwt-secret", "");
        if (value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 64)
            throw new IllegalStateException("Account JWT secret missing or too short");
        return value;
    }

    public String origin() {
        String value = value("origin", "http://localhost:3000");
        URI uri = URI.create(value);
        if (uri.getHost() == null
                || uri.getUserInfo() != null
                || uri.getQuery() != null
                || uri.getFragment() != null
                || (uri.getPath() != null && !uri.getPath().isEmpty() && !uri.getPath().equals("/"))
                || !("https".equals(uri.getScheme())
                        || ("http".equals(uri.getScheme())
                                && java.util.List.of("localhost", "127.0.0.1")
                                        .contains(uri.getHost()))))
            throw new IllegalStateException("Invalid account origin");
        return value.replaceAll("/+$", "");
    }

    public String value(String path, String fallback) {
        return config.hasPath("account." + path) ? config.getString("account." + path) : fallback;
    }

    public int integer(String path, int fallback) {
        int v = config.hasPath("account." + path) ? config.getInt("account." + path) : fallback;
        if (v < 1) throw new IllegalStateException("Invalid account limit");
        return v;
    }

    public Duration duration(String path, Duration fallback) {
        Duration d =
                config.hasPath("account." + path)
                        ? config.getDuration("account." + path)
                        : fallback;
        if (d.isNegative() || d.isZero())
            throw new IllegalStateException("Invalid account duration");
        return d;
    }

    public Duration jwtTtl() {
        return duration("jwt-ttl", Duration.ofMinutes(15));
    }

    public Duration absoluteTtl() {
        return duration("session-ttl", Duration.ofHours(12));
    }

    public Duration idleTtl() {
        return duration("idle-ttl", Duration.ofMinutes(30));
    }

    public Duration recentTtl() {
        return duration("recent-ttl", Duration.ofMinutes(5));
    }

    public Duration tokenTtl(String purpose) {
        return duration(
                "token-" + purpose.toLowerCase() + "-ttl",
                purpose.equals("VERIFY") ? Duration.ofHours(24) : Duration.ofMinutes(30));
    }
}
