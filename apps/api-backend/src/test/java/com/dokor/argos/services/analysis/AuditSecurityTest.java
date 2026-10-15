package com.dokor.argos.services.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class AuditSecurityTest {
    @Test void egressConfigurationNeverFallsBackToDirect() {
        URI target = URI.create("https://example.com");
        assertThrows(IllegalStateException.class, () -> new AuditEgress(null).select(target));
        assertThrows(IllegalStateException.class, () -> new AuditEgress("https://localhost:3128").select(target));
        assertThrows(IllegalStateException.class, () -> new AuditEgress("http://u:p@localhost:3128").select(target));
        var proxies = new AuditEgress("http://127.0.0.1:3128").select(target);
        assertEquals(1, proxies.size()); assertEquals(Proxy.Type.HTTP, proxies.getFirst().type());
    }
    @Test void externalScanPolicyRefusesBeforeAnyTransport() {
        assertThrows(IllegalStateException.class, () -> RemoteScanPolicy.requireAllowed("example.com", false));
        for (String host : new String[]{"127.0.0.1", "localhost", "169.254.169.254", "foo/bar", "u@example.com"})
            assertThrows(IllegalArgumentException.class, () -> RemoteScanPolicy.requireAllowed(host, true));
    }
    @Test void serializedDiagnosticsRemoveSnapshotsCredentialsPathsAndQueryTokens() throws Exception {
        var mapper = new ObjectMapper();
        var tree = AuditOutputSanitizer.tree(Map.of("url", "https://u:p@example.com/reset/private?token=hidden#frag",
            "headers", Map.of("set-cookie", "session=secret"), "body", "<script>secret</script>",
            "nested", Map.of("authorization", "Bearer private", "value", "token=hidden Bearer private nonce-secret"),
            "count", 3), mapper);
        String output = mapper.writeValueAsString(tree);
        assertTrue(output.contains("https://example.com")); assertEquals(3, tree.get("count").intValue());
        for (String sensitive : new String[]{"private", "hidden", "secret", "set-cookie", "<script>", "reset"})
            assertFalse(output.contains(sensitive), sensitive);
        assertEquals(4000, AuditOutputSanitizer.text("a".repeat(10000)).length());
    }
}
