package com.dokor.argos.services.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Bounded JSON transport for configured external services. Redirects are never followed. */
@Singleton
public class ExternalHttpClient {
    private static final String USER_AGENT = "argos-auditor/1.0";
    private final ObjectMapper mapper;
    private final Map<Duration, HttpClient> clients = new ConcurrentHashMap<>();

    @Inject
    public ExternalHttpClient(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public JsonNode getJson(URI uri, Duration timeout, Duration connectTimeout, long maxBytes,
                            Map<String, String> headers) throws Exception {
        return send(uri, "GET", null, null, timeout, connectTimeout, maxBytes, headers);
    }

    public JsonNode postJson(URI uri, String body, String contentType, Duration timeout,
                             Duration connectTimeout, long maxBytes, Map<String, String> headers) throws Exception {
        return send(uri, "POST", body, contentType, timeout, connectTimeout, maxBytes, headers);
    }

    private JsonNode send(URI uri, String method, String body, String contentType, Duration timeout,
                          Duration connectTimeout, long maxBytes, Map<String, String> headers) throws Exception {
        var builder = HttpRequest.newBuilder(uri)
            .timeout(AuditDeadline.requestTimeout(timeout))
            .header("User-Agent", USER_AGENT);
        headers.forEach(builder::header);
        if ("POST".equals(method)) {
            builder.header("Content-Type", contentType);
            builder.POST(body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        } else {
            builder.GET();
        }
        HttpClient client = clients.computeIfAbsent(connectTimeout, duration -> HttpClient.newBuilder()
            .connectTimeout(duration).followRedirects(HttpClient.Redirect.NEVER).build());
        java.net.http.HttpResponse<String> response;
        try {
            response = client.send(builder.build(), BoundedBodyHandlers.ofString(maxBytes));
        } catch (IOException transport) {
            // The bounded body handler can wrap an HTTP timeout inside IOException.
            for (Throwable cause = transport; cause != null; cause = cause.getCause()) {
                if (cause instanceof HttpTimeoutException timeoutCause) throw timeoutCause;
            }
            throw transport;
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            // Never include the upstream body: it may contain a target URL or a service secret.
            throw new HttpStatusException(response.statusCode());
        }
        try {
            JsonNode json = mapper.readTree(response.body());
            if (json == null || !json.isObject()) {
                throw new IllegalStateException("External service returned invalid JSON object");
            }
            return json;
        } catch (JsonProcessingException invalid) {
            // Jackson's exception can embed source text; keep it out of structured logs.
            throw new IllegalStateException("External service returned invalid JSON", invalid);
        }
    }

    public static final class HttpStatusException extends IllegalStateException {
        private final int statusCode;

        public HttpStatusException(int statusCode) {
            super("External service returned HTTP " + statusCode);
            this.statusCode = statusCode;
        }

        public int statusCode() { return statusCode; }
    }
}
