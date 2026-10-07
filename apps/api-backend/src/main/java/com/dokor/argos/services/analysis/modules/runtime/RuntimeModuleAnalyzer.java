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

        if (r == null || ((r.console() == null || r.console().errors() == null)
            && (r.jsErrors() == null || r.jsErrors().count() == null)
            && (r.network() == null || (r.network().failedRequests() == null
                && r.network().status5xx() == null && r.network().requests() == null)))) {
            throw new ModuleUnavailableException("Runtime response has no usable measurements");
        }

        long durationMs = System.currentTimeMillis() - start;

        // -------- checks --------
        int consoleErrors = safeInt(r.console() != null ? r.console().errors() : null);
        // Distinction première partie / tiers (issue #153) : on ne pénalise que les
        // erreurs du site lui-même. Si le service ne fournit pas la distinction
        // (errorsFirstParty == null), on retombe sur le total (comportement historique).
        Integer fpObj = r.console() != null ? r.console().errorsFirstParty() : null;
        int firstPartyErrors = fpObj != null ? fpObj : consoleErrors;
        int thirdPartyErrors = Math.max(0, consoleErrors - firstPartyErrors);
        int jsErrors = safeInt(r.jsErrors() != null ? r.jsErrors().count() : null);
        int failedReq = safeInt(r.network() != null ? r.network().failedRequests() : null);
        int s5xx = safeInt(r.network() != null ? r.network().status5xx() : null);
        int firstPartyFailedReq = firstPartyOrLegacy(
            r.network() != null ? r.network().failedRequestsFirstParty() : null, failedReq);
        int thirdPartyFailedReq = thirdPartyOrDerived(
            r.network() != null ? r.network().failedRequestsThirdParty() : null, failedReq, firstPartyFailedReq);
        int firstParty5xx = firstPartyOrLegacy(
            r.network() != null ? r.network().status5xxFirstParty() : null, s5xx);
        int thirdParty5xx = thirdPartyOrDerived(
            r.network() != null ? r.network().status5xxThirdParty() : null, s5xx, firstParty5xx);
        int reqCount = safeInt(r.network() != null ? r.network().requests() : null);
        long bytes = safeLong(r.network() != null ? r.network().totalBytesEstimated() : null);

        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Console errors — statut fondé sur les erreurs de première partie (celles
        //    que le propriétaire du site peut corriger), pas sur le bruit des scripts tiers.
        String consoleMsg;
        if (firstPartyErrors == 0) {
            consoleMsg = thirdPartyErrors == 0
                ? "Aucune erreur console détectée."
                : "Aucune erreur console de votre site (" + thirdPartyErrors + " erreur(s) tierce(s) ignorée(s)).";
        } else {
            consoleMsg = firstPartyErrors + " erreur(s) console sur votre site"
                + (thirdPartyErrors > 0 ? " (+ " + thirdPartyErrors + " tierce(s), non comptée(s))" : "")
                + " détectée(s).";
        }
        Map<String, Object> consoleDetails = new LinkedHashMap<>();
        consoleDetails.put("firstParty", firstPartyErrors);
        consoleDetails.put("thirdParty", thirdPartyErrors);
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
            safeList(r.network() != null ? r.network().topLargest() : null) != null ? Map.of("topLargest", safeList(r.network() != null ? r.network().topLargest() : null)) : Map.of(),
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

        // 5) Request count
        checks.add(AuditCheckResult.of(
            "runtime.network.request_count",
            "Network request count",
            reqCount <= 120 ? AuditStatus.INFO : AuditStatus.WARN,
            AuditSeverity.LOW,
            false, 0.0, List.of("runtime"),
            reqCount,
            Map.of("byType", r.network() != null ? r.network().byType() : Map.of()),
            "Nombre de requêtes observées : " + reqCount,
            reqCount <= 120 ? null : "Réduire scripts tiers, images, bundling, lazy-loading, cache."
        ));

        // 6) Total bytes
        checks.add(AuditCheckResult.of(
            "runtime.network.bytes_estimated",
            "Transferred bytes (estimated)",
            bytes <= 3_000_000 ? AuditStatus.INFO : AuditStatus.WARN,
            AuditSeverity.LOW,
            false, 0.0, List.of("runtime"),
            bytes,
            Map.of("topLargest", safeList(r.network() != null ? r.network().topLargest() : null)),
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
            case "runtime.console.errors" -> r.console() == null || r.console().errors() == null;
            case "runtime.js.errors" -> r.jsErrors() == null || r.jsErrors().count() == null;
            case "runtime.network.5xx" -> r.network() == null || r.network().status5xx() == null;
            case "runtime.network.failed_requests" -> r.network() == null || r.network().failedRequests() == null;
            case "runtime.network.request_count" -> r.network() == null || r.network().requests() == null;
            case "runtime.network.bytes_estimated" -> r.network() == null || r.network().totalBytesEstimated() == null;
            case "runtime.network.third_party_errors" -> r.network() == null
                || r.network().failedRequests() == null || r.network().status5xx() == null;
            default -> false;
        });
        // -------- data payload (stocké dans report_json) --------
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("available", true);
        data.put("partial", r.console() == null || r.console().errors() == null
            || r.jsErrors() == null || r.jsErrors().count() == null
            || r.network() == null || r.network().failedRequests() == null
            || r.network().status5xx() == null);
        data.put("url", r.url());
        data.put("finalUrl", r.finalUrl());
        Map<String, Object> timings = new LinkedHashMap<>();
        timings.put("domContentLoadedMs", r.timings() != null ? r.timings().domContentLoadedMs() : null);
        timings.put("loadMs", r.timings() != null ? r.timings().loadMs() : null);
        data.put("timings", timings);
        data.put("console", Map.of(
            "errors", consoleErrors,
            "errorsFirstParty", firstPartyErrors,
            "errorsThirdParty", thirdPartyErrors,
            "warnings", safeInt(r.console() != null ? r.console().warnings() : null),
            "samples", safeList(r.console() != null ? r.console().samples() : null)
        ));
        data.put("jsErrors", Map.of(
            "count", jsErrors,
            "samples", safeList(r.jsErrors() != null ? r.jsErrors().samples() : null)
        ));
        if (r.network() != null) {
            data.put("network", Map.ofEntries(
                Map.entry("requests", reqCount),
                Map.entry("failedRequests", failedReq),
                Map.entry("failedRequestsFirstParty", firstPartyFailedReq),
                Map.entry("failedRequestsThirdParty", thirdPartyFailedReq),
                Map.entry("status4xx", safeInt(r.network().status4xx())),
                Map.entry("status5xx", s5xx),
                Map.entry("status5xxFirstParty", firstParty5xx),
                Map.entry("status5xxThirdParty", thirdParty5xx),
                Map.entry("totalBytesEstimated", bytes),
                Map.entry("byType", r.network().byType() != null ? r.network().byType() : Map.of()),
                Map.entry("topLargest", safeList(r.network().topLargest()))
            ));
        }

        String summary = "consoleErrors=" + consoleErrors
            + " jsErrors=" + jsErrors
            + " req=" + reqCount
            + " bytes=~" + bytes
            + " 5xx=" + firstParty5xx + "/" + s5xx;

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
    private static List<?> safeList(Object v) { return v instanceof List<?> l ? l : List.of(); }

    private static int firstPartyOrLegacy(Integer firstParty, int total) {
        if (firstParty == null) return total;
        return Math.min(total, Math.max(0, firstParty));
    }

    private static int thirdPartyOrDerived(Integer thirdParty, int total, int firstParty) {
        if (thirdParty == null) return Math.max(0, total - firstParty);
        return Math.min(Math.max(0, total - firstParty), Math.max(0, thirdParty));
    }

    private static List<Map<String, String>> sampleConsole(PlaywrightRuntimeClient.RuntimeAnalyzeResponse r, String type) {
        if (r.console() == null || r.console().samples() == null) return List.of();
        return r.console().samples().stream()
            .filter(s -> type.equalsIgnoreCase(s.type()))
            .limit(5)
            .map(s -> Map.of(
                "type", s.type(),
                "text", s.text(),
                "location", s.location()
            ))
            .toList();
    }

    private static List<Map<String, String>> sampleJsErrors(PlaywrightRuntimeClient.RuntimeAnalyzeResponse r) {
        if (r.jsErrors() == null || r.jsErrors().samples() == null) return List.of();
        return r.jsErrors().samples().stream()
            .limit(5)
            .map(s -> Map.of("message", s.message()))
            .toList();
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
