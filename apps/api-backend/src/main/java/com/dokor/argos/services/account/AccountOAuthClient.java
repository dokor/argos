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
                                    "https://www.linkedin.com/oauth",
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
    private final HttpClient http;

    @Inject
    public AccountOAuthClient(AccountSettings settings, ObjectMapper mapper) {
        this(settings, mapper, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    AccountOAuthClient(AccountSettings settings, ObjectMapper mapper, HttpClient http) {
        this.settings = settings;
        this.mapper = mapper;
        this.http = http;
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
        if (code == null || code.length() > 2048) {
            AccountOAuthDiagnostics.rejected(name, AccountOAuthDiagnostics.Stage.CALLBACK_CONTEXT,
                    AccountOAuthDiagnostics.Reason.INVALID_CONTEXT, 0);
            throw new AccountError(400, "oauth_invalid");
        }
        var stage = AccountOAuthDiagnostics.Stage.TOKEN_EXCHANGE;
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
                stage = AccountOAuthDiagnostics.Stage.PROVIDER_PROFILE;
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
            stage = AccountOAuthDiagnostics.Stage.ID_TOKEN_PARSING;
            var jwt = JWTParser.parse(response.path("id_token").asText());
            stage = AccountOAuthDiagnostics.Stage.ID_TOKEN_VALIDATION;
            var validator =
                    new IDTokenValidator(
                            new Issuer(p.issuer()),
                            new ClientID(settings.value("oauth." + name + ".client-id", "")),
                            JWSAlgorithm.RS256,
                            URI.create(p.jwks()).toURL(),
                            new DefaultResourceRetriever(5000, 5000, 100000));
            validator.setMaxClockSkew(0);
            var claims = validateOidc(jwt, validator, nonce);
            stage = AccountOAuthDiagnostics.Stage.IDENTITY_CLAIMS;
            return oidcIdentity(p, claims);
        } catch (Exception invalid) {
            AccountOAuthDiagnostics.rejected(name, stage, failureReason(invalid),
                    invalid instanceof ProviderHttpFailure rejected ? rejected.status : 0);
            throw new AccountError(400, "oauth_invalid");
        }
    }

    private static AccountOAuthDiagnostics.Reason failureReason(Exception failure) {
        if (failure instanceof ProviderHttpFailure) return AccountOAuthDiagnostics.Reason.HTTP_REJECTED;
        if (failure instanceof HttpTimeoutException) return AccountOAuthDiagnostics.Reason.TIMEOUT;
        if (failure instanceof com.fasterxml.jackson.core.JsonProcessingException
                || failure instanceof java.text.ParseException)
            return AccountOAuthDiagnostics.Reason.MALFORMED_RESPONSE;
        if (failure instanceof java.io.IOException) return AccountOAuthDiagnostics.Reason.NETWORK_IO;
        if (failure instanceof com.nimbusds.jose.proc.BadJOSEException || failure instanceof JOSEException)
            return AccountOAuthDiagnostics.Reason.OIDC_REJECTED;
        return AccountOAuthDiagnostics.Reason.UNEXPECTED_RESPONSE;
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

    static Identity oidcIdentity(
            Provider provider, com.nimbusds.openid.connect.sdk.claims.IDTokenClaimsSet claims)
            throws Exception {
        var object = claims.toJSONObject();
        String subject = claims.getSubject().getValue();
        if (subject.isBlank() || subject.length() > 200) throw new Exception();
        String email = object.get("email") instanceof String e ? e : null;
        // Keep existing LinkedIn account keys stable when correcting the validation issuer.
        String namespace =
                provider.name().equals("linkedin") ? "https://www.linkedin.com" : provider.issuer();
        return new Identity(
                namespace + "|" + subject,
                email,
                Boolean.TRUE.equals(object.get("email_verified")),
                object.get("name") instanceof String n ? n : "Argos");
    }

    private JsonNode json(HttpRequest request) throws Exception {
        var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (var body = response.body()) {
            if (response.statusCode() != 200) throw new ProviderHttpFailure(response.statusCode());
            byte[] bytes = body.readNBytes(100001);
            if (bytes.length > 100000) throw new Exception();
            return mapper.readTree(bytes);
        }
    }

    private static final class ProviderHttpFailure extends Exception {
        private final int status;

        private ProviderHttpFailure(int status) {
            this.status = status;
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
