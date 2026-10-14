package com.dokor.argos.services.connected.summary;

import static org.junit.jupiter.api.Assertions.*;

import com.dokor.argos.db.dao.DomainSummaryDao.Row;
import com.dokor.argos.services.connected.batch.BatchState;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.databind.node.ObjectNode;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

class DomainSummaryProjectionTest {
    static final Instant NOW = Instant.parse("2026-10-13T10:00:00Z");

    List<Row> rows(com.fasterxml.jackson.databind.JsonNode fixture) throws Exception {
        var rows = new ArrayList<Row>();
        long id = 1;
        for (var p : fixture.path("domains").get(0).path("pages")) {
            boolean available = p.path("reportAvailable").asBoolean();
            var e = SummaryFixture.evidence(fixture, p);
            var d =
                    available
                            ? DiagnosticProjection.from(e.report(), e.score())
                            : DiagnosticProjection.unknown();
            rows.add(
                    new Row(
                            1,
                            new BatchState.Page(
                                    id,
                                    id,
                                    id,
                                    p.path("url").asText(),
                                    p.path("executionStatus").asText(),
                                    p.path("completeness").asText(),
                                    available ? "COUNTED" : "RELEASED",
                                    available,
                                    NOW,
                                    NOW,
                                    NOW),
                            available ? p.path("score").asLong() : null,
                            p.path("completeness").asText().equals("PARTIAL"),
                            d.criticalCount(),
                            d.importantCount(),
                            SummaryFixture.MAPPER.writeValueAsString(d),
                            "[]"));
            id++;
        }
        return rows;
    }

    List<DomainSummaryProjection.Page> pages(List<Row> rows) {
        return rows.stream()
                .map(r -> DomainSummaryProjection.page(r, SummaryFixture.MAPPER))
                .toList();
    }

    @Test void observedLocationsCountAsEvidenceWithoutChangingCounters() throws Exception {
        var fixture=SummaryFixture.fixture();
        var e=SummaryFixture.evidence(fixture,fixture.path("domains").get(0).path("pages").get(0));
        for(var issue:e.report().path("issues")) ((ObjectNode)issue).remove("evidence");
        var before=DiagnosticProjection.from(e.report(),e.score());
        var issue=(ObjectNode)e.report().path("issues").get(0);
        issue.putObject("structuredEvidence").putObject("observed")
            .put("version","observed-evidence-v1").put("source","lighthouse")
            .putArray("items").addObject().put("kind","element").put("nodePath","1,HTML,1,BODY,1,IMG");
        var after=DiagnosticProjection.from(e.report(),e.score());
        assertEquals(before.criticalCount(),after.criticalCount());
        assertTrue(after.rules().stream().filter(r->r.key().equals(issue.path("id").asText())).findFirst().orElseThrow().evidenceAvailable());
        assertTrue(before.rules().stream().noneMatch(DiagnosticProjection.Rule::evidenceAvailable));
    }

    @Test
    void atelierCountsDenominatorsDeduplicationAndPriority() throws Exception {
        var rows = rows(SummaryFixture.fixture());
        var pages = pages(rows);
        var state = BatchState.from(rows.stream().map(Row::state).toList(), 8, false, true, NOW);
        var counts = DomainSummaryProjection.counts(state, rows);
        assertEquals(new BatchCounts(8L, 6L, 1L, 1L, 0L, 0L, 5L, 0L), counts);
        var findings = DomainSummaryProjection.common(pages);
        assertEquals(
                List.of(6L, 4L, 3L), findings.stream().map(CommonFinding::affectedPages).toList());
        for (var f : findings) {
            assertEquals(7, f.evaluatedPages());
            assertEquals(8, f.selectedPages());
            assertEquals(1, f.notEvaluatedPages());
            assertEquals("ANALYSIS_FAILED", f.exclusions().getFirst().reason());
        }
        var sorted =
                pages.stream()
                        .map(DomainSummaryProjection.Page::result)
                        .sorted(DomainSummaryProjection.PRIORITY)
                        .toList();
        assertEquals("https://atelier-nova.fr/collections", sorted.getFirst().normalizedUrl());
        assertNull(sorted.getLast().score().value());
        assertNull(sorted.getLast().criticalCount());
        assertFalse(sorted.getLast().reportAvailable());
        assertEquals(
                2,
                pages.stream()
                        .map(DomainSummaryProjection.Page::result)
                        .filter(DomainSummaryProjection::incomplete)
                        .count());
        var f = findings.getFirst();
        var filter =
                new DomainSummaryProjection.Filter(
                        f.ruleKey(), f.definitionVersion(), "INFO", null, null, null, null, null);
        assertEquals(6, pages.stream().filter(filter::matches).count());
        assertEquals(2, pages.stream().filter(filter::matches).skip(4).limit(2).count());
        Collections.reverse(rows);
        assertEquals(findings, DomainSummaryProjection.common(pages(rows)));
    }

    @Test
    void unavailableAndIncompatibleRulesNeverBecomePass() throws Exception {
        var fixture = SummaryFixture.fixture();
        var page = fixture.path("domains").get(0).path("pages").get(0);
        ((ObjectNode) page.path("outcomes")).put("fixture.security.csp", "UNAVAILABLE");
        var findings = DomainSummaryProjection.common(pages(rows(fixture)));
        var csp =
                findings.stream()
                        .filter(f -> f.ruleKey().endsWith("csp"))
                        .findFirst()
                        .orElseThrow();
        assertEquals(5, csp.affectedPages());
        assertEquals(6, csp.evaluatedPages());
        assertTrue(csp.exclusions().stream().anyMatch(e -> e.reason().equals("TIMEOUT")));
        var e =
                SummaryFixture.evidence(
                        fixture, fixture.path("domains").get(0).path("pages").get(0));
        var original = DiagnosticProjection.from(e.report(), e.score());
        e.score().put("scoringFingerprint", "other");
        assertFalse(DiagnosticProjection.from(e.report(), e.score()).available());
        ((ObjectNode) e.report().path("scores").path("calculation"))
                .put("scoringFingerprint", "other");
        assertNotEquals(
                original.rules().getFirst().definitionVersion(),
                DiagnosticProjection.from(e.report(), e.score())
                        .rules()
                        .getFirst()
                        .definitionVersion());
        e.score().putArray("checks");
        var unknown = DiagnosticProjection.from(e.report(), e.score());
        assertFalse(unknown.available());
        assertNull(unknown.criticalCount());
    }

    @Test
    void metadataAbsenceRetentionAndStrictFilters() throws Exception {
        assertEquals(
                DiagnosticProjection.unknown(),
                DiagnosticProjection.from(
                        SummaryFixture.MAPPER.createObjectNode(),
                        SummaryFixture.MAPPER.createObjectNode()));
        var rows = rows(SummaryFixture.fixture());
        var r = rows.getFirst();
        var s = r.state();
        var expired =
                new Row(
                        1,
                        new BatchState.Page(
                                s.id(),
                                s.discoveryPageId(),
                                s.runId(),
                                s.url(),
                                s.status(),
                                s.completeness(),
                                s.credit(),
                                false,
                                NOW,
                                NOW,
                                NOW),
                        r.score(),
                        false,
                        r.critical(),
                        r.important(),
                        r.diagnostic(),
                        null);
        var p = DomainSummaryProjection.page(expired, SummaryFixture.MAPPER);
        assertNull(p.result().score().value());
        assertNull(p.result().importantCount());
        assertTrue(DomainSummaryProjection.incomplete(p.result()));
        assertTrue(p.diagnostic().rules().isEmpty());
        assertThrows(
                RuntimeException.class,
                () ->
                        new DomainSummaryProjection.Filter(
                                null, "a".repeat(64), null, null, null, null, null, null));
        assertThrows(
                RuntimeException.class,
                () ->
                        new DomainSummaryProjection.Filter(
                                null, null, "high", null, null, null, null, null));
    }

    @Test
    void incompatibleGroupsAmbiguityNonApplicableAndSafeLabels() throws Exception {
        var fixture = SummaryFixture.fixture();
        var rows = rows(fixture);
        var e =
                SummaryFixture.evidence(
                        fixture, fixture.path("domains").get(0).path("pages").get(0));
        ((ObjectNode) e.report().path("scores").path("calculation"))
                .put("scoringFingerprint", "other");
        e.score().put("scoringFingerprint", "other");
        var r = rows.getFirst();
        var changed = DiagnosticProjection.from(e.report(), e.score());
        rows.set(
                0,
                new Row(
                        r.batchId(),
                        r.state(),
                        r.score(),
                        r.provisional(),
                        r.critical(),
                        r.important(),
                        SummaryFixture.MAPPER.writeValueAsString(changed),
                        r.modules()));
        var csp =
                DomainSummaryProjection.common(pages(rows)).stream()
                        .filter(f -> f.ruleKey().endsWith("csp"))
                        .findFirst()
                        .orElseThrow();
        assertEquals(5, csp.affectedPages());
        assertEquals(6, csp.evaluatedPages());
        assertTrue(
                csp.exclusions().stream()
                        .anyMatch(x -> x.reason().equals("INCOMPATIBLE_DEFINITION")));
        var observations =
                (com.fasterxml.jackson.databind.node.ArrayNode)
                        e.report().path("scores").path("coverage").path("checks");
        var duplicate = observations.get(0).deepCopy();
        ((ObjectNode) duplicate).put("weight", 2);
        observations.add(duplicate);
        assertEquals(
                "UNKNOWN",
                DiagnosticProjection.from(e.report(), e.score()).rules().stream()
                        .filter(x -> x.key().endsWith("csp"))
                        .findFirst()
                        .orElseThrow()
                        .outcome());
        observations.remove(observations.size() - 1);
        ((ObjectNode) observations.get(0))
                .put("state", "NOT_APPLICABLE")
                .put("reason", "NOT_APPLICABLE");
        assertEquals(
                "NOT_APPLICABLE",
                DiagnosticProjection.from(e.report(), e.score()).rules().stream()
                        .filter(x -> x.key().endsWith("csp"))
                        .findFirst()
                        .orElseThrow()
                        .outcome());
        for (var issue : e.report().path("issues"))
            ((ObjectNode) issue)
                    .put("recommendation", "See https://example.com/?token=synthetic-secret");
        assertFalse(
                SummaryFixture.MAPPER
                        .writeValueAsString(DiagnosticProjection.from(e.report(), e.score()))
                        .contains("synthetic-secret"));
    }

    @Test
    void emptyStructuredEvidenceIsNotAdvertisedAsProof() throws Exception {
        var fixture = SummaryFixture.fixture();
        var e =
                SummaryFixture.evidence(
                        fixture, fixture.path("domains").get(0).path("pages").get(0));
        for (var issue : e.report().path("issues")) {
            ((ObjectNode) issue).put("evidence", "").putObject("structuredEvidence");
        }
        assertTrue(
                DiagnosticProjection.from(e.report(), e.score()).rules().stream()
                        .noneMatch(DiagnosticProjection.Rule::evidenceAvailable));
        ((ObjectNode) e.report().path("issues").get(0).path("structuredEvidence"))
                .putObject("measurement")
                .put("value", 0);
        assertTrue(
                DiagnosticProjection.from(e.report(), e.score()).rules().stream()
                        .anyMatch(DiagnosticProjection.Rule::evidenceAvailable));
    }
}
