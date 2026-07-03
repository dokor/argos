package com.dokor.argos.logging;

import org.slf4j.Logger;

/**
 * Enveloppe de logging structuré pour les appels aux services externes
 * (Lighthouse, Playwright, SSL Labs, Observatory, ZAP…).
 * <p>
 * Émet une trace uniforme pour chaque appel : début (debug), succès avec durée
 * (info) ou échec avec durée + erreur (warn). Permet de suivre les temps
 * d'exécution et les incidents techniques (issue #41) sans dupliquer le format
 * de log dans chaque client.
 * <p>
 * Convention : {@code event_name key=value}, cohérente avec le logger structuré
 * du frontend. La cible (URL/host) est sanitisée pour éviter toute injection de log.
 */
public final class ExternalServiceCall {

    private ExternalServiceCall() {
    }

    @FunctionalInterface
    public interface ThrowingSupplier<T> {
        T get() throws Exception;
    }

    /**
     * Exécute {@code action} en journalisant l'appel externe et sa durée.
     *
     * @param logger  logger du client appelant
     * @param service nom court du service externe (ex. "lighthouse")
     * @param target  cible de l'appel (URL/host) — sera sanitisée avant log
     * @param action  l'appel effectif (envoi HTTP + parsing)
     * @return le résultat de {@code action}
     * @throws Exception l'exception levée par {@code action} (rethrow après log)
     */
    public static <T> T timed(Logger logger, String service, String target, ThrowingSupplier<T> action) throws Exception {
        long start = System.currentTimeMillis();
        String safeTarget = sanitize(target);
        logger.debug("external_call_start service={} target={}", service, safeTarget);
        try {
            T result = action.get();
            logger.info("external_call_ok service={} target={} durationMs={}",
                service, safeTarget, System.currentTimeMillis() - start);
            return result;
        } catch (Exception e) {
            logger.warn("external_call_failed service={} target={} durationMs={} error={}",
                service, safeTarget, System.currentTimeMillis() - start, e.toString());
            throw e;
        }
    }

    /** Retire les CRLF/tabulations (anti log-injection) et tronque les cibles trop longues. */
    private static String sanitize(String target) {
        if (target == null) return "null";
        String cleaned = target.replaceAll("[\\r\\n\\t]", " ");
        return cleaned.length() > 200 ? cleaned.substring(0, 200) + "…" : cleaned;
    }
}
