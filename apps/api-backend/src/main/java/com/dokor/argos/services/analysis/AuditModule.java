package com.dokor.argos.services.analysis;

import java.util.List;

/**
 * The audit's modules in execution and report order. Progress labels and fallback
 * titles live here. Adding a constant also requires an explicit processor
 * switch branch, which the compiler checks.
 *
 * Execution remains explicit in AuditProcessorService: HTTP supplies the context,
 * Observatory and SSL overlap the local modules, and Tech alone has a domain cache.
 */
public enum AuditModule {
    HTTP("http", "HTTP & Sécurité", "HTTP"),
    HTML("html", "HTML & SEO", "HTML"),
    RUNTIME("runtime", "Runtime", "Runtime (Playwright)"),
    LIGHTHOUSE("lighthouse", "Lighthouse", "Lighthouse"),
    OBSERVATORY("observatory", "Observatory", "Observatory"),
    SSL("ssl", "SSL Labs", "SSL Labs"),
    ZAP("zap", "ZAP", "OWASP ZAP"),
    TECH("tech", "Stack", "Tech stack");

    private static final List<AuditModule> ORDERED = List.of(values());

    private final String id;
    private final String progressLabel;
    private final String fallbackTitle;

    AuditModule(String id, String progressLabel, String fallbackTitle) {
        this.id = id;
        this.progressLabel = progressLabel;
        this.fallbackTitle = fallbackTitle;
    }

    public String id() { return id; }
    public String progressLabel() { return progressLabel; }
    public String fallbackTitle() { return fallbackTitle; }
    public static List<AuditModule> ordered() { return ORDERED; }

    public static boolean containsId(String id) {
        return ORDERED.stream().anyMatch(module -> module.id.equals(id));
    }
}
