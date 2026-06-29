package com.dokor.argos.services.domain.audit;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

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
 * <p>
 * Sécurité :
 * <ul>
 *   <li>Seuls {@code http} et {@code https} sont autorisés (blocage {@code file://}, {@code javascript://}, etc.).</li>
 *   <li>Les adresses privées et de loopback sont rejetées (protection SSRF).</li>
 *   <li>Les credentials {@code user:password@host} sont supprimés.</li>
 *   <li>La longueur maximale est limitée à {@value #MAX_URL_LENGTH} caractères.</li>
 * </ul>
 */
@Singleton
public class UrlNormalizer {

    /** Longueur maximale d'une URL acceptée. */
    static final int MAX_URL_LENGTH = 2048;

    /** Seuls ces schémas sont autorisés. */
    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    /** Pattern minimal pour détecter la présence d'un schéma dans une URL. */
    private static final String SCHEME_PATTERN = "^[a-zA-Z][a-zA-Z0-9+\\-.]*://.*";

    /**
     * Hostnames locaux/internes toujours bloqués, indépendamment de la résolution DNS.
     * Couvre : localhost, *.local, *.internal, *.localhost, *.localdomain
     */
    private static final Pattern BLOCKED_HOSTNAME_PATTERN = Pattern.compile(
        "^(localhost|.*\\.local|.*\\.internal|.*\\.localhost|.*\\.localdomain)$",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * IPs privées IPv4 littérales rejetées sans résolution DNS :
     * loopback (127.x), lien local (169.254.x), privées RFC-1918 (10.x, 172.16-31.x, 192.168.x).
     */
    private static final Pattern PRIVATE_IPV4_PATTERN = Pattern.compile(
        "^("
        + "127\\."                                    // loopback
        + "|169\\.254\\."                             // link-local / AWS metadata
        + "|10\\."                                    // RFC-1918 class A
        + "|172\\.(1[6-9]|2[0-9]|30|31)\\."          // RFC-1918 class B
        + "|192\\.168\\."                             // RFC-1918 class C
        + "|0\\.0\\.0\\.0"                            // unspecified
        + ")"
    );

    /** Adresses IPv6 spéciales bloquées (loopback, link-local, unique-local). */
    private static final Pattern PRIVATE_IPV6_PATTERN = Pattern.compile(
        "^(::1$|::$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)",
        Pattern.CASE_INSENSITIVE
    );

    @Inject
    public UrlNormalizer() {
        // Pas d'état : toutes les opérations sont purement fonctionnelles
    }

    /**
     * Normalise une URL brute en une forme canonique stable.
     *
     * @param inputUrl URL fournie par l'utilisateur (peut être partielle, ex: {@code example.com})
     * @return URL normalisée, utilisable comme clé fonctionnelle en BDD
     * @throws IllegalArgumentException si l'URL est vide, trop longue, invalide, ou pointe vers une adresse privée
     */
    public String normalize(String inputUrl) {
        if (inputUrl == null || inputUrl.isBlank()) {
            throw new IllegalArgumentException("URL cannot be blank");
        }

        String trimmed = inputUrl.trim();

        // ── 1. Limite de longueur ─────────────────────────────────────────────────
        if (trimmed.length() > MAX_URL_LENGTH) {
            throw new IllegalArgumentException(
                "URL exceeds maximum allowed length (" + MAX_URL_LENGTH + " characters)");
        }

        // ── 2. Ajout du schéma https:// si absent ─────────────────────────────────
        if (!trimmed.matches(SCHEME_PATTERN)) {
            trimmed = "https://" + trimmed;
        }

        URI uri;
        try {
            uri = new URI(trimmed).normalize();
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Malformed URL: " + sanitizeForLog(inputUrl), e);
        }

        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";

        // ── 3. Allowlist de schémas ───────────────────────────────────────────────
        if (!ALLOWED_SCHEMES.contains(scheme)) {
            throw new IllegalArgumentException(
                "Unsupported scheme '" + scheme + "': only http and https are allowed");
        }

        // ── 4. Extraction et validation du host ───────────────────────────────────
        String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
        if (host.isBlank()) {
            throw new IllegalArgumentException("URL contains no valid host");
        }

        validateNotSsrf(host);

        // ── 5. Suppression du userInfo (credentials) ──────────────────────────────
        // user:password@host est silencieusement ignoré, jamais propagé ni loggé.

        // ── 6. Suppression des ports par défaut ───────────────────────────────────
        int port = uri.getPort();
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
            port = -1;
        }

        // ── 7. Normalisation du path ──────────────────────────────────────────────
        String path = uri.getPath() != null ? uri.getPath() : "";
        if ("/".equals(path)) {
            path = "";
        }

        // userInfo = null : les credentials sont définitivement supprimés
        try {
            return new URI(scheme, null, host, port, path, uri.getQuery(), null).toString();
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Cannot reconstruct normalized URL from: " + sanitizeForLog(inputUrl), e);
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

    // ─── Validation SSRF ──────────────────────────────────────────────────────────

    /**
     * Vérifie que le host ne pointe pas vers une adresse privée/loopback (SSRF).
     * <p>
     * Deux passes :
     * <ol>
     *   <li>Regex sur les patterns connus (localhost, *.local, plages RFC-1918).</li>
     *   <li>Résolution DNS + vérification {@link InetAddress} pour catcher les cas
     *       non-littéraux (ex: IP décimale compactée) si le host ressemble à une IP.</li>
     * </ol>
     *
     * @throws IllegalArgumentException si le host est privé/local
     */
    private static void validateNotSsrf(String host) {
        // Passe 1 : hostnames connus
        if (BLOCKED_HOSTNAME_PATTERN.matcher(host).matches()) {
            throw new IllegalArgumentException("Target host is not allowed: private or internal hostname");
        }

        // Passe 2 : plages IP littérales
        if (PRIVATE_IPV4_PATTERN.matcher(host).find()) {
            throw new IllegalArgumentException("Target host is not allowed: private IPv4 address");
        }
        if (host.startsWith("[") && PRIVATE_IPV6_PATTERN.matcher(stripBrackets(host)).find()) {
            throw new IllegalArgumentException("Target host is not allowed: private IPv6 address");
        }

        // Passe 3 : résolution DNS — attrapable uniquement pour les IPs littérales non-standard
        // (ex: 0x7f000001 = 127.0.0.1 en hexadécimal)
        // On tente uniquement si le host ressemble à une IP (pas de point alphabétique)
        if (looksLikeIp(host)) {
            try {
                InetAddress addr = InetAddress.getByName(host);
                if (addr.isLoopbackAddress() || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress() || addr.isAnyLocalAddress()
                    || addr.isMulticastAddress()) {
                    throw new IllegalArgumentException("Target host is not allowed: private or reserved IP address");
                }
            } catch (IllegalArgumentException e) {
                throw e; // re-throw our own
            } catch (Exception ignored) {
                // En cas d'échec de résolution, on laisse passer : le module HTTP gérera l'erreur
            }
        }
    }

    /** Retourne true si le host semble être une adresse IP (pas un nom de domaine). */
    private static boolean looksLikeIp(String host) {
        // IPv6 entre crochets, ou chiffres/hex seulement (pas de lettres alphabétiques hors a-f)
        if (host.startsWith("[")) return true;
        // IPv4 pure : que des chiffres et des points
        if (host.matches("^[0-9.]+$")) return true;
        // Notation alternative (hex, octal, entier 32-bit) : commence par 0 ou 0x
        return host.matches("^0[xX0-9].*");
    }

    private static String stripBrackets(String host) {
        if (host.startsWith("[") && host.endsWith("]")) {
            return host.substring(1, host.length() - 1);
        }
        return host;
    }

    /**
     * Tronque l'URL pour éviter les injections dans les logs (log4shell, CRLF injection).
     * Limite à 100 caractères et supprime les retours chariot.
     */
    public static String sanitizeForLog(String url) {
        if (url == null) return "null";
        String safe = url.replace("\r", "\\r").replace("\n", "\\n");
        return safe.length() > 100 ? safe.substring(0, 100) + "…" : safe;
    }
}
