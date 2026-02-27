package com.dokor.argos.services.analysis.modules.tech;

import jakarta.inject.Singleton;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Singleton
public class NextJsDetectorService {

    // Strong signals
    private static final Pattern NEXT_DATA_PATTERN = Pattern.compile("(?is)<script[^>]+id=[\"']__NEXT_DATA__[\"'][^>]*>");
    private static final Pattern NEXT_STATIC_PATTERN = Pattern.compile("(?is)/_next/static/");
    private static final Pattern NEXT_CHUNKS_APP_PATTERN = Pattern.compile("(?is)/_next/static/chunks/app/");
    private static final Pattern NEXT_CHUNKS_PAGES_PATTERN = Pattern.compile("(?is)/_next/static/chunks/pages/");
    private static final Pattern NEXT_BUILD_ID_PATTERN = Pattern.compile("(?is)\"buildId\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern RSC_PATTERN = Pattern.compile("(?is)react-server-dom-webpack|__next_f|__flight__");

    // Support signals (headers)
    private static final Set<String> NEXT_HEADERS = Set.of("x-nextjs-cache", "x-nextjs-page", "x-nextjs-data");
    private static final Pattern VERCEL_HEADERS_PATTERN = Pattern.compile("(?is)x-vercel-|server:\\s*vercel");

    public NextJsDetectionResult detect(Map<String, String> headers, String html) {
        headers = headers != null ? headers : Map.of();
        html = html != null ? html : "";

        List<String> evidence = new ArrayList<>();
        double score = 0.0;

        if (NEXT_DATA_PATTERN.matcher(html).find()) {
            score += 0.65;
            evidence.add("html: __NEXT_DATA__ script present");
        }
        if (NEXT_STATIC_PATTERN.matcher(html).find()) {
            score += 0.45;
            evidence.add("html: /_next/static/ present");
        }
        if (RSC_PATTERN.matcher(html).find()) {
            score += 0.65;
            evidence.add("html: RSC/Flight markers present (react-server-dom-webpack/__next_f/__flight__)");
        }

        // header signals
        for (String h : NEXT_HEADERS) {
            if (headers.containsKey(h)) {
                score += 0.25;
                evidence.add("header: " + h + " present");
            }
        }
        if (VERCEL_HEADERS_PATTERN.matcher(concat(headers)).find()) {
            score += 0.15;
            evidence.add("headers: vercel markers present (x-vercel-* or server: vercel)");
        }

        double confidence = Math.min(1.0, score);
        boolean isNext = confidence >= 0.60;

        String router = "unknown";
        if (NEXT_CHUNKS_APP_PATTERN.matcher(html).find() || RSC_PATTERN.matcher(html).find()) {
            router = "app";
        } else if (NEXT_CHUNKS_PAGES_PATTERN.matcher(html).find() || NEXT_DATA_PATTERN.matcher(html).find()) {
            router = "pages";
        }

        String buildId = extractBuildId(html);

        NextJsVersionInference version = inferVersion(router, html);

        return new NextJsDetectionResult(
            isNext,
            confidence,
            router,
            buildId,
            evidence,
            version
        );
    }

    private static String extractBuildId(String html) {
        Matcher m = NEXT_BUILD_ID_PATTERN.matcher(html);
        if (m.find()) return m.group(1);
        return null;
    }

    /**
     * Important: sans fuite (sourcemaps, etc.), on ne peut pas donner une version exacte.
     * On renvoie donc :
     * - range min/max (souvent min seulement)
     * - un guess (faible confiance)
     */
    private static NextJsVersionInference inferVersion(String router, String html) {
        // Defaults
        String exact = null;
        String min = null;
        String max = null;
        String guess = null;
        double guessConfidence = 0.0;
        String method = "heuristics";

        boolean hasRsc = RSC_PATTERN.matcher(html).find();
        boolean hasNextData = NEXT_DATA_PATTERN.matcher(html).find();
        boolean hasNextStatic = NEXT_STATIC_PATTERN.matcher(html).find();

        // Router/app => Next >= 13 (strong)
        if ("app".equals(router) || hasRsc) {
            min = "13.0.0";
            guess = "13.4.x+";
            guessConfidence = 0.55;
        } else if ("pages".equals(router) && (hasNextData || hasNextStatic)) {
            // Pages router could be 9+ and still on 14. We can’t cap max.
            min = "9.0.0";
            guess = "12.x–14.x (pages router)";
            guessConfidence = 0.35;
        } else if (hasNextStatic) {
            min = "9.0.0";
            guess = "unknown (next detected via assets)";
            guessConfidence = 0.25;
        }

        return new NextJsVersionInference(exact, min, max, guess, guessConfidence, method);
    }

    private static String concat(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        headers.forEach((k, v) -> sb.append(k).append(": ").append(v).append("\n"));
        return sb.toString();
    }

    // DTOs
    public record NextJsDetectionResult(
        boolean isNext,
        double confidence,
        String router,
        String buildId,
        List<String> evidence,
        NextJsVersionInference version
    ) {}

    public record NextJsVersionInference(
        String exact,
        String min,
        String max,
        String guess,
        double guessConfidence,
        String method
    ) {}
}
