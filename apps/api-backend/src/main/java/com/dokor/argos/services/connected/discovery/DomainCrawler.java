package com.dokor.argos.services.connected.discovery;

import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.domain.audit.UrlNormalizer;

import jakarta.inject.*;

import org.jsoup.Jsoup;

import java.io.StringReader;
import java.net.URI;
import java.util.*;
import java.util.function.Consumer;

import javax.xml.stream.*;

/** Sequential bounded traversal. Multiple workers share the DB host/global semaphore. */
@Singleton
public final class DomainCrawler {
    public record Page(
            String url, DiscoverySource source, int depth, boolean eligible, String reason) {}

    public record Result(String reason, boolean truncated) {}

    private record Fetched(DiscoveryTransport.Response response, String url) {}

    private record Candidate(String url, DiscoverySource source, int depth) {}

    private final DiscoveryPolicy policy;
    private final DiscoveryTransport transport;

    @Inject
    public DomainCrawler(DiscoveryPolicy policy, DiscoveryTransport transport) {
        this.policy = policy;
        this.transport = transport;
    }

    public Result crawl(
            CreateDiscovery input,
            DiscoveryLimits limits,
            DiscoveryBudget budget,
            Consumer<Page> save) {
        return new Crawl(input, limits, budget, save).run();
    }

    private final class Crawl {
        final CreateDiscovery input;
        final DiscoveryLimits limits;
        final DiscoveryBudget budget;
        final Consumer<Page> save;
        final Deque<Candidate> pending = new ArrayDeque<>();
        final Set<String> known = new HashSet<>(),
                visited = new HashSet<>(),
                maps = new HashSet<>();
        final Deque<String> sitemapQueue = new ArrayDeque<>();
        final Map<String, DiscoveryRobots> robots = new HashMap<>();
        String stop;
        int links, eligible;

        Crawl(
                CreateDiscovery input,
                DiscoveryLimits limits,
                DiscoveryBudget budget,
                Consumer<Page> save) {
            this.input = input;
            this.limits = limits;
            this.budget = budget;
            this.save = save;
        }

        Result run() {
            String root = "https://" + input.hostname();
            enqueue(root, DiscoverySource.INITIAL, 0);
            try {
                robot(root);
                addMap(root + "/sitemap.xml");
                while (!pending.isEmpty() || !sitemapQueue.isEmpty()) {
                    budget.check();
                    if (!pending.isEmpty()) visit(pending.removeFirst());
                    else sitemap(sitemapQueue.removeFirst());
                }
                return new Result(
                        stop != null ? stop : eligible == 0 ? "NO_ELIGIBLE_URLS" : "EXHAUSTED",
                        stop != null);
            } catch (DiscoveryStop e) {
                // Pending URLs were never declared eligible. Preserve an explicit terminal reason
                // for each.
                while (!pending.isEmpty()) {
                    var item = pending.removeFirst();
                    save.accept(new Page(item.url, item.source, item.depth, false, e.code));
                }
                return new Result(e.code, !e.code.equals("CANCELED"));
            }
        }

        void enqueue(String value, DiscoverySource source, int depth) {
            budget.check();
            String url;
            try {
                url = UrlNormalizer.normalizeSyntax(value);
            } catch (IllegalArgumentException e) {
                stop = "INVALID_LINKS";
                return;
            }
            if (known.contains(url)) return;
            if (known.size() >= limits.maxUrls()) {
                stop = "URL_LIMIT";
                return;
            }
            known.add(url);
            String reason = scope(url);
            if (reason == null && depth > limits.maxDepth()) reason = "DEPTH_LIMIT";
            if (reason != null) {
                save.accept(new Page(url, source, depth, false, reason));
                if (reason.equals("DEPTH_LIMIT")) stop = reason;
                return;
            }
            pending.addLast(new Candidate(url, source, depth));
        }

        String scope(String url) {
            URI uri = URI.create(url);
            if (!input.hostname().equalsIgnoreCase(uri.getHost())) return "EXTERNAL_HOST";
            String path = uri.getPath();
            if (path == null || path.isEmpty()) path = "/";
            try {
                path = new URI(null, null, path, null).normalize().getPath();
            } catch (Exception e) {
                return "INVALID_URL";
            }
            for (String excluded : input.excludedPaths())
                if (path.startsWith(excluded)) return "EXCLUDED_PATH";
            return null;
        }

        void visit(Candidate item) {
            if (!visited.add(item.url)) return;
            boolean saved = false;
            try {
                var fetched = fetch(item.url, false, policy.bodyBytes);
                var response = fetched.response;
                if (response.status() < 200 || response.status() >= 300)
                    throw new DiscoveryStop("HTTP_ERROR");
                if (!response.type()
                        .toLowerCase(Locale.ROOT)
                        .matches("^(text/html|application/xhtml\\+xml)(;.*)?$"))
                    throw new DiscoveryStop("NOT_HTML");
                save.accept(new Page(item.url, item.source, item.depth, true, null));
                eligible++;
                saved = true;
                var document =
                        Jsoup.parse(
                                response.body(),
                                fetched.url); // Body is already bounded; never executes scripts.
                for (var link : document.select("a[href]")) {
                    budget.check();
                    if (++links > policy.maxLinks) {
                        stop = "LINK_LIMIT";
                        break;
                    }
                    String href = link.attr("href");
                    if (href.isBlank() || href.startsWith("#")) continue;
                    try {
                        enqueue(
                                link.absUrl("href"),
                                DiscoverySource.LINK,
                                item.depth + 1);
                    } catch (IllegalArgumentException e) {
                        stop = "INVALID_LINKS";
                    }
                }
            } catch (DiscoveryStop e) {
                if (!saved) save.accept(new Page(item.url, item.source, item.depth, false, e.code));
                if (Set.of("CANCELED", "TIME_LIMIT").contains(e.code)) throw e;
                stop = e.code;
            }
        }

        Fetched fetch(String initial, boolean isRobots, int bytes) {
            String url = initial;
            Set<String> redirects = new HashSet<>();
            for (int hop = 0; ; hop++) {
                budget.check();
                String reason = scope(url);
                if (reason != null) throw new DiscoveryStop(reason);
                if (!redirects.add(url)) throw new DiscoveryStop("REDIRECT_LOOP");
                if (!isRobots && !robot(url).allows(url))
                    throw new DiscoveryStop("ROBOTS_DISALLOWED");
                var response = transport.get(url, bytes, budget);
                if (!Set.of(301, 302, 303, 307, 308).contains(response.status()))
                    return new Fetched(response, url);
                if (hop >= policy.redirects) throw new DiscoveryStop("REDIRECT_LIMIT");
                if (response.location() == null) throw new DiscoveryStop("INVALID_REDIRECT");
                try {
                    url =
                            UrlNormalizer.normalizeSyntax(
                                    URI.create(url).resolve(response.location()).toString());
                } catch (IllegalArgumentException e) {
                    throw new DiscoveryStop("INVALID_REDIRECT");
                }
            }
        }

        DiscoveryRobots robot(String target) {
            URI uri = URI.create(target);
            String origin = uri.getScheme() + "://" + uri.getHost();
            if (robots.containsKey(origin)) return robots.get(origin);
            var response = fetch(origin + "/robots.txt", true, policy.robotsBytes).response;
            DiscoveryRobots rules;
            if (response.status() == 404 || response.status() == 410)
                rules = DiscoveryRobots.allowAll();
            else if (response.status() < 200 || response.status() >= 300)
                throw new DiscoveryStop("ROBOTS_UNAVAILABLE");
            else
                rules = DiscoveryRobots.parse(response.body(), policy.maxLinks, policy.maxSitemaps);
            robots.put(origin, rules);
            if (rules.sitemapsTruncated) stop = "SITEMAP_LIMIT";
            for (String map : rules.sitemaps) addMap(map);
            return rules;
        }

        void addMap(String value) {
            try {
                String url = UrlNormalizer.normalizeSyntax(value);
                String reason = scope(url);
                if (reason != null) {
                    enqueue(url, DiscoverySource.SITEMAP, 0);
                    return;
                }
                if (maps.contains(url)) return;
                if (maps.size() >= policy.maxSitemaps) {
                    stop = "SITEMAP_LIMIT";
                    return;
                }
                maps.add(url);
                sitemapQueue.addLast(url);
            } catch (IllegalArgumentException e) {
                stop = "INVALID_SITEMAP";
            }
        }

        void sitemap(String url) {
            if (known.size() >= limits.maxUrls()) {
                stop = "URL_LIMIT";
                return;
            }
            try {
                var response = fetch(url, false, policy.bodyBytes).response;
                if (response.status() == 404 || response.status() == 410) return;
                if (response.status() < 200 || response.status() >= 300)
                    throw new DiscoveryStop("SITEMAP_UNAVAILABLE");
                var factory = XMLInputFactory.newFactory();
                factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
                factory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
                factory.setXMLResolver(
                        (publicId, systemId, base, namespace) -> {
                            throw new XMLStreamException("External entity refused");
                        });
                var reader = factory.createXMLStreamReader(new StringReader(response.body()));
                try {
                    boolean index = false, root = false, inLoc = false;
                    int depth = 0;
                    StringBuilder location = new StringBuilder();
                    while (reader.hasNext()) {
                        budget.check();
                        int event = reader.next();
                        if (event == XMLStreamConstants.DTD
                                || event == XMLStreamConstants.ENTITY_REFERENCE)
                            throw new DiscoveryStop("XML_UNSAFE");
                        if (event == XMLStreamConstants.START_ELEMENT) {
                            if (++depth > 8) throw new DiscoveryStop("XML_LIMIT");
                            String name = reader.getLocalName();
                            if (!root) {
                                root = true;
                                index = name.equals("sitemapindex");
                                if (!index && !name.equals("urlset"))
                                    throw new DiscoveryStop("INVALID_SITEMAP");
                            }
                            if (name.equals("loc")) {
                                inLoc = true;
                                location.setLength(0);
                            }
                        } else if (event == XMLStreamConstants.CHARACTERS && inLoc) {
                            if (location.length() + reader.getTextLength() > 2048)
                                throw new DiscoveryStop("XML_LIMIT");
                            location.append(reader.getText());
                        } else if (event == XMLStreamConstants.END_ELEMENT) {
                            depth--;
                            if (reader.getLocalName().equals("loc")) {
                                inLoc = false;
                                if (++links > policy.maxLinks) {
                                    stop = "LINK_LIMIT";
                                    break;
                                }
                                if (index) addMap(location.toString().trim());
                                else
                                    enqueue(location.toString().trim(), DiscoverySource.SITEMAP, 0);
                                if (known.size() >= limits.maxUrls()) {
                                    stop = "URL_LIMIT";
                                    break;
                                }
                            }
                        }
                    }
                } finally {
                    reader.close();
                }
            } catch (DiscoveryStop e) {
                if (Set.of("CANCELED", "TIME_LIMIT").contains(e.code)) throw e;
                stop = e.code;
            } catch (XMLStreamException e) {
                stop = "INVALID_SITEMAP";
            }
        }
    }
}
