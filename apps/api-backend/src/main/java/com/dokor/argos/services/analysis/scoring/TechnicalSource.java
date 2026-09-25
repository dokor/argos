package com.dokor.argos.services.analysis.scoring;

import java.util.Arrays;

/** Provenance technique stable d'une règle de score. */
public enum TechnicalSource {
    HTTP("http"), HTML("html"), LIGHTHOUSE("lighthouse"), RUNTIME("runtime"),
    SSL("ssl"), OBSERVATORY("observatory"), ZAP("zap"), TECH("tech"), MISC("misc");

    private final String tag;

    TechnicalSource(String tag) {
        this.tag = tag;
    }

    public String tag() {
        return tag;
    }

    public static TechnicalSource fromTag(String value) {
        return Arrays.stream(values())
            .filter(source -> source.tag.equals(value))
            .findFirst()
            .orElse(MISC);
    }
}
