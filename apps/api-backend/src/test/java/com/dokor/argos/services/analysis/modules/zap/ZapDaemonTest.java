package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.services.analysis.model.AuditContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises the real image in CI, including HAR parsing and the passive scan queue. */
@EnabledIfEnvironmentVariable(named = "ZAP_TEST_URL", matches = ".+")
class ZapDaemonTest {
    @Test void findsSnapshotIssuesAndDoesNotReusePreviousAlerts() throws Exception {
        var client = new ZapClient(new ObjectMapper(), System.getenv("ZAP_TEST_URL"), "",
            Duration.ofSeconds(45), Duration.ofMillis(250));
        String target = "https://snapshot.invalid/page";
        var context = new AuditContext(target, target, 1);
        var missing = context.withHttpResult(target, 200, 10, List.of(),
            Map.of("content-type", "text/html"), "<!doctype html><html><head><title>Snapshot</title></head><body>Hello</body></html>");
        JsonNode first = client.analyze(missing);
        assertTrue(hasPlugin(first, "10021"), "The imported response must actually be passively scanned");

        var fixed = context.withHttpResult(target, 200, 10, List.of(),
            Map.of("content-type", "text/html", "x-content-type-options", "nosniff"), missing.body());
        JsonNode second = client.analyze(fixed);
        assertFalse(hasPlugin(second, "10021"), "A fresh session must not return stale alerts for the same URL");
    }

    private static boolean hasPlugin(JsonNode result, String id) {
        for (var alert : result.path("alerts")) if (id.equals(alert.path("pluginId").asText())) return true;
        return false;
    }
}
