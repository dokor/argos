package com.dokor.argos.services.analysis.modules.runtime;

import com.dokor.argos.services.analysis.AuditModule;
import com.dokor.argos.services.analysis.ModuleUnavailableException;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.util.*;

@Singleton
public class RuntimeModuleAnalyzer {

    // Seuils des erreurs console. Relevés (vs 2 auparavant) car les scripts tiers
    // légitimes (analytics, régies pub, widgets, extensions) émettent couramment
    // quelques erreurs console indépendantes de la qualité du site : un seuil bas
    // produisait des faux positifs FAIL. Cf. issue #100 - point "runtime.console.errors".
    // 0 => PASS ; 1..WARN_MAX => WARN ; > WARN_MAX => FAIL.
    static final int CONSOLE_ERRORS_WARN_MAX = 10;

    private final PlaywrightRuntimeClient client;

    @Inject
    public RuntimeModuleAnalyzer(PlaywrightRuntimeClient client) {
        this.client = client;
    }

    public String moduleId() {
        return AuditModule.RUNTIME.id();
    }

    public AuditModuleResult analyze(AuditContext auditContext, Logger logger) {
        long start = System.currentTimeMillis();

        String url = auditContext.finalUrl() != null ? auditContext.finalUrl() : auditContext.normalizedUrl();

        PlaywrightRuntimeClient.RuntimeAnalyzeResponse r;
        try {
            r = client.analyzeRuntime(url);
        } catch (Exception e) {
            throw new ModuleUnavailableException("Playwright service unavailable", e);
        }

        if (r == null || !r.hasMeasurements()) {
            throw new ModuleUnavailableException("Runtime response has no usable measurements");
        }

        long durationMs = System.currentTimeMillis() - start;

        // -------- checks --------
        // Distinction première partie / tiers (issue #153) : on ne pénalise que les
        // erreurs du site lui-même. Si le service ne fournit pas la distinction
        // (errorsFirstParty == null), on retombe sur le total (comportement historique).
        Integer fpObj = r.console() != null ? r.console().errorsFirstParty() : null;
        Integer consoleTotal = r.console() != null ? r.console().errors() : null;
        Integer consoleFirstParty = firstPartyOrLegacy(fpObj, consoleTotal);
        Integer consoleThirdParty = thirdPartyOrDerived(null, consoleTotal, consoleFirstParty);
        int firstPartyErrors = safeInt(consoleFirstParty);
        int thirdPartyErrors = safeInt(consoleThirdParty);
        int jsErrors = safeInt(r.jsErrors() != null ? r.jsErrors().count() : null);
        Integer failedTotal = r.network() != null ? r.network().failedRequests() : null;
        Integer serverTotal = r.network() != null ? r.network().status5xx() : null;
        Integer failedFirstParty = firstPartyOrLegacy(r.network() != null ? r.network().failedRequestsFirstParty() : null, failedTotal);
        Integer failedThirdParty = thirdPartyOrDerived(r.network() != null ? r.network().failedRequestsThirdParty() : null, failedTotal, failedFirstParty);
        Integer serverFirstParty = firstPartyOrLegacy(r.network() != null ? r.network().status5xxFirstParty() : null, serverTotal);
        Integer serverThirdParty = thirdPartyOrDerived(r.network() != null ? r.network().status5xxThirdParty() : null, serverTotal, serverFirstParty);
        int firstPartyFailedReq = safeInt(failedFirstParty);
        int thirdPartyFailedReq = safeInt(failedThirdParty);
        int firstParty5xx = safeInt(serverFirstParty);
        int thirdParty5xx = safeInt(serverThirdParty);
        int reqCount = safeInt(r.network() != null ? r.network().requests() : null);
        long bytes = safeLong(r.network() != null ? r.network().totalBytesEstimated() : null);

        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Console errors — statut fondé sur les erreurs de première partie (celles
        //    que le propriétaire du site peut corriger), pas sur le bruit des scripts tiers.
        String consoleMsg;
        if (firstPartyErrors == 0) {
            consoleMsg = consoleThirdParty == null ? "Aucune erreur console de votre site détectée ; total tiers inconnu." : thirdPartyErrors == 0
                ? "Aucune erreur console détectée."
                : "Aucune erreur console de votre site (" + thirdPartyErrors + " erreur(s) tierce(s) ignorée(s)).";
        } else {
            consoleMsg = firstPartyErrors + " erreur(s) console sur votre site"
                + (thirdPartyErrors > 0 ? " (+ " + thirdPartyErrors + " tierce(s), non comptée(s))" : "")
                + " détectée(s).";
        }
        Map<String, Object> consoleDetails = new LinkedHashMap<>();
        consoleDetails.put("firstParty", firstPartyErrors);
        consoleDetails.put("thirdParty", consoleThirdParty);
        if (sampleConsole(r, "error") != null) consoleDetails.put("samples", sampleConsole(r, "error"));
        checks.add(AuditCheckResult.of(
            "runtime.console.errors",
            "Erreurs console",
            firstPartyErrors == 0 ? AuditStatus.PASS : (firstPartyErrors <= CONSOLE_ERRORS_WARN_MAX ? AuditStatus.WARN : AuditStatus.FAIL),
            firstPartyErrors == 0 ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of("runtime"),
            firstPartyErrors,
            consoleDetails,
            consoleMsg,
            firstPartyErrors == 0 ? null : "Corrigez les erreurs JavaScript de votre site (impact sur l'UX, le tracking, la conversion)."
        ));

        // 2) JS page errors
        checks.add(AuditCheckResult.of(
            "runtime.js.errors",
            "Uncaught JS errors (pageerror)",
            jsErrors == 0 ? AuditStatus.PASS : AuditStatus.WARN,
            jsErrors == 0 ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of("runtime"),
            jsErrors,
            sampleJsErrors(r) != null ? Map.of("samples", sampleJsErrors(r)) : Map.of(),
            jsErrors == 0 ? "Aucune erreur JS non catch détectée." : (jsErrors + " erreur(s) JS non catch détectée(s)."),
            jsErrors == 0 ? null : "Identifier la source et corriger (souvent des scripts tiers ou erreurs de build)."
        ));

        // 3) HTTP 5xx
        checks.add(AuditCheckResult.of(
            "runtime.network.5xx",
            "HTTP 5xx responses",
            firstParty5xx == 0 ? AuditStatus.PASS : AuditStatus.FAIL,
            firstParty5xx == 0 ? AuditSeverity.LOW : AuditSeverity.HIGH,
            false, 0.0, List.of("runtime"),
            firstParty5xx,
            nullableMap("topLargest", r.network() != null ? r.network().topLargest() : null),
            firstParty5xx == 0 ? "Aucune réponse 5xx de votre site observée." : (firstParty5xx + " réponse(s) 5xx de votre site observée(s)."),
            firstParty5xx == 0 ? null : "Analyser les endpoints en erreur (logs serveur, timeouts, config CDN)."
        ));

        // 4) Request failures
        checks.add(AuditCheckResult.of(
            "runtime.network.failed_requests",
            "Failed network requests",
            firstPartyFailedReq == 0 ? AuditStatus.PASS : AuditStatus.WARN,
            firstPartyFailedReq == 0 ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of("runtime"),
            firstPartyFailedReq,
            Map.of(),
            firstPartyFailedReq == 0 ? "Aucune requête réseau de votre site en échec." : (firstPartyFailedReq + " requête(s) réseau de votre site en échec."),
            firstPartyFailedReq == 0 ? null : "Vérifier les ressources bloquées (CORS, DNS, timeouts, adblock, mixed content)."
        ));

        // Les incidents tiers sont utiles au diagnostic, mais ne doivent jamais
        // modifier la note du site. Le poids zéro est explicite dans la policy.
        int thirdPartyNetworkErrors = thirdPartyFailedReq + thirdParty5xx;
        checks.add(AuditCheckResult.of(
            "runtime.network.third_party_errors",
            "Third-party network incidents",
            thirdPartyNetworkErrors == 0 ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            false, 0.0, List.of("runtime"),
            thirdPartyNetworkErrors,
            Map.of("failedRequests", thirdPartyFailedReq, "status5xx", thirdParty5xx),
            thirdPartyNetworkErrors == 0
                ? "Aucun incident réseau tiers observé."
                : thirdPartyNetworkErrors + " incident(s) réseau tiers observé(s), non compté(s) dans votre score.",
            thirdPartyNetworkErrors == 0 ? null : "Aucune action requise sur votre site ; vous pouvez vérifier le fournisseur tiers concerné."
        ));

        // 5) Request count — PASS/WARN keeps the scored denominator constant (#327).
        checks.add(AuditCheckResult.of(
            "runtime.network.request_count",
            "Network request count",
            reqCount <= 120 ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            false, 0.0, List.of("runtime"),
            reqCount,
            nullableMap("byType", r.network() != null ? r.network().byType() : null),
            "Nombre de requêtes observées : " + reqCount,
            reqCount <= 120 ? null : "Réduire scripts tiers, images, bundling, lazy-loading, cache."
        ));

        // 6) Total bytes
        checks.add(AuditCheckResult.of(
            "runtime.network.bytes_estimated",
            "Transferred bytes (estimated)",
            bytes <= 3_000_000 ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            false, 0.0, List.of("runtime"),
            bytes,
            nullableMap("topLargest", r.network() != null ? r.network().topLargest() : null),
            "Transfert estimé : ~" + humanBytes(bytes),
            bytes <= 3_000_000 ? null : "Optimiser poids page (images, fonts, scripts), compression, cache."
        ));

        // 7) Duration
        checks.add(AuditCheckResult.of(
            "runtime.analysis.duration_ms",
            "Runtime analysis duration",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false, 0.0, List.of("runtime"),
            durationMs,
            Map.of("durationMs", durationMs),
            "Runtime analysis completed in " + durationMs + " ms.",
            null
        ));

        // Missing sections are not evidence of zero errors or zero requests.
        checks.removeIf(c -> switch (c.key()) {
            case "runtime.console.errors" -> consoleFirstParty == null;
            case "runtime.js.errors" -> r.jsErrors() == null || r.jsErrors().count() == null;
            case "runtime.network.5xx" -> serverFirstParty == null;
            case "runtime.network.failed_requests" -> failedFirstParty == null;
            case "runtime.network.request_count" -> r.network() == null || r.network().requests() == null;
            case "runtime.network.bytes_estimated" -> r.network() == null || r.network().totalBytesEstimated() == null;
            case "runtime.network.third_party_errors" -> failedThirdParty == null || serverThirdParty == null;
            default -> false;
        });
        // -------- data payload (stocké dans report_json) --------
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("available", true);
        boolean timingsPartial = r.timings() == null || r.timings().domContentLoadedMs() == null || r.timings().loadMs() == null;
        String navigationStatus = r.navigation() != null && r.navigation().status() != null ? r.navigation().status() : "UNKNOWN";
        data.put("navigation", nullableMap("status", navigationStatus,
            "reason", r.navigation() != null ? r.navigation().reason() : "LEGACY_RESPONSE"));
        data.put("partial", timingsPartial || (r.navigation() != null && !"COMPLETED".equals(navigationStatus))
            || r.console() == null || consoleTotal == null || r.console().warnings() == null
            || r.jsErrors() == null || r.jsErrors().count() == null
            || r.network() == null || failedTotal == null || serverTotal == null
            || r.network().requests() == null || r.network().totalBytesEstimated() == null
            || r.network().status4xx() == null || r.network().byType() == null);
        data.put("url", r.url());
        data.put("finalUrl", r.finalUrl());
        Map<String, Object> timings = new LinkedHashMap<>();
        timings.put("domContentLoadedMs", r.timings() != null ? r.timings().domContentLoadedMs() : null);
        timings.put("loadMs", r.timings() != null ? r.timings().loadMs() : null);
        data.put("timings", timings);
        data.put("console", r.console() == null ? null : nullableMap(
            "errors", consoleTotal, "errorsFirstParty", consoleFirstParty, "errorsThirdParty", consoleThirdParty,
            "warnings", r.console().warnings(), "samples", r.console().samples()));
        data.put("jsErrors", r.jsErrors() == null ? null : nullableMap(
            "count", r.jsErrors().count(), "samples", r.jsErrors().samples()));
        data.put("network", r.network() == null ? null : nullableMap(
            "requests", r.network().requests(), "failedRequests", failedTotal,
            "failedRequestsFirstParty", failedFirstParty, "failedRequestsThirdParty", failedThirdParty,
            "status4xx", r.network().status4xx(), "status5xx", serverTotal,
            "status5xxFirstParty", serverFirstParty, "status5xxThirdParty", serverThirdParty,
            "totalBytesEstimated", r.network().totalBytesEstimated(), "byType", r.network().byType(),
            "topLargest", r.network().topLargest()));

        String summary = "consoleErrors=" + consoleTotal
            + " jsErrors=" + (r.jsErrors() != null ? r.jsErrors().count() : null)
            + " req=" + (r.network() != null ? r.network().requests() : null)
            + " bytes=" + (r.network() != null ? r.network().totalBytesEstimated() : null)
            + " 5xx=" + serverFirstParty + "/" + serverTotal
            + " navigation=" + navigationStatus + " partial=" + data.get("partial");

        logger.info("RUNTIME module done: {}", summary);

        return new AuditModuleResult(
            moduleId(),
            "Runtime behavior",
            summary,
            data,
            checks
        );
    }

    private static int safeInt(Integer v) { return v == null ? 0 : v; }
    private static long safeLong(Long v) { return v == null ? 0L : v; }

    private static Map<String, Object> nullableMap(Object... entries) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) map.put((String) entries[i], entries[i + 1]);
        return map;
    }

    private static Integer firstPartyOrLegacy(Integer firstParty, Integer total) {
        if (firstParty == null) return total;
        return total == null ? Math.max(0, firstParty) : Math.min(total, Math.max(0, firstParty));
    }

    private static Integer thirdPartyOrDerived(Integer thirdParty, Integer total, Integer firstParty) {
        if (total == null || firstParty == null) return thirdParty;
        if (thirdParty == null) return Math.max(0, total - firstParty);
        return Math.min(Math.max(0, total - firstParty), Math.max(0, thirdParty));
    }

    private static List<Map<String, String>> sampleConsole(PlaywrightRuntimeClient.RuntimeAnalyzeResponse r, String type) {
        if (r.console() == null || r.console().samples() == null) return null;
        return r.console().samples().stream()
            .filter(Objects::nonNull)
            .filter(s -> type.equalsIgnoreCase(s.type()))
            .limit(5)
            .map(s -> sampleFields("type", s.type(), "text", s.text(), "location", s.location()))
            .toList();
    }

    private static List<Map<String, String>> sampleJsErrors(PlaywrightRuntimeClient.RuntimeAnalyzeResponse r) {
        if (r.jsErrors() == null || r.jsErrors().samples() == null) return null;
        return r.jsErrors().samples().stream()
            .limit(5)
            .filter(Objects::nonNull)
            .map(s -> sampleFields("message", s.message()))
            .toList();
    }

    private static Map<String, String> sampleFields(String... fields) {
        Map<String, String> sample = new LinkedHashMap<>();
        for (int i = 0; i < fields.length; i += 2) if (fields[i + 1] != null) sample.put(fields[i], fields[i + 1]);
        return sample;
    }

    private static String humanBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        double kb = bytes / 1024.0;
        if (kb < 1024) return String.format(Locale.ROOT, "%.1f KB", kb);
        double mb = kb / 1024.0;
        if (mb < 1024) return String.format(Locale.ROOT, "%.1f MB", mb);
        double gb = mb / 1024.0;
        return String.format(Locale.ROOT, "%.2f GB", gb);
    }
}
