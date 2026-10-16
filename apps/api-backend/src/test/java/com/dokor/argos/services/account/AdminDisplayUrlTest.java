package com.dokor.argos.services.account;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AdminDisplayUrlTest {
    @Test void keepsBusinessPathButDropsQueryAndFragment() {
        assertEquals("https://www.example.com/products/shoes", AdminDisplayUrl.project(
                "https://www.example.com/products/shoes?email=private&token=secret#credentials", "www.example.com"));
        assertEquals("https://example.com/…", AdminDisplayUrl.project("https://example.com/report/private-token", "example.com"));
        assertFalse(AdminDisplayUrl.project("https://example.com/reset/" + "a".repeat(43), "example.com").contains("a".repeat(43)));
    }
    @Test void hidesInternalOrAmbiguousTargetsRatherThanExposingRawData() {
        for (String url : new String[]{"http://127.0.0.1/private", "http://app.internal/private", "http://localhost/private",
                "https://user:secret@example.com/path", "https://example.com:8443/path", "javascript:secret", "https://other.com/path"})
            assertNull(AdminDisplayUrl.project(url, "example.com"));
        assertNull(AdminDisplayUrl.host("app.internal"));
    }
}
