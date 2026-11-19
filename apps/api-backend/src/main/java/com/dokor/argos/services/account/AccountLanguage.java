package com.dokor.argos.services.account;

import java.util.List;
import java.util.Locale;

/** Language allowlist shared by account notifications and public telemetry. */
public final class AccountLanguage {
    public static final List<String> SUPPORTED = List.of(
        "fr", "en", "de", "es", "it", "nl", "pt", "pl", "sv", "da", "fi",
        "cs", "sk", "hu", "ro", "bg", "el", "hr", "sl", "lt", "lv", "et");

    private AccountLanguage() {}

    public static String normalize(String header) {
        if (header == null || header.length() > 512) return "fr";
        try {
            return Locale.LanguageRange.parse(header).stream()
                .filter(range -> range.getWeight() > 0)
                .map(range -> range.getRange().split("-")[0])
                .filter(SUPPORTED::contains).findFirst().orElse("fr");
        } catch (IllegalArgumentException invalid) {
            return "fr";
        }
    }

    public static String prefix(String lang) {
        String normalized = normalize(lang);
        return normalized.equals("fr") ? "" : "/" + normalized;
    }
}
