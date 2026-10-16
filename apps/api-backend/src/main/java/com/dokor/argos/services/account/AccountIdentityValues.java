package com.dokor.argos.services.account;

import jakarta.mail.internet.InternetAddress;
import java.util.Locale;

/** Shared identity values for local sign-in, OAuth and profile edits. */
public final class AccountIdentityValues {
    private AccountIdentityValues() {}

    public static String email(String input) {
        if (input == null
                || input.length() > 254
                || !input.equals(input.strip())
                || input.chars().anyMatch(c -> c < 33 || c > 126))
            throw new AccountError(400, "email_invalid");
        String normalized = input.toLowerCase(Locale.ROOT);
        try {
            var address = new InternetAddress(normalized, true);
            address.validate();
            if (!address.getAddress().equals(normalized) || !normalized.contains("@"))
                throw new Exception();
        } catch (Exception invalid) {
            throw new AccountError(400, "email_invalid");
        }
        return normalized;
    }

    public static String displayName(String name) {
        if (name == null
                || name.isBlank()
                || name.length() > 100
                || name.chars().anyMatch(Character::isISOControl))
            throw new AccountError(400, "name_invalid");
        return name.strip();
    }

}
