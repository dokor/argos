package com.dokor.argos.services.account;

import com.google.common.net.InetAddresses;
import org.glassfish.grizzly.http.server.Request;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.HexFormat;

/** An IP assertion is trusted only when authenticated by our BFF, never from XFF alone. */
final class AccountClientIdentity {
    private AccountClientIdentity() {}

    static String remote(Request request, AccountSettings settings, Clock clock) {
        if (request == null) return "direct";
        String peer = request.getRemoteAddr();
        String secret = settings.value("proxy-secret", "");
        String client = request.getHeader("X-Argos-Client-IP");
        String proof = request.getHeader("X-Argos-Client-Proof");
        if (secret == null || !secret.matches("[a-f0-9]{64}")
                || client == null || client.length() > 45 || client.contains("%")
                || !InetAddresses.isInetAddress(client)
                || proof == null || !proof.matches("[0-9]{10}\\.[a-f0-9]{64}")) return peer;
        // Ambiguous duplicate headers must never select a different bucket.
        if (!single(request.getHeaders("X-Argos-Client-IP"))
                || !single(request.getHeaders("X-Argos-Client-Proof"))) return peer;
        String timestamp = proof.substring(0, 10);
        if (Math.abs(clock.instant().getEpochSecond() - Long.parseLong(timestamp)) > 60) return peer;
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(("argos-client-v1\n" + timestamp + "\n" + client)
                    .getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(expected, HexFormat.of().parseHex(proof.substring(11)))) return peer;
            // Canonicalize IPv6 and mapped IPv4 without DNS to avoid alternate buckets.
            return InetAddresses.toAddrString(InetAddresses.forString(client));
        } catch (java.security.GeneralSecurityException failure) {
            throw new IllegalStateException("Client identity authentication unavailable", failure);
        }
    }

    private static boolean single(Iterable<String> values) {
        var iterator = values.iterator();
        if (!iterator.hasNext()) return false;
        iterator.next();
        return !iterator.hasNext();
    }
}
