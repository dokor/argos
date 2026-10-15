package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class RemoteScanPolicyTest {
    @Test void disabledPolicyDoesNotResolveOrSubmitAnything() {
        var error = assertThrows(CollectorFailure.class,
            () -> RemoteScanPolicy.requireAllowed("example.com", false, url -> fail("DNS must not run")));
        assertEquals(CollectorFailure.Code.POLICY_DISABLED, CollectorFailure.classify(error));
    }

    @ParameterizedTest
    @ValueSource(strings = {"127.0.0.1", "8.8.8.8", "[::1]", "example.com:443", "example.com:80",
        "example.com:", "https://example.com", "user@example.com", "example.com/path", "example.com?x=1",
        "example.com#secret", "example.com.", "example.com\\path", "example.com\n", "example.com%2f",
        "localhost", "2130706433", "0x7f000001", " example.com", "-a.example.com", "example..com", "exämple.com"})
    void rejectsProviderGrammarAmbiguityBeforeDns(String host) {
        assertThrows(IllegalArgumentException.class,
            () -> RemoteScanPolicy.requireAllowed(host, true, url -> fail("DNS must not run")));
    }

    @Test void boundsHostLengthAndRejectsNull() {
        assertThrows(IllegalArgumentException.class, () -> RemoteScanPolicy.requireAllowed(null, true));
        assertThrows(IllegalArgumentException.class, () -> RemoteScanPolicy.requireAllowed("a".repeat(254), true));
    }

    @Test void canonicalizesAndRechecksPublicDnsOnEveryAdmission() {
        List<String> checked = new ArrayList<>();
        assertEquals("example.com", RemoteScanPolicy.requireAllowed("EXAMPLE.COM", true, checked::add));
        assertEquals("example.com", RemoteScanPolicy.requireAllowed("example.com", true, checked::add));
        assertEquals(List.of("https://example.com", "https://example.com"), checked);
    }

    @Test void neverSwallowsPublicDnsValidationFailure() {
        assertThrows(IllegalArgumentException.class, () -> RemoteScanPolicy.requireAllowed("example.com", true,
            url -> { throw new IllegalArgumentException("Target is not public"); }));
    }

    @ParameterizedTest
    @ValueSource(strings = {"service.local", "service.internal", "service.localhost", "service.test", "service.onion"})
    void sharedPolicyRejectsReservedNames(String host) {
        assertThrows(IllegalArgumentException.class, () -> RemoteScanPolicy.requireAllowed(host, true));
    }
}
