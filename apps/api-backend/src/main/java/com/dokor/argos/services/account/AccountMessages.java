package com.dokor.argos.services.account;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Packaged translations only; rendering mail never calls a translation service. */
final class AccountMessages {
    private static final Map<String, Map<String, String>> CATALOGUES = new ConcurrentHashMap<>();
    private AccountMessages() {}

    static String copy(String lang, String english, String french) {
        if (lang.equals("fr")) return french;
        if (lang.equals("en")) return english;
        String translated = CATALOGUES.computeIfAbsent(lang, AccountMessages::load).get(english.trim());
        if (translated == null || translated.isBlank()) throw new IllegalStateException("Missing account translation: " + lang);
        return english.replace(english.trim(), translated);
    }

    private static Map<String, String> load(String lang) {
        if (!AccountLanguage.SUPPORTED.contains(lang)) throw new IllegalArgumentException("Unsupported language");
        try (var stream = AccountMessages.class.getResourceAsStream("/i18n/account/" + lang + ".json")) {
            if (stream == null) throw new IllegalStateException("Missing account catalogue: " + lang);
            return Map.copyOf(new ObjectMapper().readValue(stream, new TypeReference<Map<String, String>>() {}));
        } catch (IOException invalid) {
            throw new IllegalStateException("Invalid account catalogue: " + lang, invalid);
        }
    }
}
