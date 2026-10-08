package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import org.slf4j.Logger;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import java.io.StringReader;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

/** Bounded collection and content recognition; resource bodies never enter report diagnostics. */
final class SeoResourceProbe {
    enum State { RECOGNIZED, ABSENT, INVALID, UNAVAILABLE }
    record Resource(State state, String url, int status, String reason, String body) {
        Boolean present() { return state == State.UNAVAILABLE ? null : state == State.RECOGNIZED; }
        Map<String, Object> diagnostics() {
            return Map.of("state", state.name(), "url", url, "status", status, "reason", reason);
        }
    }
    record Result(Resource robots, Resource sitemap, List<String> declarations, List<Resource> candidates) {
        boolean unavailable() { return robots.state() == State.UNAVAILABLE || sitemap.state() == State.UNAVAILABLE; }
    }
    private static final int MAX_REDIRECTS = 5;
    private static final int MAX_REQUESTS = 12;
    private static final int MAX_DECLARATIONS = 3;
    private static final String SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
    private final HttpClient client;
    private final Logger logger;
    private final AuditDeadline budget;
    private int requests;

    SeoResourceProbe(HttpClient client, Logger logger) {
        this.client = client;
        this.logger = logger;
        AuditDeadline parent = AuditDeadline.current();
        budget = parent == null ? new AuditDeadline(Duration.ofSeconds(20)) : parent.child(Duration.ofSeconds(20));
    }

    Result collect(String origin) {
        if (origin == null) {
            Resource invalid = unavailable("", 0, "INVALID_ORIGIN");
            return new Result(invalid, invalid, List.of(), List.of());
        }
        Resource robots = fetch(origin + "/robots.txt", false);
        List<String> declarations = robots.state() == State.RECOGNIZED ? sitemapDeclarations(robots.body()) : List.of();
        List<Resource> candidates = new ArrayList<>();
        Resource direct = fetch(origin + "/sitemap.xml", true);
        candidates.add(direct);
        Resource sitemap = direct;
        if (direct.state() != State.RECOGNIZED) {
            for (String declared : declarations.stream().distinct().limit(MAX_DECLARATIONS).toList()) {
                if (declared.equals(origin + "/sitemap.xml")) continue;
                Resource candidate = fetch(declared, true);
                candidates.add(candidate);
                if (candidate.state() == State.RECOGNIZED) { sitemap = candidate; break; }
            }
            if (sitemap.state() != State.RECOGNIZED) {
                sitemap = candidates.stream().filter(r -> r.state() == State.UNAVAILABLE).findFirst()
                    .orElseGet(() -> candidates.stream().filter(r -> r.state() == State.INVALID).findFirst().orElse(direct));
                // An unreadable robots file or uncollected declarations can hide another sitemap.
                if (sitemap.state() != State.UNAVAILABLE && (robots.state() == State.UNAVAILABLE
                    || declarations.stream().distinct().count() > MAX_DECLARATIONS)) {
                    sitemap = new Resource(State.UNAVAILABLE, direct.url(), direct.status(),
                        "SITEMAP_DISCOVERY_INCOMPLETE", null);
                }
            }
        }
        return new Result(robots, sitemap, List.copyOf(declarations), List.copyOf(candidates));
    }

    private Resource fetch(String initialUrl, boolean sitemap) {
        String url = initialUrl;
        Set<String> visited = new HashSet<>();
        int status = 0;
        try {
            for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
                status = 0; // A previous redirect status does not describe an unrequested target.
                if (!visited.add(url)) return unavailable(url, status, "REDIRECT_LOOP");
                try { UrlNormalizer.validatePublicUrl(url); }
                catch (IllegalArgumentException blocked) { return unavailable(url, status, "TARGET_BLOCKED"); }
                if (requests >= MAX_REQUESTS) return unavailable(url, status, "REQUEST_BUDGET_EXHAUSTED");
                HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(budget.remaining(Duration.ofSeconds(10)))
                    .header("User-Agent", "argos-auditor/1.0").header("Accept", "*/*").GET().build();
                requests++;
                HttpResponse<String> response = client.send(request,
                    BoundedBodyHandlers.ofString(BoundedBodyHandlers.MAX_PAGE_BYTES));
                status = response.statusCode();
                if (Set.of(301, 302, 303, 307, 308).contains(status)) {
                    String location = response.headers().firstValue("location").orElse("");
                    if (location.isBlank()) return unavailable(url, status, "MISSING_LOCATION");
                    if (redirects == MAX_REDIRECTS) return unavailable(url, status, "REDIRECT_LIMIT");
                    url = URI.create(url).resolve(location).normalize().toString();
                    continue;
                }
                if (status == 404 || status == 410) return new Resource(State.ABSENT, url, status, "HTTP_" + status, null);
                if (status != 200) return unavailable(url, status, "HTTP_" + status);
                String body = response.body();
                String type = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
                boolean recognized = !type.contains("html") && (sitemap ? validSitemap(body) : validRobots(body, type));
                return new Resource(recognized ? State.RECOGNIZED : State.INVALID, url, status,
                    recognized ? "CONTENT_RECOGNIZED" : "UNEXPECTED_CONTENT", recognized && !sitemap ? body : null);
            }
            return unavailable(url, status, "REDIRECT_LIMIT");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return unavailable(url, status, "INTERRUPTED");
        } catch (HttpTimeoutException | AuditDeadline.DeadlineExceeded timeout) {
            return unavailable(url, status, "TIMEOUT");
        } catch (Exception failed) {
            logger.debug("SEO probe failed url={} error={}", UrlNormalizer.sanitizeForLog(url), failed.getClass().getSimpleName());
            return unavailable(url, status, "COLLECTION_FAILED");
        }
    }

    private static Resource unavailable(String url, int status, String reason) {
        return new Resource(State.UNAVAILABLE, url, status, reason, null);
    }

    private static boolean validRobots(String body, String type) {
        if (body == null || body.indexOf('<') >= 0) return false;
        if (!type.isEmpty() && !type.startsWith("text/plain")) return false;
        // Empty files and comment-only files are valid; arbitrary error text is not a robots policy.
        List<String> lines = body.lines().map(line -> {
            String text = line.replace("\uFEFF", "").split("#", 2)[0].trim();
            return text;
        }).filter(text -> !text.isEmpty()).toList();
        return lines.isEmpty() || lines.stream().anyMatch(text ->
            text.matches("(?i)(user-agent|allow|disallow|sitemap)\\s*:.*"));
    }

    private static List<String> sitemapDeclarations(String body) {
        return body.lines().map(line -> line.split("#", 2)[0].trim())
            .filter(line -> line.matches("(?i)sitemap\\s*:.*"))
            .map(line -> line.substring(line.indexOf(':') + 1).trim()).filter(s -> !s.isEmpty()).toList();
    }

    private static boolean validSitemap(String body) {
        if (body == null || body.isBlank()) return false;
        try {
            XMLInputFactory factory = XMLInputFactory.newFactory();
            factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
            factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
            factory.setXMLResolver((publicId, systemId, baseUri, namespace) -> { throw new javax.xml.stream.XMLStreamException("External XML resource disabled"); });
            var reader = factory.createXMLStreamReader(new StringReader(body));
            try {
                boolean rootSeen = false;
                while (reader.hasNext()) {
                    int event = reader.next();
                    if (event == XMLStreamConstants.DTD) return false;
                    if (event == XMLStreamConstants.START_ELEMENT && !rootSeen) {
                        if (!Set.of("urlset", "sitemapindex").contains(reader.getLocalName())
                            || !SITEMAP_NAMESPACE.equals(reader.getNamespaceURI())) return false;
                        rootSeen = true;
                    }
                }
                return rootSeen;
            } finally { reader.close(); }
        } catch (Exception invalid) { return false; }
    }
}
