package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import jakarta.inject.Singleton;

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
        // 1. Build index: key → list of (moduleId, check) pairs
        Map<String, List<ModuleCheck>> byKey = new LinkedHashMap<>();
        for (AuditModuleResult module : modules) {
            for (AuditCheckResult check : module.checks()) {
                byKey.computeIfAbsent(check.key(), k -> new ArrayList<>())
                    .add(new ModuleCheck(module.id(), check));
            }
        }

        // 2. Find duplicates (keys that appear in more than one module)
        // For each duplicate: merge into owner module, remove from secondary modules
        // Build a map: moduleId → set of keys to remove
        Map<String, Set<String>> keysToRemove = new HashMap<>();
        // Build a map: (moduleId, key) → merged check to replace
        Map<String, Map<String, AuditCheckResult>> replacements = new HashMap<>();

        for (Map.Entry<String, List<ModuleCheck>> entry : byKey.entrySet()) {
            String key = entry.getKey();
            List<ModuleCheck> occurrences = entry.getValue();
            if (occurrences.size() <= 1) continue;

            // Determine owner
            String ownerModuleId = OWNER_MAP.getOrDefault(key, occurrences.get(0).moduleId());

            // Merge all into one
            AuditCheckResult merged = null;
            for (ModuleCheck mc : occurrences) {
                if (merged == null) {
                    merged = mc.check();
                } else {
                    merged = merged.mergeWith(mc.check());
                }
            }

            // Put merged check in owner, remove from all others
            for (ModuleCheck mc : occurrences) {
                if (mc.moduleId().equals(ownerModuleId)) {
                    replacements.computeIfAbsent(mc.moduleId(), m -> new HashMap<>())
                        .put(key, merged);
                } else {
                    keysToRemove.computeIfAbsent(mc.moduleId(), m -> new HashSet<>())
                        .add(key);
                }
            }
        }

        // 3. Rebuild modules applying replacements and removals
        List<AuditModuleResult> result = new ArrayList<>();
        for (AuditModuleResult module : modules) {
            Set<String> toRemove = keysToRemove.getOrDefault(module.id(), Set.of());
            Map<String, AuditCheckResult> toReplace = replacements.getOrDefault(module.id(), Map.of());

            if (toRemove.isEmpty() && toReplace.isEmpty()) {
                result.add(module);
                continue;
            }

            List<AuditCheckResult> newChecks = new ArrayList<>();
            for (AuditCheckResult check : module.checks()) {
                if (toRemove.contains(check.key())) {
                    // Drop duplicate from secondary module
                    continue;
                }
                AuditCheckResult replacement = toReplace.get(check.key());
                newChecks.add(replacement != null ? replacement : check);
            }

            result.add(new AuditModuleResult(
                module.id(),
                module.title(),
                module.summary(),
                module.data(),
                newChecks
            ));
        }

        return result;
    }

    private record ModuleCheck(String moduleId, AuditCheckResult check) {}
}
