package com.dokor.argos.services.analysis;

import java.util.List;
import java.util.Map;

public record UrlAuditResult(
    String inputUrl,
    String finalUrl,
    int statusCode,
    List<String> redirectChain,
    long timingMs,
    Map<String, String> headers,
    HtmlInfo html,
    List<String> errors
) {
    public record HtmlInfo(
        String title,
        String metaDescription,
        List<String> h1
    ) {
    }
}
