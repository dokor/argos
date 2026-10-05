package com.dokor.argos.services.analysis.accessibility;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

import static com.dokor.argos.services.analysis.accessibility.AccessibilityEvidence.*;

/** Extracts evidence independently of LighthouseModuleAnalyzer's cross-category cap. */
public final class LighthouseAccessibilityNormalizer {
    public static final String VERSION = "lighthouse-accessibility-v1";
    public static final String MAPPING_VERSION = "wcag-2.2-partial-v1";
    public static final int MAX_FINDINGS = 50;
    private static final Set<String> MODES = Set.of("binary", "numeric", "metricSavings");
    private static final Map<String, Kind> KINDS = Map.of(
        "image-alt", Kind.IMAGE_ALTERNATIVE, "color-contrast", Kind.CONTRAST,
        "button-name", Kind.ACCESSIBLE_NAME, "label", Kind.ACCESSIBLE_NAME,
        "html-has-lang", Kind.LANGUAGE, "html-lang-valid", Kind.LANGUAGE);
    private static final Map<Kind, List<String>> WCAG = Map.of(
        Kind.IMAGE_ALTERNATIVE, List.of("1.1.1"), Kind.CONTRAST, List.of("1.4.3"),
        Kind.ACCESSIBLE_NAME, List.of("4.1.2"), Kind.LANGUAGE, List.of("3.1.1"));

    private LighthouseAccessibilityNormalizer() {}

    public static AccessibilityEvidence unavailable() {
        return new AccessibilityEvidence(VERSION, MAPPING_VERSION, null, Coverage.UNAVAILABLE,
            0, Map.of(), 0, 0, false, 0, false, List.of());
    }

    public static AccessibilityEvidence normalize(JsonNode lhr, boolean blocked) {
        if (blocked || lhr == null || !lhr.path("runtimeError").isMissingNode()
            && !lhr.path("runtimeError").isNull()) return unavailable();
        JsonNode refs = lhr.at("/categories/accessibility/auditRefs");
        if (!refs.isArray() || refs.isEmpty()) return unavailable();
        EnumMap<Status, Integer> counts = new EnumMap<>(Status.class);
        List<Finding> findings = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int failed = 0, elements = 0;
        boolean completeElements = true, malformed = false;
        for (JsonNode ref : refs) {
            String id = ref.path("id").asText("");
            if (!id.matches("[a-z0-9][a-z0-9-]{0,79}")) { malformed = true; continue; }
            if (!seen.add(id)) continue;
            JsonNode audit = lhr.path("audits").path(id);
            Status status = status(audit);
            counts.merge(status, 1, Integer::sum);
            if (status != Status.FAIL) continue;
            failed++;
            // Detail rows may overlap. Do not expose any row content, selectors or attributes.
            JsonNode items = audit.at("/details/items");
            Integer count = null;
            if ("table".equals(audit.at("/details/type").asText()) && items.isArray()) {
                int nodes = 0;
                for (JsonNode item : items) if (item.path("node").isObject()) nodes++;
                if (nodes == items.size()) count = nodes;
            }
            if (count == null) completeElements = false;
            else elements += count;
            Kind kind = KINDS.getOrDefault(id, Kind.OTHER);
            double score = audit.path("score").doubleValue();
            findings.add(new Finding("lighthouse.audit." + id, "lighthouse", kind,
                score < 0.5 ? Severity.HIGH : Severity.MEDIUM, score, count,
                WCAG.getOrDefault(kind, List.of())));
        }
        findings.sort(Comparator.comparing(Finding::score).thenComparing(Finding::id));
        boolean truncated = findings.size() > MAX_FINDINGS;
        List<Finding> surfaced = List.copyOf(findings.subList(0, Math.min(findings.size(), MAX_FINDINGS)));
        JsonNode catScore = lhr.at("/categories/accessibility/score");
        boolean partial = malformed || !catScore.isNumber()
            || counts.getOrDefault(Status.ERROR, 0) > 0 || counts.getOrDefault(Status.NOT_TESTED, 0) > 0;
        String sourceVersion = lhr.path("lighthouseVersion").asText("");
        if (!sourceVersion.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?")) sourceVersion = null;
        return new AccessibilityEvidence(VERSION, MAPPING_VERSION, sourceVersion,
            seen.isEmpty() ? Coverage.UNAVAILABLE : partial ? Coverage.PARTIAL : Coverage.COMPLETE,
            seen.size(), Map.copyOf(counts), failed, elements, completeElements,
            surfaced.size(), truncated, surfaced);
    }

    private static Status status(JsonNode audit) {
        if (!audit.isObject()) return Status.NOT_TESTED;
        String mode = audit.path("scoreDisplayMode").asText("");
        if ("manual".equals(mode)) return Status.MANUAL;
        if ("notApplicable".equals(mode)) return Status.NOT_APPLICABLE;
        if ("error".equals(mode) || audit.hasNonNull("errorMessage")) return Status.ERROR;
        JsonNode score = audit.path("score");
        if (!MODES.contains(mode) || !score.isNumber()
            || !Double.isFinite(score.doubleValue()) || score.doubleValue() < 0 || score.doubleValue() > 1)
            return Status.NOT_TESTED;
        return score.doubleValue() >= 0.9 ? Status.PASS : Status.FAIL;
    }
}
