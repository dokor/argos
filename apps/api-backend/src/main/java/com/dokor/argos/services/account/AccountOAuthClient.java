package com.dokor.argos.services.account;

import com.fasterxml.jackson.databind.*;
import com.nimbusds.jose.*;
import com.nimbusds.jose.util.DefaultResourceRetriever;
import com.nimbusds.jwt.JWTParser;
import com.nimbusds.oauth2.sdk.id.*;
import com.nimbusds.openid.connect.sdk.Nonce;
import com.nimbusds.openid.connect.sdk.validators.IDTokenValidator;

import jakarta.inject.*;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@Singleton
public class AccountOAuthClient {
    public record Identity(String subject, String email, boolean verified, String name) {}

    public record Provider(
            String name,
            String authorize,
            String token,
            String issuer,
            String jwks,
            String scopes,
            boolean pkce) {}

    public static final Map<String, Provider> PROVIDERS =
            Map.of(
                    "google",
                            new Provider(
                                    "google",
                                    "https://accounts.google.com/o/oauth2/v2/auth",
                                    "https://oauth2.googleapis.com/token",
                                    "https://accounts.google.com",
                                    "https://www.googleapis.com/oauth2/v3/certs",
                                    "openid email profile",
                                    true),
                    "linkedin",
                            new Provider(
                                    "linkedin",
                                    "https://www.linkedin.com/oauth/v2/authorization",
                                    "https://www.linkedin.com/oauth/v2/accessToken",
                                    "https://www.linkedin.com",
                                    "https://www.linkedin.com/oauth/openid/jwks",
                                    "openid email profile",
                                    false),
                    "github",
                            new Provider(
                                    "github",
                                    "https://github.com/login/oauth/authorize",
                                    "https://github.com/login/oauth/access_token",
                                    null,
                                    null,
                                    "read:user user:email",
                                    true));
    private final AccountSettings settings;
    private final ObjectMapper mapper;
    private final HttpClient http =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .followRedirects(HttpClient.Redirect.NEVER)
                    .build();

    @Inject
    public AccountOAuthClient(AccountSettings settings, ObjectMapper mapper) {
        this.settings = settings;
        this.mapper = mapper;
    }

    public Provider provider(String name) {
        var p = PROVIDERS.get(name);
        if (p == null || !configured(name)) throw new AccountError(503, "provider_unavailable");
        return p;
    }

    public boolean configured(String p) {
        return settings.enabled()
                && PROVIDERS.containsKey(p)
                && !settings.value("oauth." + p + ".client-id", "").isBlank()
                && !settings.value("oauth." + p + ".client-secret", "").isBlank();
    }

    public String callback(String provider) {
        return settings.origin() + "/api/account/auth/oauth/" + provider + "/callback";
    }

    public String authorize(String name, String state, String nonce, String verifier) {
        var p = provider(name);
        var fields = new LinkedHashMap<String, String>();
        fields.put("client_id", settings.value("oauth." + name + ".client-id", ""));
        fields.put("redirect_uri", callback(name));
        fields.put("response_type", "code");
        fields.put("scope", p.scopes());
        fields.put("state", state);
        if (p.issuer() != null) fields.put("nonce", nonce);
        if (p.pkce()) {
            fields.put("code_challenge", challenge(verifier));
            fields.put("code_challenge_method", "S256");
        }
        return p.authorize() + "?" + form(fields);
    }

    public Identity exchange(String name, String code, String nonce, String verifier) {
        var p = provider(name);
        if (code == null || code.length() > 2048) throw new AccountError(400, "oauth_invalid");
        try {
            var fields = new LinkedHashMap<String, String>();
            fields.put("grant_type", "authorization_code");
            fields.put("code", code);
            fields.put("client_id", settings.value("oauth." + name + ".client-id", ""));
            fields.put("client_secret", settings.value("oauth." + name + ".client-secret", ""));
            fields.put("redirect_uri", callback(name));
            if (p.pkce()) fields.put("code_verifier", verifier);
            var response =
                    json(
                            HttpRequest.newBuilder(URI.create(p.token()))
                                    .timeout(Duration.ofSeconds(10))
                                    .header("Accept", "application/json")
                                    .header("Content-Type", "application/x-www-form-urlencoded")
                                    .POST(HttpRequest.BodyPublishers.ofString(form(fields)))
                                    .build());
            if (name.equals("github")) {
                String access = response.path("access_token").asText();
                if (access.isBlank()) throw new Exception();
                var user = get("https://api.github.com/user", access);
                var emails = get("https://api.github.com/user/emails", access);
                String email = null;
                boolean verified = false;
                for (var e : emails)
                    if (e.path("primary").asBoolean() && e.path("verified").asBoolean()) {
                        email = e.path("email").asText();
                        verified = true;
                        break;
                    }
                if (!user.path("id").canConvertToLong() || user.path("id").asLong() <= 0)
                    throw new Exception();
                return new Identity(
                        user.path("id").asText(),
                        email,
                        verified,
                        user.path("name").asText(user.path("login").asText("Argos")));
            }
            var jwt = JWTParser.parse(response.path("id_token").asText());
            var validator =
                    new IDTokenValidator(
                            new Issuer(p.issuer()),
                            new ClientID(settings.value("oauth." + name + ".client-id", "")),
                            JWSAlgorithm.RS256,
                            URI.create(p.jwks()).toURL(),
                            new DefaultResourceRetriever(5000, 5000, 100000));
            validator.setMaxClockSkew(0);
            var claims = validateOidc(jwt, validator, nonce);
            var object = claims.toJSONObject();
            String subject = claims.getSubject().getValue();
            if (subject.isBlank() || subject.length() > 200) throw new Exception();
            String email = object.get("email") instanceof String e ? e : null;
            return new Identity(
                    p.issuer() + "|" + subject,
                    email,
                    Boolean.TRUE.equals(object.get("email_verified")),
                    object.get("name") instanceof String n ? n : "Argos");
        } catch (Exception invalid) {
            throw new AccountError(400, "oauth_invalid");
        }
    }

    private JsonNode get(String uri, String access) throws Exception {
        return json(
                HttpRequest.newBuilder(URI.create(uri))
                        .timeout(Duration.ofSeconds(10))
                        .header("Authorization", "Bearer " + access)
                        .header("Accept", "application/json")
                        .header("User-Agent", "Argos-login")
                        .GET()
                        .build());
    }

    public static com.nimbusds.openid.connect.sdk.claims.IDTokenClaimsSet validateOidc(
            com.nimbusds.jwt.JWT jwt, IDTokenValidator validator, String nonce) throws Exception {
        return validator.validate(jwt, new Nonce(nonce));
    }

    private JsonNode json(HttpRequest request) throws Exception {
        var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (var body = response.body()) {
            if (response.statusCode() != 200) throw new Exception();
            byte[] bytes = body.readNBytes(100001);
            if (bytes.length > 100000) throw new Exception();
            return mapper.readTree(bytes);
        }
    }

    public static String challenge(String verifier) {
        try {
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(
                            java.security.MessageDigest.getInstance("SHA-256")
                                    .digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception impossible) {
            throw new IllegalStateException();
        }
    }

    private static String form(Map<String, String> values) {
        return values.entrySet().stream()
                .map(
                        e ->
                                URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                                        + "="
                                        + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(java.util.stream.Collectors.joining("&"));
    }
}
