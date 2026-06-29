package com.dokor.argos.services.domain.audit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitaires de {@link UrlNormalizer}.
 * <p>
 * Chaque groupe couvre une règle de normalisation distincte.
 */
class UrlNormalizerTest {

    private final UrlNormalizer normalizer = new UrlNormalizer();

    // -------------------------
    // Schéma manquant
    // -------------------------

    @Test
    void shouldAddHttpsWhenNoSchemePresent() {
        assertEquals("https://example.com", normalizer.normalize("example.com"));
    }

    @Test
    void shouldPreserveExplicitHttp() {
        assertEquals("http://example.com", normalizer.normalize("http://example.com"));
    }

    @Test
    void shouldPreserveExplicitHttps() {
        assertEquals("https://example.com", normalizer.normalize("https://example.com"));
    }

    // -------------------------
    // Host en minuscules
    // -------------------------

    @Test
    void shouldLowercaseHost() {
        assertEquals("https://example.com", normalizer.normalize("HTTPS://EXAMPLE.COM"));
    }

    @Test
    void shouldLowercaseMixedCaseHost() {
        assertEquals("https://example.com/path", normalizer.normalize("https://EXAMPLE.COM/path"));
    }

    // -------------------------
    // Suppression du slash racine
    // -------------------------

    @Test
    void shouldRemoveTrailingRootSlash() {
        assertEquals("https://example.com", normalizer.normalize("https://example.com/"));
    }

    @Test
    void shouldPreserveNonRootPath() {
        assertEquals("https://example.com/blog/", normalizer.normalize("https://example.com/blog/"));
    }

    @Test
    void shouldPreservePathWithoutTrailingSlash() {
        assertEquals("https://example.com/about", normalizer.normalize("https://example.com/about"));
    }

    // -------------------------
    // Suppression des ports par défaut
    // -------------------------

    @Test
    void shouldRemoveDefaultHttpsPort443() {
        assertEquals("https://example.com", normalizer.normalize("https://example.com:443"));
    }

    @Test
    void shouldRemoveDefaultHttpPort80() {
        assertEquals("http://example.com", normalizer.normalize("http://example.com:80"));
    }

    @Test
    void shouldPreserveNonDefaultPort() {
        assertEquals("https://example.com:8080", normalizer.normalize("https://example.com:8080"));
    }

    @Test
    void shouldPreserveNonDefaultHttpPort() {
        assertEquals("http://example.com:8080", normalizer.normalize("http://example.com:8080"));
    }

    // -------------------------
    // Suppression du fragment
    // -------------------------

    @Test
    void shouldRemoveFragment() {
        assertEquals("https://example.com/page", normalizer.normalize("https://example.com/page#section"));
    }

    @Test
    void shouldRemoveFragmentFromRootUrl() {
        assertEquals("https://example.com", normalizer.normalize("https://example.com/#top"));
    }

    // -------------------------
    // Query string conservée
    // -------------------------

    @Test
    void shouldPreserveQueryString() {
        assertEquals("https://example.com/search?q=test", normalizer.normalize("https://example.com/search?q=test"));
    }

    @Test
    void shouldPreserveQueryStringAndRemoveFragment() {
        assertEquals("https://example.com/search?q=test", normalizer.normalize("https://example.com/search?q=test#anchor"));
    }

    // -------------------------
    // Combinaisons
    // -------------------------

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
        "example.com,                  https://example.com",
        "example.com/,                 https://example.com",
        "HTTPS://EXAMPLE.COM/,         https://example.com",
        "https://example.com:443/,     https://example.com",
        "http://example.com:80/path,   http://example.com/path",
        "https://example.com/blog#top, https://example.com/blog",
    })
    void shouldNormalizeCorrectly(String input, String expected) {
        assertEquals(expected.strip(), normalizer.normalize(input.strip()));
    }

    // -------------------------
    // Cas invalides
    // -------------------------

    @Test
    void shouldThrowOnNullInput() {
        assertThrows(IllegalArgumentException.class, () -> normalizer.normalize(null));
    }

    @Test
    void shouldThrowOnBlankInput() {
        assertThrows(IllegalArgumentException.class, () -> normalizer.normalize("   "));
    }

    // -------------------------
    // extractHostname
    // -------------------------

    @Test
    void shouldExtractHostname() {
        assertEquals("example.com", normalizer.extractHostname("https://example.com/path?q=1"));
    }
}
