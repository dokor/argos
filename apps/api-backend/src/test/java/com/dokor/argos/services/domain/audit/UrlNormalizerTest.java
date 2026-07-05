package com.dokor.argos.services.domain.audit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetAddress;

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

    // -------------------------
    // Protection SSRF (#217)
    // -------------------------

    @ParameterizedTest
    @ValueSource(strings = {
        "http://localhost",
        "http://foo.local",
        "http://svc.internal",
        "http://127.0.0.1",
        "http://127.0.0.5:8080",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://172.31.255.255",
        "http://192.168.1.1",
        "http://169.254.169.254",     // métadonnées cloud (link-local)
        "http://0.0.0.0",
        "http://[::1]",               // loopback IPv6
        "http://[::ffff:127.0.0.1]",  // IPv4-mapped loopback → résolu et bloqué
    })
    void shouldRejectSsrfTargets(String url) {
        assertThrows(IllegalArgumentException.class, () -> normalizer.normalize(url));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "http://localhost/admin",
        "http://127.0.0.1/latest/meta-data/",
        "http://169.254.169.254/",
        "http://[::1]/",
    })
    void validatePublicUrl_shouldRejectPrivateTargets(String url) {
        assertThrows(IllegalArgumentException.class, () -> UrlNormalizer.validatePublicUrl(url));
    }

    @Test
    void validatePublicUrl_shouldAcceptPublicIpLiteral() {
        // 8.8.8.8 : IP publique littérale, résolue localement, non bloquée.
        assertDoesNotThrow(() -> UrlNormalizer.validatePublicUrl("http://8.8.8.8/path"));
    }

    @Test
    void validatePublicUrl_shouldRejectMalformedOrHostless() {
        assertThrows(IllegalArgumentException.class, () -> UrlNormalizer.validatePublicUrl("http://"));
        assertThrows(IllegalArgumentException.class, () -> UrlNormalizer.validatePublicUrl(":::not a url"));
    }

    // isBlockedAddress : classification des IP résolues (cœur anti-SSRF)

    @ParameterizedTest
    @ValueSource(strings = {
        "127.0.0.1",          // loopback
        "10.1.2.3",           // RFC-1918
        "172.16.5.6",         // RFC-1918
        "192.168.0.1",        // RFC-1918
        "169.254.169.254",    // link-local / métadonnées
        "100.64.0.1",         // CGNAT (RFC-6598)
        "100.127.255.254",    // CGNAT (borne haute)
    })
    void isBlockedAddress_shouldFlagPrivateAndReserved(String ip) throws Exception {
        assertTrue(UrlNormalizer.isBlockedAddress(InetAddress.getByName(ip)), ip);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "8.8.8.8",            // public
        "1.1.1.1",            // public
        "100.63.255.255",     // juste sous la plage CGNAT
        "100.128.0.1",        // juste au-dessus de la plage CGNAT
    })
    void isBlockedAddress_shouldAllowPublic(String ip) throws Exception {
        assertFalse(UrlNormalizer.isBlockedAddress(InetAddress.getByName(ip)), ip);
    }
}
