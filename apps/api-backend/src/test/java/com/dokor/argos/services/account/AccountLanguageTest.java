package com.dokor.argos.services.account;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;

class AccountLanguageTest {
    @Test void acceptsTheSame22LanguagesAndRegionalHeaders() {
        assertEquals(22, AccountLanguage.SUPPORTED.size());
        for (String lang : AccountLanguage.SUPPORTED) assertEquals(lang, AccountLanguage.normalize(lang));
        assertEquals("de", AccountLanguage.normalize("de-AT,de;q=0.9,en;q=0.2"));
        assertEquals("pl", AccountLanguage.normalize("zz,pl;q=0.8,en;q=0.2"));
        assertEquals("en", AccountLanguage.normalize("de;q=0,en;q=1"));
        assertEquals("fr", AccountLanguage.normalize(null));
        assertEquals("fr", AccountLanguage.normalize("../../secret"));
        assertEquals("fr", AccountLanguage.normalize("de;q=bogus"));
    }

    @Test void localizesExactDurationsWithoutEnglishPluralRules() {
        assertEquals("1 Std 30 Min", AccountEmail.duration(Duration.ofMinutes(90), "de"));
        assertEquals("1 ч 30 мин", AccountEmail.duration(Duration.ofMinutes(90), "bg"));
        assertEquals("1 s 500 ms", AccountEmail.duration(Duration.ofMillis(1500), "es"));
        assertThrows(IllegalArgumentException.class, () -> AccountEmail.duration(Duration.ZERO, "de"));
    }
}
