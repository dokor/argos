package com.dokor.argos.services.token;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;

class TokenServiceTest {
    private final TokenService service = new TokenService();

    @Test
    void generatedTokensAreUnpaddedBase64UrlEncodingOf32Bytes() {
        var samples = new HashSet<String>();
        for (int i = 0; i < 32; i++) {
            String token = service.generateToken();
            assertEquals(43, token.length());
            assertTrue(token.matches("[A-Za-z0-9_-]{43}"));
            assertEquals(32, Base64.getUrlDecoder().decode(token).length);
            assertTrue(samples.add(token), "A generated token was repeated in this sample");
        }
    }

    @Test
    void sha256UsesUtf8BytesAndReturnsAFullDigest() throws Exception {
        String token = "é-token_-";
        byte[] expected = MessageDigest.getInstance("SHA-256")
            .digest(token.getBytes(StandardCharsets.UTF_8));
        assertArrayEquals(expected, service.sha256(token));
        assertEquals(32, service.sha256(token).length);
        assertFalse(MessageDigest.isEqual(service.sha256(token), service.sha256(token + "x")));
    }
}
