package com.dokor.argos.services.domain.audit;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * Normalise les URLs soumises par les utilisateurs pour assurer
 * l'idempotence de la création d'audits en base.
 * <p>
 * Sans normalisation robuste, {@code http://EXAMPLE.COM} et
 * {@code https://example.com/} seraient traités comme deux audits
 * distincts alors qu'ils désignent le même site.
 * <p>
 * Règles appliquées :
 * <ol>
 *   <li>Ajout du schéma {@code https://} si absent.</li>
 *   <li>Mise en minuscules du host (RFC 3986 §3.2.2).</li>
 *   <li>Suppression des ports par défaut (80 pour HTTP, 443 pour HTTPS).</li>
 *   <li>Suppression du slash racine superflu ({@code /} seul).</li>
 *   <li>Suppression du fragment ({@code #anchor}) : non significatif côté serveur.</li>
 * </ol>
 */
@Singleton
public class UrlNormalizer {

    /** Pattern minimal pour détecter la présence d'un schéma dans une URL. */
    private static final String SCHEME_PATTERN = "^[a-zA-Z][a-zA-Z0-9+\\-.]*://.*";

    @Inject
    public UrlNormalizer() {
        // Pas d'état : toutes les opérations sont purement fonctionnelles
    }

    /**
     * Normalise une URL brute en une forme canonique stable.
     *
     * @param inputUrl URL fournie par l'utilisateur (peut être partielle, ex: {@code example.com})
     * @return URL normalisée, utilisable comme clé fonctionnelle en BDD
     * @throws IllegalArgumentException si l'URL est vide ou syntaxiquement invalide
     */
    public String normalize(String inputUrl) {
        if (inputUrl == null || inputUrl.isBlank()) {
            throw new IllegalArgumentException("URL cannot be blank");
        }

        String trimmed = inputUrl.trim();

        // Ajouter https:// si aucun schéma n'est présent
        if (!trimmed.matches(SCHEME_PATTERN)) {
            trimmed = "https://" + trimmed;
        }

        URI uri;
        try {
            uri = new URI(trimmed).normalize();
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Malformed URL: " + inputUrl, e);
        }

        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "https";
        String host   = uri.getHost()   != null ? uri.getHost().toLowerCase(Locale.ROOT)   : "";

        // Supprimer les ports par défaut
        int port = uri.getPort();
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
            port = -1;
        }

        // Supprimer le slash racine (https://example.com/ → https://example.com)
        // mais conserver les chemins non-racine (https://example.com/blog/)
        String path = uri.getPath() != null ? uri.getPath() : "";
        if ("/".equals(path)) {
            path = "";
        }

        // Conserver la query string, supprimer le fragment (non significatif côté serveur)
        try {
            return new URI(scheme, uri.getUserInfo(), host, port, path, uri.getQuery(), null).toString();
        } catch (URISyntaxException e) {
            // Ne devrait pas arriver car les composants ont déjà été parsés
            throw new IllegalArgumentException("Cannot reconstruct normalized URL from: " + inputUrl, e);
        }
    }

    /**
     * Extrait le hostname depuis une URL normalisée.
     *
     * @param normalizedUrl URL normalisée (issue de {@link #normalize})
     * @return hostname en minuscules, ex: {@code example.com}
     */
    public String extractHostname(String normalizedUrl) {
        return URI.create(normalizedUrl).getHost();
    }
}
