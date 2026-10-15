package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class AccountMailLanguageTest {
    @Test
    void linksUseOnlyTheSupportedLanguageAndFixedAuthPaths() {
        assertEquals("/en/account/verify", AccountAuthService.emailPath("VERIFY", "en"));
        assertEquals("/en/account/reset", AccountAuthService.emailPath("RESET", "en"));
        for (String language : new String[] {null, "fr", "de", "//external.example", "en/../"}) {
            assertEquals("/account/verify", AccountAuthService.emailPath("VERIFY", language));
            assertEquals("/account/reset", AccountAuthService.emailPath("RESET", language));
        }
        assertEquals("/account", AccountAuthService.emailPath("REAUTH", "fr"));
    }
}
