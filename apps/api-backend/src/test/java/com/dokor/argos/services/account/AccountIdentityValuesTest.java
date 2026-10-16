package com.dokor.argos.services.account;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class AccountIdentityValuesTest {
    @Test void normalizesSharedIdentityWithoutChangingDisplayContent() {
        assertEquals("member@example.com", AccountIdentityValues.email("MEMBER@Example.COM"));
        assertEquals("Élodie  Martin", AccountIdentityValues.displayName("  Élodie  Martin  "));
    }

    @ParameterizedTest @NullSource
    @ValueSource(strings = {"", "member", " member@example.com", "member@example.com ",
        "member\n@example.com", "Mémber@example.com", "Name <member@example.com>", "a@example.com,b@example.com"})
    void rejectsInvalidEmailsWithExistingErrorContract(String email) {
        var error = assertThrows(AccountError.class, () -> AccountIdentityValues.email(email));
        assertEquals(400, error.getResponse().getStatus());
        assertEquals(Map.of("error", "email_invalid"), error.getResponse().getEntity());
    }

    @ParameterizedTest @NullSource
    @ValueSource(strings = {"", "   ", "A\nB", "A\u0000B"})
    void rejectsInvalidNamesWithExistingErrorContract(String name) {
        var error = assertThrows(AccountError.class, () -> AccountIdentityValues.displayName(name));
        assertEquals(400, error.getResponse().getStatus());
        assertEquals(Map.of("error", "name_invalid"), error.getResponse().getEntity());
    }

    @Test void boundsInputBeforeNormalization() {
        assertThrows(AccountError.class, () -> AccountIdentityValues.email("a".repeat(255)));
        assertEquals("a".repeat(100), AccountIdentityValues.displayName("a".repeat(100)));
        assertThrows(AccountError.class, () -> AccountIdentityValues.displayName("a".repeat(101)));
    }
}
