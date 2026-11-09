package com.dokor.argos.services.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class AccountMailPayloadTest {
    private AccountMailPayload codec(String secret) {
        return new AccountMailPayload(new AccountSettings(ConfigFactory.parseMap(
                Map.of("account.jwt-secret", secret))), new ObjectMapper());
    }

    @Test void encryptsRecipientAndTokenWithUniqueAuthenticatedNonce() {
        var codec = codec("s".repeat(64));
        var message = AccountEmail.render(AccountEmail.Kind.VERIFY, "en",
                "https://example.com", "t".repeat(43), java.time.Duration.ofHours(24));
        var first = codec.encrypt("private@example.com", message);
        var second = codec.encrypt("private@example.com", message);
        assertFalse(Arrays.equals(first, second));
        assertFalse(new String(first, StandardCharsets.UTF_8).contains("private@example.com"));
        assertFalse(new String(first, StandardCharsets.UTF_8).contains("t".repeat(43)));
        var delivery = codec.decrypt(first);
        assertEquals("private@example.com", delivery.recipient());
        assertEquals(message, delivery.message());
        assertEquals("AccountMailDelivery", delivery.toString());
        first[first.length - 1] ^= 1;
        assertThrows(IllegalStateException.class, () -> codec.decrypt(first));
        assertThrows(IllegalStateException.class, () -> codec("x".repeat(64)).decrypt(second));
    }
}
