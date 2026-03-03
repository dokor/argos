package com.dokor.argos.services.analysis.modules.runtime;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.playwright.PlaywrightRuntimeClient;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.util.*;

@Singleton
public class RuntimeModuleAnalyzer implements AuditModuleAnalyzer {

    private final PlaywrightRuntimeClient client;

    @Inject
    public RuntimeModuleAnalyzer(PlaywrightRuntimeClient client) {
        this.client = client;
    }

    @Override
    public String moduleId() {
        return "runtime";
    }

    @Override
    public AuditModuleResult analyze(AuditContext auditContext, Logger logger) {
        long start = System.currentTimeMillis();

        String url = auditContext.finalUrl() != null ? auditContext.finalUrl() : auditContext.normalizedUrl();

        PlaywrightRuntimeClient.RuntimeAnalyzeResponse r;
        try {
            r = client.analyzeRuntime(url);
        } catch (Exception e) {
            // module "soft fail" : on ne casse pas tout l’audit
            List<AuditCheckResult> checks = List.of(new AuditCheckResult(
                "runtime.collect",
                "Runtime collection (Playwright)",
                AuditStatus.WARN,
                AuditSeverity.MEDIUM,
                false, 0.0, List.of("runtime"),
                false,
                Map.of("error", e.getMessage()),
                "Impossible de collecter les métriques runtime (Playwright).",
                "Vérifier que playwright-service est up et joignable depuis api-backend."
            ));

            return new AuditModuleResult(
                moduleId(),
                "Runtime behavior",
                "runtime=unavailable",
                Map.of("available", false, "error", e.getMessage()),
                checks
            );
        }

        long durationMs = System.currentTimeMillis() - start;

        // -------- checks --------
        int consoleErrors = safeInt(r.console() != null ? r.console().errors() : null);
        int jsErrors = safeInt(r.jsErrors() != null ? r.jsErrors().count() : null);
        int failedReq = safeInt(r.network() != null ? r.network().failedRequests() : null);
        int s5xx = safeInt(r.network() != null ? r.network().status5xx() : null);
        int reqCount = safeInt(r.network() != null ? r.network().requests() : null);
        long bytes = safeLong(r.network() != null ? r.network().totalBytesEstimated() : null);

        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Console errors
        checks.add(new AuditCheckResult(
            "runtime.console.errors",
            "Console errors",
            consoleErrors == 0 ? AuditStatus.PASS : (consoleErrors <= 2 ? AuditStatus.WARN : AuditStatus.FAIL),
            consoleErrors == 0 ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of("runtime"),
            consoleErrors,
            sampleConsole(r, "error") != null ? Map.of("samples", sampleConsole(r, "error")) : Map.of(),
            consoleErrors == 0 ? "Aucune erreur console détectée." : (consoleErrors + " erreur(s) console détectée(s)."),
            consoleErrors == 0 ? null : "Corriger les erreurs JS (impact sur UX, tracking, conversion)."
        ));

        // 2) JS page errors
        checks.add(new AuditCheckResult(
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
        checks.add(new AuditCheckResult(
            "runtime.network.5xx",
            "HTTP 5xx responses",
            s5xx == 0 ? AuditStatus.PASS : AuditStatus.FAIL,
            s5xx == 0 ? AuditSeverity.LOW : AuditSeverity.HIGH,
            false, 0.0, List.of("runtime"),
            s5xx,
            safeList(r.network() != null ? r.network().topLargest() : null) != null ? Map.of("topLargest", safeList(r.network() != null ? r.network().topLargest() : null)) : Map.of(),
            s5xx == 0 ? "Aucune réponse 5xx observée." : (s5xx + " réponse(s) 5xx observée(s)."),
            s5xx == 0 ? null : "Analyser les endpoints en erreur (logs serveur, timeouts, config CDN)."
        ));

        // 4) Request failures
        checks.add(new AuditCheckResult(
            "runtime.network.failed_requests",
            "Failed network requests",
            failedReq == 0 ? AuditStatus.PASS : AuditStatus.WARN,
            failedReq == 0 ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of("runtime"),
            failedReq,
            Map.of(),
            failedReq == 0 ? "Aucune requête réseau en échec." : (failedReq + " requête(s) réseau en échec."),
            failedReq == 0 ? null : "Vérifier les ressources bloquées (CORS, DNS, timeouts, adblock, mixed content)."
        ));

        // 5) Request count
        checks.add(new AuditCheckResult(
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
        checks.add(new AuditCheckResult(
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
        checks.add(new AuditCheckResult(
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

        // -------- data payload (stocké dans report_json) --------
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("available", true);
        data.put("url", r.url());
        data.put("finalUrl", r.finalUrl());
        data.put("timings", Map.of(
            "domContentLoadedMs", r.timings() != null ? r.timings().domContentLoadedMs() : null,
            "loadMs", r.timings() != null ? r.timings().loadMs() : null
        ));
        data.put("console", Map.of(
            "errors", consoleErrors,
            "warnings", safeInt(r.console() != null ? r.console().warnings() : null),
            "samples", safeList(r.console() != null ? r.console().samples() : null)
        ));
        data.put("jsErrors", Map.of(
            "count", jsErrors,
            "samples", safeList(r.jsErrors() != null ? r.jsErrors().samples() : null)
        ));
        if (r.network() != null) {
            data.put("network", Map.of(
                "requests", reqCount,
                "failedRequests", failedReq,
                "status4xx", safeInt(r.network().status4xx()),
                "status5xx", s5xx,
                "totalBytesEstimated", bytes,
                "byType", r.network().byType() != null ? r.network().byType() : Map.of(),
                "topLargest", safeList(r.network().topLargest())
            ));
        }

        String summary = "consoleErrors=" + consoleErrors
            + " jsErrors=" + jsErrors
            + " req=" + reqCount
            + " bytes=~" + bytes
            + " 5xx=" + s5xx;

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
