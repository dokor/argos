package com.dokor.argos.services.analysis;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Singleton
final class HtmlExtractor {

    private static final Pattern TITLE = Pattern.compile("(?is)<title>(.*?)</title>");
    private static final Pattern META_DESC = Pattern.compile("(?is)<meta\\s+name=[\"']description[\"']\\s+content=[\"'](.*?)[\"'][^>]*>");
    private static final Pattern H1 = Pattern.compile("(?is)<h1[^>]*>(.*?)</h1>");

    @Inject
    private HtmlExtractor() {}

    static UrlAuditResult.HtmlInfo extract(String html) {
        if (html == null) {
            return new UrlAuditResult.HtmlInfo(null, null, List.of());
        }

        String title = group1(TITLE, html);
        String meta = group1(META_DESC, html);

        List<String> h1 = new ArrayList<>();
        Matcher m = H1.matcher(html);
        while (m.find()) {
            h1.add(clean(m.group(1)));
        }

        return new UrlAuditResult.HtmlInfo(clean(title), clean(meta), h1);
    }

    private static String group1(Pattern p, String s) {
        Matcher m = p.matcher(s);
        return m.find() ? m.group(1) : null;
    }

    private static String clean(String s) {
        if (s == null) return null;
        return s.replaceAll("(?is)<[^>]+>", "").trim();
    }
}
