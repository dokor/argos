package com.dokor.argos.services.account;

import de.mkammerer.argon2.*;

import jakarta.inject.*;

import java.util.Arrays;

@Singleton
public class AccountPasswords {
    private final AccountSettings settings;
    private final String dummy;

    @Inject
    public AccountPasswords(AccountSettings settings) {
        this.settings = settings;
        dummy = hash("synthetic timing password, never an account");
    }

    public void validate(String password) {
        if (password == null
                || password.codePointCount(0, password.length()) < 15
                || password.codePointCount(0, password.length()) > 128)
            throw new AccountError(400, "password_policy");
    }

    public String hash(String password) {
        validate(password);
        var argon = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id);
        char[] chars = password.toCharArray();
        try {
            return argon.hash(
                    Math.max(2, settings.integer("argon.iterations", 2)),
                    Math.max(19456, settings.integer("argon.memory-kib", 19456)),
                    settings.integer("argon.parallelism", 1),
                    chars);
        } finally {
            Arrays.fill(chars, '\0');
        }
    }

    public boolean verify(String hash, String password) {
        if (password == null || password.length() > 512) return false;
        var argon = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id);
        char[] chars = password.toCharArray();
        try {
            boolean valid = argon.verify(hash == null ? dummy : hash, chars);
            return hash != null && valid;
        } catch (RuntimeException invalid) {
            return false;
        } finally {
            Arrays.fill(chars, '\0');
        }
    }
}
