package com.dokor.argos.services.analysis.scoring;

/** Domaines métier utilisés pour la normalisation et le score global. */
public enum ScoreDomain {
    PERFORMANCE("performance"),
    SECURITY("security"),
    SEO("seo"),
    A11Y("a11y");

    private final String id;

    ScoreDomain(String id) {
        this.id = id;
    }

    public String id() {
        return id;
    }
}
