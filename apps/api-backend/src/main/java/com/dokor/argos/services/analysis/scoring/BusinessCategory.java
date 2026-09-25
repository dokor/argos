package com.dokor.argos.services.analysis.scoring;

import java.util.Arrays;
import java.util.Optional;

/** Domaine métier stable, distinct de la provenance technique d'un check. */
public enum BusinessCategory {
    PERFORMANCE("performance"),
    SECURITY("security"),
    SEO("seo"),
    A11Y("a11y"),
    NONE("");

    private final String tag;

    BusinessCategory(String tag) {
        this.tag = tag;
    }

    public String tag() {
        return tag;
    }

    public static Optional<BusinessCategory> fromTag(String value) {
        return Arrays.stream(values())
            .filter(category -> !category.tag.isBlank())
            .filter(category -> category.tag.equals(value))
            .findFirst();
    }
}
