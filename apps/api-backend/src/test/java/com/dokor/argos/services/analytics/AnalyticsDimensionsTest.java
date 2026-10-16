package com.dokor.argos.services.analytics;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AnalyticsDimensionsTest {
    @Test
    void acceptsFixedDiagnosticRoutesInBothLanguages() {
        for (String route : new String[]{"/ressources/audit-wordpress", "/ressources/audit-shopify", "/ressources/pourquoi-mon-site-ne-convertit-pas"}) {
            for (String lang : new String[]{"fr", "en"}) {
                assertEquals(route, new AnalyticsDimensions(route, lang, "form").route());
            }
            assertThrows(IllegalArgumentException.class, () -> new AnalyticsDimensions(route + "?url=private", "fr", "form"));
        }
        assertThrows(IllegalArgumentException.class, () -> new AnalyticsDimensions("/report/private-token", "fr", "page"));
        assertThrows(IllegalArgumentException.class, () -> new AnalyticsDimensions("https://example.com/", "en", "form"));
    }
}
