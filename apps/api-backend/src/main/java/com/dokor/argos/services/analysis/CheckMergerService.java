package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import jakarta.inject.Singleton;
import com.dokor.argos.services.analysis.scoring.MeasurementAvailability;
import com.dokor.argos.services.analysis.scoring.MeasurementCoverageService;

import java.util.*;

/**
 * Fusionne les checks ayant la même key à travers plusieurs modules.
 * Le check "gagnant" vit dans le module propriétaire (OWNER_MAP).
 * Le doublon est retiré du module secondaire.
 * Les sources des deux checks sont fusionnées.
 */
@Singleton
public class CheckMergerService {

    /** Map key → moduleId propriétaire */
    private static final Map<String, String> OWNER_MAP = Map.of(
        "http.security.hsts", "http",
        "http.security.csp", "http",
        "http.security.x_content_type_options", "http",
        "http.security.x_frame_options", "http",
        "http.security.referrer_policy", "http",
        "http.security.permissions_policy", "http"
    );

    public List<AuditModuleResult> merge(List<AuditModuleResult> modules) {
        var moduleIndex = MeasurementAvailability.index(modules);
        boolean antiBot = MeasurementCoverageService.antiBot(modules);
        Map<String, List<ModuleCheck>> byKey = new TreeMap<>();
        for (var module : modules) for (var check : module.checks()) {
            byKey.computeIfAbsent(check.key(), ignored -> new ArrayList<>())
                .add(new ModuleCheck(module.id(), check));
        }
        Map<String, String> carriers = new HashMap<>();
        Map<String, AuditCheckResult> mergedChecks = new HashMap<>();
        for (var entry : byKey.entrySet()) {
            String key = entry.getKey();
            var occurrences = entry.getValue();
            String owner = OWNER_MAP.get(key);
            // Excluded or unknown observations cannot contaminate an independent valid measurement.
            var measured = occurrences.stream().filter(mc -> MeasurementAvailability.resolve(
                moduleIndex.get(mc.moduleId()), mc.check(), moduleIndex, antiBot).measured()).toList();
            var candidates = new ArrayList<>(measured.isEmpty() ? occurrences : measured);
            candidates.sort(Comparator.comparingInt((ModuleCheck mc) -> statusRank(mc.check())).reversed()
                .thenComparing(mc -> !mc.moduleId().equals(owner)).thenComparing(ModuleCheck::moduleId));
            var selected = candidates.getFirst();
            var decision = MeasurementAvailability.resolve(moduleIndex.get(selected.moduleId()), selected.check(), moduleIndex, antiBot);
            // Keep the canonical carrier when present; otherwise retain the actual observation.
            String carrier = occurrences.stream().anyMatch(mc -> mc.moduleId().equals(owner)) ? owner : selected.moduleId();
            AuditCheckResult merged = selected.check();
            for (int i = 1; i < candidates.size(); i++) merged = merged.mergeWith(candidates.get(i).check());
            var sources = new TreeSet<String>();
            for (var mc : occurrences) { sources.add(mc.moduleId()); sources.addAll(mc.check().sources()); }
            var measurementSources = new TreeSet<String>();
            for (var mc : measured) measurementSources.addAll(MeasurementAvailability.resolve(
                moduleIndex.get(mc.moduleId()), mc.check(), moduleIndex, antiBot).sources());
            merged = merged.withSources(List.copyOf(sources))
                .withMeasurementProvenance(decision.module(), List.copyOf(measurementSources));
            carriers.put(key, carrier);
            mergedChecks.put(key, merged);
        }
        List<AuditModuleResult> result = new ArrayList<>();
        for (var module : modules) {
            var checks = module.checks().stream().map(AuditCheckResult::key).distinct()
                .filter(key -> module.id().equals(carriers.get(key))).map(mergedChecks::get).toList();
            result.add(new AuditModuleResult(module.id(), module.title(), module.summary(), module.data(), checks));
        }
        return result;
    }

    private static int statusRank(AuditCheckResult check) {
        return switch (check.status()) { case INFO -> 0; case PASS -> 1; case WARN -> 2; case FAIL -> 3; };
    }

    private record ModuleCheck(String moduleId, AuditCheckResult check) {}
}
