package com.dokor.argos.services.security;

import com.dokor.argos.services.account.AccountError;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.Config;
import jakarta.inject.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.slf4j.LoggerFactory;

/** The provider consumes each proof once. Never log proofs, responses or exception details. */
@Singleton
public class AntiBotService {
    public static final String HEADER = "X-Argos-Captcha";
    private final boolean enabled;
    private final String siteKey, secret;
    private final Set<String> hostnames;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final Verification verification;
    @FunctionalInterface interface Verification { String verify(String json) throws Exception; }

    @Inject public AntiBotService(Config config, ObjectMapper mapper, Clock clock) {
        this(config, mapper, clock, transport());
    }
    AntiBotService(Config config, ObjectMapper mapper, Clock clock, Verification verification) {
        String mode = config.hasPath("antibot.mode") ? config.getString("antibot.mode") : "disabled";
        if (!Set.of("disabled", "turnstile").contains(mode)) throw new IllegalStateException("Invalid antibot mode");
        enabled = mode.equals("turnstile");
        siteKey = value(config, "site-key"); secret = value(config, "secret");
        hostnames = config.hasPath("antibot.hostnames") ? Set.copyOf(config.getStringList("antibot.hostnames")) : Set.of();
        if (enabled && (siteKey.isBlank() || secret.isBlank() || hostnames.isEmpty() || hostnames.stream().anyMatch(h -> !h.matches("[a-z0-9.-]+"))))
            throw new IllegalStateException("Incomplete antibot configuration");
        if (enabled && (siteKey.matches("[123]x000.*") || secret.matches("[123]x000.*")) && hostnames.stream().anyMatch(h -> !Set.of("localhost", "127.0.0.1").contains(h)))
            throw new IllegalStateException("Antibot testing keys require loopback hostnames");
        this.mapper = mapper; this.clock = clock; this.verification = verification;
        LoggerFactory.getLogger(AntiBotService.class).info("antibot_mode mode={}", mode);
    }
    private static String value(Config config, String key) { return config.hasPath("antibot." + key) ? config.getString("antibot." + key) : ""; }
    private static Verification transport() {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
        return json -> {
            var request = HttpRequest.newBuilder(URI.create("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                .timeout(Duration.ofSeconds(6)).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body().length() > 16384) throw new IllegalStateException();
            return response.body();
        };
    }
    public boolean enabled() { return enabled; }
    public Map<String,Object> publicConfig() { return enabled ? Map.of("enabled", true, "siteKey", siteKey) : Map.of("enabled", false); }
    public void require(String token, String action) {
        if (!enabled) return;
        if (token == null || token.isBlank() || token.length() > 2048) reject(action);
        JsonNode result;
        try { result = mapper.readTree(verification.verify(mapper.writeValueAsString(Map.of("secret", secret, "response", token)))); }
        catch (Exception unavailable) {
            if (unavailable instanceof InterruptedException) Thread.currentThread().interrupt();
            metric(action, "unavailable"); throw new AccountError(503, "antibot_unavailable");
        }
        try {
            Instant timestamp = Instant.parse(result.path("challenge_ts").asText());
            if (!result.path("success").isBoolean() || !result.path("success").booleanValue()
                || !action.equals(result.path("action").asText()) || !hostnames.contains(result.path("hostname").asText())
                || timestamp.isAfter(clock.instant().plusSeconds(30)) || !timestamp.isAfter(clock.instant().minusSeconds(300))) reject(action);
        } catch (java.time.format.DateTimeParseException | NullPointerException invalid) { reject(action); }
        metric(action, "accepted");
    }
    private static void metric(String action, String outcome) { LoggerFactory.getLogger(AntiBotService.class).info("antibot action={} outcome={}", action, outcome); }
    private static void reject(String action) { metric(action, "rejected"); throw new AccountError(400, "antibot_invalid"); }
}
