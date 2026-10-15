package com.dokor.argos.services.connected.summary;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;

import java.nio.file.*;
import java.util.*;

/** Translate the versioned specification fixture into frozen engine evidence. */
public final class SummaryFixture {
    public static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    public static JsonNode fixture() throws Exception {
        return MAPPER.readTree(
                Path.of("../../docs/connected-space/fixtures/connected-space.json").toFile());
    }

    public record Evidence(ObjectNode report, ObjectNode score) {}

    public static Evidence evidence(JsonNode fixture, JsonNode page) {
        var report = MAPPER.createObjectNode();
        report.put("domain", "atelier-nova.fr");
        var scores = report.putObject("scores");
        scores.put("global", page.path("score").asInt());
        scores.put("globalAvailable", page.path("reportAvailable").asBoolean());
        scores.put("completeness", page.path("completeness").asText().equals("PARTIAL") ? 60 : 100);
        scores.putObject("calculation")
                .put("scoringVersion", 7)
                .put("scoringFingerprint", "fixture-v1");
        var coverage = scores.putObject("coverage");
        coverage.put("version", "weighted-coverage-v3");
        coverage.put("provisional", page.path("completeness").asText().equals("PARTIAL"));
        coverage.putObject("global")
                .put("expectedWeight", 4)
                .put("ratio", page.path("completeness").asText().equals("PARTIAL") ? 0.6 : 1.0)
                .put("available", true);
        var observations = coverage.putArray("checks");
        var issues = report.putArray("issues");
        var score =
                MAPPER.createObjectNode()
                        .put("scoringVersion", 7)
                        .put("scoringFingerprint", "fixture-v1");
        score.putObject("global").put("ratio", page.path("score").asDouble() / 100);
        var checks = score.putArray("checks");
        for (var rule : fixture.path("rules")) {
            String key = rule.path("ruleKey").asText(),
                    outcome = page.path("outcomes").path(key).asText("UNKNOWN"),
                    category = rule.path("category").asText(),
                    severity = rule.path("severity").asText();
            observations
                    .addObject()
                    .put("key", key)
                    .put("module", "html")
                    .put("domain", category)
                    .put("weight", 1)
                    .put("state", Set.of("PASS", "FAIL").contains(outcome) ? "MEASURED" : outcome)
                    .put("reason", outcome.equals("UNAVAILABLE") ? "TIMEOUT" : outcome);
            String status = outcome.equals("FAIL") && severity.equals("INFO") ? "WARN" : outcome;
            checks.addObject()
                    .put("key", key)
                    .put("moduleId", "html")
                    .put("scorable", true)
                    .put("weight", 1)
                    .put("status", status);
            if (outcome.equals("FAIL"))
                for (int i = 0; i < page.path("occurrences").path(key).asInt(1); i++)
                    issues.addObject()
                            .put("id", key)
                            .put("categoryKey", category)
                            .put("module", "html")
                            .put("severity", severity.toLowerCase(Locale.ROOT))
                            .put("title", key)
                            .put("impact", "Fixture impact")
                            .put("recommendation", "Fixture action")
                            .put("evidence", "Observed");
        }
        return new Evidence(report, score);
    }
}
