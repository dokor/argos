package com.dokor.argos.services.connected.discovery;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Bounded REP parser: merged exact product groups, fallback *, longest rule, Allow wins ties. */
public final class DiscoveryRobots {
    private record Rule(String pattern, boolean allow) {}

    private static final class Group {
        boolean records;
        final List<String> agents = new ArrayList<>();
        final List<Rule> rules = new ArrayList<>();
    }

    private final List<Rule> rules;
    public final List<String> sitemaps;

    private DiscoveryRobots(List<Rule> rules, List<String> sitemaps) {
        this.rules = rules;
        this.sitemaps = List.copyOf(sitemaps);
    }

    public static DiscoveryRobots allowAll() {
        return new DiscoveryRobots(List.of(), List.of());
    }

    public static DiscoveryRobots parse(String body, int maxRules, int maxSitemaps) {
        var groups = new ArrayList<Group>();
        var maps = new ArrayList<String>();
        Group group = new Group();
        groups.add(group);
        int lines = 0, ruleCount = 0;
        for (var iterator =
                        new java.io.BufferedReader(new java.io.StringReader(body))
                                .lines()
                                .iterator();
                iterator.hasNext(); ) {
            String line = iterator.next();
            if (++lines > maxRules * 4) throw new DiscoveryStop("ROBOTS_LIMIT");
            line = line.split("#", 2)[0].trim();
            int colon = line.indexOf(':');
            if (colon < 0) continue;
            String key = line.substring(0, colon).trim().toLowerCase(Locale.ROOT),
                    value = line.substring(colon + 1).trim();
            if (key.equals("sitemap")) {
                if (maps.size() >= maxSitemaps) throw new DiscoveryStop("SITEMAP_LIMIT");
                if (value.length() <= 2048) maps.add(value);
                continue;
            }
            if (key.equals("user-agent")) {
                if (group.records) {
                    group = new Group();
                    groups.add(group);
                }
                group.agents.add(value.toLowerCase(Locale.ROOT));
            } else if ((key.equals("allow") || key.equals("disallow")) && !group.agents.isEmpty()) {
                group.records = true;
                if (value.isEmpty() || !value.startsWith("/")) continue;
                if (++ruleCount > maxRules || value.length() > 2048)
                    throw new DiscoveryStop("ROBOTS_LIMIT");
                group.rules.add(new Rule(octets(value), key.equals("allow")));
            }
        }
        boolean specific = groups.stream().anyMatch(g -> g.agents.contains("argosdiscovery"));
        var selected = new ArrayList<Rule>();
        for (var g : groups)
            if (g.agents.contains(specific ? "argosdiscovery" : "*")) selected.addAll(g.rules);
        return new DiscoveryRobots(selected, maps);
    }

    public boolean allows(String url) {
        URI uri = URI.create(url);
        String path = uri.getRawPath();
        if (path == null || path.isEmpty()) path = "/";
        String target = octets(path + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery()));
        int longest = -1;
        boolean allowed = true;
        for (var rule : rules) {
            int size = rule.pattern.length();
            if (matches(rule.pattern, target)
                    && (size > longest || size == longest && rule.allow)) {
                longest = size;
                allowed = rule.allow;
            }
        }
        return allowed;
    }

    // Normalize percent-encoded unreserved octets; preserve reserved / and encode non-ASCII UTF-8.
    static String octets(String text) {
        var out = new StringBuilder();
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        for (int i = 0; i < bytes.length; i++) {
            int b = bytes[i] & 255;
            if (b == '%' && i + 2 < bytes.length) {
                int a = Character.digit((char) bytes[i + 1], 16),
                        c = Character.digit((char) bytes[i + 2], 16);
                if (a >= 0 && c >= 0) {
                    int value = a * 16 + c;
                    if (value >= 65 && value <= 90
                            || value >= 97 && value <= 122
                            || value >= 48 && value <= 57
                            || "-._~".indexOf(value) >= 0) out.append((char) value);
                    else out.append(String.format("%%%02X", value));
                    i += 2;
                    continue;
                }
            }
            if (b >= 128) out.append(String.format("%%%02X", b));
            else out.append((char) b);
        }
        return out.toString();
    }

    // Greedy wildcard matching; bounded backtracking, no regular-expression denial of service.
    static boolean matches(String pattern, String text) {
        boolean end = pattern.endsWith("$");
        if (end) pattern = pattern.substring(0, pattern.length() - 1);
        else pattern += "*";
        int p = 0, t = 0, star = -1, mark = 0;
        while (t < text.length()) {
            if (p < pattern.length() && pattern.charAt(p) == text.charAt(t)) {
                p++;
                t++;
            } else if (p < pattern.length() && pattern.charAt(p) == '*') {
                star = p++;
                mark = t;
            } else if (star >= 0) {
                p = star + 1;
                t = ++mark;
            } else return false;
        }
        while (p < pattern.length() && pattern.charAt(p) == '*') p++;
        return p == pattern.length();
    }
}
