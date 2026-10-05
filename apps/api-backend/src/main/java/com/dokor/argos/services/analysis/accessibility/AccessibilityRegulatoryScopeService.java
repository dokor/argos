package com.dokor.argos.services.analysis.accessibility;

import jakarta.inject.Singleton;
import java.util.*;
import java.util.regex.Pattern;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityCompliance.*;

@Singleton
public class AccessibilityRegulatoryScopeService {
    /** Facts are supplied by a trusted caller, never extracted as VERIFIED from HTML. */
    public record Fact(boolean value, Provenance provenance) {}
    public record Facts(Fact b2cService, Fact article47Operator, Fact outsideScope, Fact exemption, Fact scopeReviewed) {
        public static Facts unknown() { return new Facts(null, null, null, null, null); }
    }
    public record Qualification(List<Scope> scopes, Confidence confidence,
                                List<Signal> signals, List<String> missingInformation) {}
    private static final int MAX_HTML = 131072;
    private static final Pattern PRICE = Pattern.compile("(?i)\\b\\d+(?:[.,]\\d+)?\\s*(?:€|eur|usd|\\$)");
    private static final Pattern CTA = Pattern.compile("(?iu)\\b(?:panier|cart|checkout|commander|acheter|réserver|reserver|buy now|book now)\\b");

    public Qualification qualify(String html, boolean blocked, Facts facts) {
        if (facts == null) facts = Facts.unknown();
        List<Signal> signals = new ArrayList<>();
        LinkedHashSet<Scope> scopes = new LinkedHashSet<>();
        LinkedHashSet<String> missing = new LinkedHashSet<>();
        String visible = blocked ? "" : visibleText(html);
        boolean price = PRICE.matcher(visible).find(), cta = CTA.matcher(visible).find();
        if (price) signals.add(new Signal("PRICE", Provenance.OBSERVED, true));
        if (cta) signals.add(new Signal("COMMERCE_CTA", Provenance.OBSERVED, true));
        if (price && cta) scopes.add(Scope.POTENTIALLY_EAA);
        addFact(signals, "B2C_SERVICE", facts.b2cService());
        addFact(signals, "ARTICLE47_OPERATOR", facts.article47Operator());
        addFact(signals, "OUTSIDE_SCOPE", facts.outsideScope());
        addFact(signals, "EXEMPTION", facts.exemption());
        addFact(signals, "SCOPE_REVIEWED", facts.scopeReviewed());
        if (positive(facts.b2cService())) scopes.add(Scope.POTENTIALLY_EAA);
        if (positive(facts.article47Operator())) scopes.add(Scope.POTENTIALLY_ARTICLE_47);
        boolean unresolved = signals.stream().anyMatch(s -> s.provenance() == Provenance.DECLARED);
        if (verifiedTrue(facts.outsideScope()) && scopes.isEmpty() && !unresolved)
            return new Qualification(List.of(Scope.OUT_OF_SCOPE), Confidence.HIGH, List.copyOf(signals), List.of());
        boolean reviewed = verifiedTrue(facts.scopeReviewed());
        if (!reviewed) {
            if (!verified(facts.b2cService())) missing.add("B2C_SERVICE");
            if (!verified(facts.article47Operator())) missing.add("OPERATOR_STATUS");
            if (!verified(facts.exemption())) missing.add("EXEMPTIONS");
            missing.add("JURISDICTION");
            missing.add("SERVICE_DATES");
            missing.add("SCOPE_REVIEW");
            if (scopes.contains(Scope.POTENTIALLY_EAA)) missing.add("ENTERPRISE_SIZE");
            if (scopes.contains(Scope.POTENTIALLY_ARTICLE_47)) missing.add("ARTICLE47_OPERATOR_CATEGORY");
        }
        if (blocked) missing.add("PAGE_UNAVAILABLE");
        if (verifiedTrue(facts.outsideScope()) && !scopes.isEmpty()) missing.add("CONFLICTING_SCOPE");
        Confidence confidence = scopes.isEmpty() ? Confidence.UNKNOWN :
            reviewed && !unresolved
                && (!scopes.contains(Scope.POTENTIALLY_EAA) || verifiedTrue(facts.b2cService()))
                && (!scopes.contains(Scope.POTENTIALLY_ARTICLE_47) || verifiedTrue(facts.article47Operator()))
                && !missing.contains("CONFLICTING_SCOPE") ? Confidence.HIGH : Confidence.LOW;
        return new Qualification(scopes.isEmpty() ? List.of(Scope.UNKNOWN) : List.copyOf(scopes),
            confidence, List.copyOf(signals), List.copyOf(missing));
    }
    private static boolean positive(Fact f) { return f != null && f.value(); }
    private static boolean verified(Fact f) { return f != null && f.provenance() == Provenance.VERIFIED; }
    private static boolean verifiedTrue(Fact f) { return verified(f) && f.value(); }
    private static void addFact(List<Signal> signals, String code, Fact fact) {
        if (fact != null) signals.add(new Signal(code, fact.provenance(), fact.value()));
    }

    /** Conservative bounded token scan. Comments/script/style contents never create signals. */
    static String visibleText(String html) {
        if (html == null) return "";
        String text = html.substring(0, Math.min(html.length(), MAX_HTML));
        StringBuilder out = new StringBuilder();
        String hidden = null;
        int hiddenDepth = 0;
        for (int i=0; i<text.length();) {
            if (text.startsWith("<!--", i)) {
                int end = text.indexOf("-->", i+4);
                i = end < 0 ? text.length() : end+3; continue;
            }
            if (text.charAt(i) == '<') {
                int end = text.indexOf('>', i+1);
                if (end < 0) break;
                String tag = text.substring(i+1, end).toLowerCase(Locale.ROOT).trim();
                if (hidden == null && tag.matches("(?s)(script|style|template)(?:\\s.*)?")) {
                    hidden = tag.split("\\s", 2)[0]; hiddenDepth = 1;
                } else if ("template".equals(hidden) && tag.matches("(?s)template(?:\\s.*)?")) {
                    hiddenDepth++;
                } else if (hidden != null && tag.matches("/" + hidden + "\\s*")) {
                    if (--hiddenDepth == 0) hidden = null;
                }
                out.append(' '); i=end+1; continue;
            }
            if (hidden == null) out.append(text.charAt(i));
            i++;
        }
        return out.toString().replace("&euro;", "€").replace("&nbsp;", " ");
    }
}
