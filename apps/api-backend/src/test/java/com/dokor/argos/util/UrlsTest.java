package com.dokor.argos.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class UrlsTest {
    @ParameterizedTest
    @CsvSource(value = {
        "https://example.com:8443/a?q=1|example.com",
        "http://user:pass@Example.COM:80/path|Example.COM",
        "https://[2001:db8::1]:8443/a|[2001:db8::1]",
        "https://127.0.0.1:8080/|127.0.0.1",
        "//example.com/path|example.com",
        "relative/path|",
        "mailto:user@example.com|",
        "https://example.com:bad/|",
        "https://exa mple.com/|",
        "''|",
        "'  '|"
    }, delimiter = '|')
    void preservesUriHostContract(String url, String expected) {
        assertEquals(expected, Urls.host(url));
    }

    @Test
    void reportFallbackAppliesOnlyToInvalidUris() {
        assertNull(Urls.host(null));
        assertNull(Urls.host(null, null));
        assertEquals("bad url", Urls.host("bad url", "bad url"));
        assertNull(Urls.host("relative/path", "relative/path"));
        assertNull(Urls.host("", ""));
        assertEquals("  ", Urls.host("  ", "  "));
        assertNull(Urls.host("https://example.com:bad/", "fallback"));
    }
}
