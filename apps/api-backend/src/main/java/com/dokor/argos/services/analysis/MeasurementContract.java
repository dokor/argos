package com.dokor.argos.services.analysis;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.scoring.MeasurementCoverage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Bump when collector semantics/configuration change; independent of scoring weights. */
public final class MeasurementContract {
    public static final String VERSION = "analysis-measurements-v7";
    private static final String PREFIX = "measurement-v2:";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> LOCAL = Set.of("http", "html", "tech");
    private static final Set<String> REMOTE = Set.of("runtime", "lighthouse", "ssl", "observatory", "zap");
    private MeasurementContract() {}

    public record Frozen(String fingerprint, String scopeFingerprint, Map<String, Object> evidence) {}

    /** Freeze this execution before cross-module merging loses producer provenance. */
    public static Frozen freeze(String profile, String requested, String destination, AuditScope scope,
                                List<AuditModuleResult> modules, MeasurementCoverage coverage,
                                Map<String, Object> configuration) {
        Map<String, Object> methods = new TreeMap<>();
        Map<String, Object> targets = new TreeMap<>();
        Set<String> missing = new TreeSet<>();
        String httpScope = scope(requested, destination, scope);
        if (httpScope == null) missing.add("http.scope");
        else targets.put("http", httpScope);
        Set<String> measured = new TreeSet<>();
        if (coverage == null || coverage.checks() == null) missing.add("coverage");
        else for (var check : coverage.checks()) {
            if (check.state() != MeasurementCoverage.State.MEASURED) continue;
            if (check.measurementSources() != null && !check.measurementSources().isEmpty())
                measured.addAll(check.measurementSources());
            else measured.add(check.measurementModule() == null ? check.module() : check.measurementModule());
        }
        for (String id : measured) {
            if (LOCAL.contains(id)) { methods.put(id, VERSION); continue; }
            if (!REMOTE.contains(id)) { missing.add(id + ".method"); continue; }
            var module = modules.stream().filter(m -> id.equals(m.id())).findFirst().orElse(null);
            var data = module == null || module.data() == null ? Map.of() : module.data();
            Object method = data.get("collectorMethodFingerprint");
            if (method instanceof String value && validDigest(value)) methods.put(id, value);
            else missing.add(id + ".method");
            if (id.equals("runtime") || id.equals("lighthouse")) {
                Object target = data.get("collectorScopeFingerprint");
                if (target instanceof String value && validDigest(value)) targets.put(id, value);
                else missing.add(id + ".scope");
            }
        }
        Map<String, Object> evidence = new TreeMap<>();
        if (MeasurementImplementation.FINGERPRINT == null) missing.add("backend.implementation");
        else evidence.put("implementation", MeasurementImplementation.FINGERPRINT);
        evidence.put("version", "measurement-evidence-v2");
        evidence.put("contract", VERSION);
        evidence.put("profile", profile == null ? "default" : profile);
        evidence.put("configuration", configuration);
        evidence.put("collectors", methods);
        evidence.put("missing", List.copyOf(missing));
        return new Frozen(missing.isEmpty() ? PREFIX + hash(evidence) : null,
            httpScope == null ? null : hash(targets), Collections.unmodifiableMap(evidence));
    }

    /** Object insertion order is not part of the measurement method. */
    public static String hash(Object evidence) {
        return digest(canonical(MAPPER.valueToTree(evidence)).toString());
    }
    private static JsonNode canonical(JsonNode value) {
        if (value.isObject()) {
            var sorted = MAPPER.createObjectNode();
            var keys = new TreeSet<String>(); value.fieldNames().forEachRemaining(keys::add);
            keys.forEach(key -> sorted.set(key, canonical(value.get(key))));
            return sorted;
        }
        if (value.isArray()) {
            var array = MAPPER.createArrayNode(); value.forEach(item -> array.add(canonical(item))); return array;
        }
        return value;
    }
    public static boolean completeFingerprint(String value) {
        return value != null && value.startsWith(PREFIX) && validDigest(value.substring(PREFIX.length()));
    }
    public static boolean validDigest(String value) { return value != null && value.matches("[a-f0-9]{64}"); }

    /** A versionless response remains readable but cannot prove a stable upstream method. */
    public static String upstream(JsonNode result, String... requiredFields) {
        Map<String, Object> evidence = new TreeMap<>();
        for (String field : requiredFields) {
            JsonNode value = result.path(field);
            if (!(value.isTextual() && !value.asText().isBlank()) && !value.isNumber()) return null;
            evidence.put(field, value);
        }
        return hash(evidence);
    }
    public static String fingerprint(String profileSnapshot) {
        return digest(VERSION + "\n" + (profileSnapshot == null ? "default" : profileSnapshot));
    }
    public static String scope(String requested, String destination) {
        return requested == null || requested.isBlank() || destination == null || destination.isBlank()
            ? null : digest(requested + "\n" + destination);
    }
    public static String scope(String requested, String destination, AuditScope scope) {
        if (!scope.partial()) return scope(requested,destination);
        return requested == null || requested.isBlank() || destination == null || destination.isBlank()
            ? null : digest(requested + "\n" + destination + "\n" + scope.kind() + "\n" + scope.target());
    }
    private static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
