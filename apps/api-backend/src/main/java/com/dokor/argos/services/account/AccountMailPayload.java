package com.dokor.argos.services.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/** Keep bearer tokens and recipients out of readable database rows and diagnostics. */
@Singleton
public class AccountMailPayload {
    private static final byte[] CONTEXT = "argos-account-mail-outbox-v1".getBytes(StandardCharsets.UTF_8);
    private final AccountSettings settings;
    private final ObjectMapper mapper;
    private final SecureRandom random = new SecureRandom();

    public record Delivery(String recipient, AccountEmail.Message message) {
        @Override public String toString() { return "AccountMailDelivery"; }
    }

    @Inject
    public AccountMailPayload(AccountSettings settings, ObjectMapper mapper) {
        this.settings = settings;
        this.mapper = mapper;
    }

    public byte[] encrypt(String recipient, AccountEmail.Message message) {
        try {
            byte[] nonce = new byte[12];
            random.nextBytes(nonce);
            byte[] encrypted = cipher(Cipher.ENCRYPT_MODE, nonce)
                    .doFinal(mapper.writeValueAsBytes(new Delivery(recipient, message)));
            return ByteBuffer.allocate(nonce.length + encrypted.length).put(nonce).put(encrypted).array();
        } catch (Exception e) {
            throw new IllegalStateException("Cannot encrypt account mail");
        }
    }

    public Delivery decrypt(byte[] payload) {
        try {
            var buffer = ByteBuffer.wrap(payload);
            byte[] nonce = new byte[12];
            buffer.get(nonce);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            return mapper.readValue(cipher(Cipher.DECRYPT_MODE, nonce).doFinal(encrypted), Delivery.class);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot decrypt account mail");
        }
    }

    private Cipher cipher(int mode, byte[] nonce) throws Exception {
        var digest = MessageDigest.getInstance("SHA-256");
        digest.update(CONTEXT);
        byte[] key = digest.digest(settings.secret().getBytes(StandardCharsets.UTF_8));
        var cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        cipher.updateAAD(CONTEXT);
        return cipher;
    }
}

