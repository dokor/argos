package com.dokor.argos.services.analysis;

import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Singleton
public class JavaHttpUrlAuditAnalyzer implements UrlAuditAnalyzer {

    private static final Logger logger = LoggerFactory.getLogger(JavaHttpUrlAuditAnalyzer.class);

    private final HttpClient client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER) // on gère nous-même la chaîne
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    @Override
    public UrlAuditResult analyze(String url) {
        logger.info("Beginning to analyze url {}", url);
        long start = System.currentTimeMillis();

        List<String> chain = new ArrayList<>();
        String current = url;

        Map<String, String> lastHeaders = Map.of();
        int status = 0;
        String body = null;

        try {
            for (int i = 0; i < 10; i++) { // limite anti-loop
                chain.add(current);

                HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(current))
                    .timeout(Duration.ofSeconds(20))
                    .header("User-Agent", "argos-auditor/1.0")
                    .GET()
                    .build();

                HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
                status = res.statusCode();
                lastHeaders = flattenHeaders(res.headers().map());

                if (status >= 300 && status < 400) {
                    String loc = res.headers().firstValue("location").orElse(null);
                    if (loc == null) break;
                    current = URI.create(current).resolve(loc).toString();
                    continue;
                }

                body = res.body();
                break;
            }

            UrlAuditResult.HtmlInfo html = HtmlExtractor.extract(body);
            logger.info("End of analyze url {}", url);
            return new UrlAuditResult(
                url,
                current,
                status,
                chain,
                System.currentTimeMillis() - start,
                lastHeaders,
                html,
                List.of()
            );
        } catch (Exception e) {
            logger.error("Error in analyze url {} : {}", url, e.getMessage());
            return new UrlAuditResult(
                url,
                current,
                status,
                chain,
                System.currentTimeMillis() - start,
                lastHeaders,
                new UrlAuditResult.HtmlInfo(null, null, List.of()),
                List.of(e.getClass().getSimpleName() + ": " + e.getMessage())
            );
        }
    }

    private static Map<String, String> flattenHeaders(Map<String, List<String>> headers) {
        Map<String, String> out = new LinkedHashMap<>();
        headers.forEach((k, v) -> out.put(k.toLowerCase(Locale.ROOT), String.join(", ", v)));
        return out;
    }
}
