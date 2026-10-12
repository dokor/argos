package com.dokor.argos.services.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.util.*;
import java.util.regex.*;

/** Last serialization boundary for untrusted diagnostics; raw snapshots stay in memory only. */
public final class AuditOutputSanitizer {
    private static final Set<String> SENSITIVE = Set.of("body", "headers", "set-cookie", "cookies",
        "authorization", "proxy-authorization", "password", "secret", "token", "apikey", "api_key", "samples");
    private static final Pattern URL = Pattern.compile("https?://[^\\s<>\\\"}\\]]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern CREDENTIAL = Pattern.compile("(?i)(bearer\\s+\\S+|(?:token|password|secret|api[_-]?key)\\s*[=:]\\s*[^\\s,;]+|nonce-[^'\\s;]+)");
    private AuditOutputSanitizer() {}
    public static JsonNode tree(Object value, ObjectMapper mapper) { return clean(mapper.valueToTree(value), 0); }
    private static JsonNode clean(JsonNode node, int depth) {
        if (depth > 30) return TextNode.valueOf("[truncated]");
        if (node.isObject()) {
            ObjectNode result = JsonNodeFactory.instance.objectNode();
            var fields = node.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                if (!SENSITIVE.contains(field.getKey().toLowerCase(Locale.ROOT)))
                    result.set(field.getKey(), "href".equals(field.getKey()) && trustedReference(field.getValue())
                        ? field.getValue() : clean(field.getValue(), depth + 1));
            }
            return result;
        }
        if (node.isArray()) {
            ArrayNode result = JsonNodeFactory.instance.arrayNode();
            for (JsonNode item : node) result.add(clean(item, depth + 1));
            return result;
        }
        if (node.isTextual()) return TextNode.valueOf(text(node.textValue()));
        return node;
    }
    private static boolean trustedReference(JsonNode value) {
        if (!value.isTextual()) return false;
        try {
            URI uri = URI.create(value.textValue());
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null && uri.getQuery() == null
                && Set.of("www.w3.org", "w3.org", "w3c.github.io", "www.legifrance.gouv.fr", "accessibilite.numerique.gouv.fr").contains(uri.getHost());
        } catch (Exception invalid) { return false; }
    }
    public static String text(String value) {
        String bounded = value.substring(0, Math.min(4000, value.length())).replaceAll("[\\p{Cntrl}\\u202a-\\u202e\\u2066-\\u2069]", " ");
        String urls = URL.matcher(bounded).replaceAll(match -> {
            try {
                URI uri = URI.create(match.group());
                if (uri.getHost() == null) return "[URL]";
                return Matcher.quoteReplacement(uri.getScheme() + "://" + uri.getHost());
            } catch (Exception invalid) { return "[URL]"; }
        });
        return CREDENTIAL.matcher(urls).replaceAll("[redacted]");
    }
}
