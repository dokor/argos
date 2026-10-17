package com.dokor.argos.services.analytics;
import java.util.Set;
public record AnalyticsDimensions(String route, String lang, String placement) {
    public static final Set<String> ROUTES=Set.of("/account/analyses/new","/account/register","/account/sign-in","/","/faq","/ressources","/exemple-rapport","/a-propos","/methodologie-score","/guides/checklist-audit-site-web","/ressources/audit-technique-gratuit","/ressources/accessibilite-numerique","/ressources/audit-site-pme","/ressources/audit-site-ecommerce","/ressources/audit-wordpress","/ressources/audit-shopify","/ressources/pourquoi-mon-site-ne-convertit-pas","/test-vitesse-site-web","/analyse-seo-page","/verifier-entetes-securite","/test-accessibilite-site-web");
    public AnalyticsDimensions {
        if(route==null || lang==null || placement==null || !ROUTES.contains(route) || !Set.of("fr","en").contains(lang) || !Set.of("page","nav","hero","footer","form").contains(placement)) throw new IllegalArgumentException("Invalid analytics dimensions");
    }
}
