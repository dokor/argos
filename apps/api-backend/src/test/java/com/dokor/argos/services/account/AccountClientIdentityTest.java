package com.dokor.argos.services.account;

import com.typesafe.config.ConfigFactory;
import org.glassfish.grizzly.http.server.Request;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountClientIdentityTest {
    private static final String SECRET = "a".repeat(64);
    private static final long NOW = 1794211200;
    private final Clock clock = Clock.fixed(Instant.ofEpochSecond(NOW), ZoneOffset.UTC);
    private final AccountSettings settings = settings(SECRET);

    private static AccountSettings settings(String secret) {
        return new AccountSettings(ConfigFactory.parseMap(Map.of("account.proxy-secret", secret)));
    }

    private Request request(String client, long timestamp) throws Exception {
        var request = mock(Request.class);
        when(request.getRemoteAddr()).thenReturn("172.18.0.5");
        when(request.getHeader("X-Forwarded-For")).thenReturn("192.0.2.99");
        when(request.getHeader("X-Real-IP")).thenReturn("192.0.2.99");
        when(request.getHeader("Forwarded")).thenReturn("for=192.0.2.99");
        when(request.getHeader("X-Argos-Client-IP")).thenReturn(client);
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String proof = timestamp + "." + HexFormat.of().formatHex(mac.doFinal(
                ("argos-client-v1\n" + timestamp + "\n" + client).getBytes(StandardCharsets.UTF_8)));
        when(request.getHeader("X-Argos-Client-Proof")).thenReturn(proof);
        when(request.getHeaders("X-Argos-Client-IP")).thenReturn(List.of(client));
        when(request.getHeaders("X-Argos-Client-Proof")).thenReturn(List.of(proof));
        return request;
    }

    @Test void separatesClientsBehindTheSameBff() throws Exception {
        assertEquals("203.0.113.8", AccountClientIdentity.remote(request("203.0.113.8", NOW), settings, clock));
        assertEquals("203.0.113.9", AccountClientIdentity.remote(request("203.0.113.9", NOW), settings, clock));
    }

    @Test void acceptsTheNodeBffProtocolVector() throws Exception {
        var request = request("203.0.113.8", NOW);
        when(request.getHeader("X-Argos-Client-Proof")).thenReturn(
                "1794211200.efdf511515f25c2d09fa7397b2c04295e3916d49e71e1fba37e2ea59764dce62");
        assertEquals("203.0.113.8", AccountClientIdentity.remote(request, settings, clock));
    }

    @Test void canonicalizesIpv6AndMappedIpv4() throws Exception {
        assertEquals("2001:db8::8", AccountClientIdentity.remote(request("2001:0DB8:0:0:0:0:0:8", NOW), settings, clock));
        assertEquals("203.0.113.8", AccountClientIdentity.remote(request("::ffff:203.0.113.8", NOW), settings, clock));
    }

    @ParameterizedTest @ValueSource(strings = {"", "example.com", "203.0.113.8:80", "203.0.113.8,203.0.113.9", "fe80::1%eth0"})
    void rejectsMalformedSignedAddresses(String client) throws Exception {
        assertEquals("172.18.0.5", AccountClientIdentity.remote(request(client, NOW), settings, clock));
    }

    @Test void rejectsForgedMissingExpiredFutureAndDuplicateProofs() throws Exception {
        for (String proof : Arrays.asList(null, "", NOW + "." + "0".repeat(64), "forged")) {
            var request = request("203.0.113.8", NOW);
            when(request.getHeader("X-Argos-Client-Proof")).thenReturn(proof);
            assertEquals("172.18.0.5", AccountClientIdentity.remote(request, settings, clock));
        }
        for (long timestamp : new long[] {NOW - 61, NOW + 61})
            assertEquals("172.18.0.5", AccountClientIdentity.remote(request("203.0.113.8", timestamp), settings, clock));
        var changed = request("203.0.113.8", NOW);
        when(changed.getHeader("X-Argos-Client-IP")).thenReturn("203.0.113.9");
        assertEquals("172.18.0.5", AccountClientIdentity.remote(changed, settings, clock));
        for (String header : List.of("X-Argos-Client-IP", "X-Argos-Client-Proof")) {
            var duplicate = request("203.0.113.8", NOW);
            when(duplicate.getHeaders(header)).thenReturn(List.of("first", "second"));
            assertEquals("172.18.0.5", AccountClientIdentity.remote(duplicate, settings, clock));
        }
    }

    @Test void failsClosedWithoutConfiguredTrustOrWithWrongSecret() throws Exception {
        for (String secret : List.of("", "short", "b".repeat(64)))
            assertEquals("172.18.0.5", AccountClientIdentity.remote(request("203.0.113.8", NOW), settings(secret), clock));
        assertEquals("direct", AccountClientIdentity.remote(null, settings, clock));
    }
}
