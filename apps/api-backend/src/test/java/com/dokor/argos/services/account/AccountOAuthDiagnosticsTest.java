package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.*;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;

class AccountOAuthDiagnosticsTest {
    private static final String SECRET = "never-log-code-token-email-cookie";
    private final Logger logger = (Logger) LoggerFactory.getLogger(AccountOAuthDiagnostics.class);
    private ListAppender<ILoggingEvent> events;
    private HttpClient http;
    private AccountOAuthClient client;

    @BeforeEach
    void prepare() {
        events = new ListAppender<>();
        events.start();
        logger.addAppender(events);
        http = mock(HttpClient.class);
        var settings = new AccountSettings(ConfigFactory.parseMap(Map.of(
                "account.enabled", true, "account.origin", "https://argos.example",
                "account.oauth.linkedin.client-id", "fixture-client",
                "account.oauth.linkedin.client-secret", SECRET)));
        client = new AccountOAuthClient(settings, new ObjectMapper(), http);
    }

    @AfterEach
    void detach() {
        logger.detachAppender(events);
        events.stop();
    }

    private void rejection(String code, String stage, String reason, int status) {
        var error = assertThrows(AccountError.class,
                () -> client.exchange("linkedin", code, SECRET, SECRET));
        assertEquals(400, error.getResponse().getStatus());
        assertEquals(Map.of("error", "oauth_invalid"), error.getResponse().getEntity());
        assertEquals(1, events.list.size());
        var event = events.list.getFirst();
        assertEquals("account_oauth_rejected provider=linkedin stage=" + stage
                + " reason=" + reason + " http_status=" + status, event.getFormattedMessage());
        assertFalse(event.getFormattedMessage().contains(SECRET));
        assertNull(event.getThrowableProxy());
        assertEquals(4, event.getArgumentArray().length);
    }

    @SuppressWarnings("unchecked")
    private void response(int status, String body) throws Exception {
        HttpResponse<InputStream> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    @Test
    void missingCodeIsDiagnosedWithoutSendingProviderCredentials() {
        rejection(null, "CALLBACK_CONTEXT", "INVALID_CONTEXT", 0);
        verifyNoInteractions(http);
    }

    @Test
    void rejectedProviderResponseLogsOnlyStatusNotItsBody() throws Exception {
        response(400, "{\"error_description\":\"" + SECRET + "\"}");
        rejection(SECRET, "TOKEN_EXCHANGE", "HTTP_REJECTED", 400);
    }

    @Test
    void networkExceptionMessageAndStackAreNotLogged() throws Exception {
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new IOException(SECRET));
        rejection(SECRET, "TOKEN_EXCHANGE", "NETWORK_IO", 0);
    }

    @Test
    void timeoutIsDistinctFromOtherNetworkErrors() throws Exception {
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new HttpTimeoutException(SECRET));
        rejection(SECRET, "TOKEN_EXCHANGE", "TIMEOUT", 0);
    }

    @Test
    void invalidJsonDoesNotExposeParserSnippets() throws Exception {
        response(200, SECRET);
        rejection(SECRET, "TOKEN_EXCHANGE", "MALFORMED_RESPONSE", 0);
    }

    @Test
    void invalidIdTokenIsDistinguishedFromTokenExchange() throws Exception {
        response(200, "{\"id_token\":\"" + SECRET + "\"}");
        rejection(SECRET, "ID_TOKEN_PARSING", "MALFORMED_RESPONSE", 0);
    }

    @Test
    void disallowedSignatureAlgorithmRemainsRejectedWithoutLoggingTokenClaims() throws Exception {
        var jwt = new com.nimbusds.jwt.SignedJWT(
                new com.nimbusds.jose.JWSHeader(com.nimbusds.jose.JWSAlgorithm.HS256),
                new com.nimbusds.jwt.JWTClaimsSet.Builder()
                        .issuer("https://www.linkedin.com/oauth").subject(SECRET)
                        .audience("fixture-client").claim("nonce", SECRET)
                        .issueTime(new java.util.Date())
                        .expirationTime(new java.util.Date(System.currentTimeMillis() + 60000)).build());
        jwt.sign(new com.nimbusds.jose.crypto.MACSigner("s".repeat(32)));
        response(200, "{\"id_token\":\"" + jwt.serialize() + "\"}");
        rejection(SECRET, "ID_TOKEN_VALIDATION", "OIDC_REJECTED", 0);
        assertFalse(events.list.getFirst().getFormattedMessage().contains(jwt.serialize()));
    }

    @Test
    void invalidCallbackContextIsDiagnosedBeforeDatabaseOrProviderAccess() {
        var service = new AccountOAuthService(null, null, client, null, null, null, null);
        assertThrows(AccountError.class,
                () -> service.finish("linkedin", SECRET, SECRET, SECRET, null, null));
        assertEquals(1, events.list.size());
        assertEquals("account_oauth_rejected provider=linkedin stage=CALLBACK_CONTEXT"
                + " reason=INVALID_CONTEXT http_status=0", events.list.getFirst().getFormattedMessage());
        verifyNoInteractions(http);
    }

    @Test
    void unknownProviderInputIsNotCopiedToLogs() {
        AccountOAuthDiagnostics.rejected(SECRET + "\r\nforged", AccountOAuthDiagnostics.Stage.TRANSACTION,
                AccountOAuthDiagnostics.Reason.INVALID_OR_EXPIRED_TRANSACTION, 999);
        assertEquals("account_oauth_rejected provider=unknown stage=TRANSACTION"
                + " reason=INVALID_OR_EXPIRED_TRANSACTION http_status=0",
                events.list.getFirst().getFormattedMessage());
    }
}
