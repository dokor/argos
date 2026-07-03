package com.dokor.argos.services.domain.audit.model;

/**
 * Statut d'un module d'analyse au sein d'un AuditRun.
 * Sérialisé en JSON dans la colonne {@code module_statuses} de ARG_AUDIT_RUN.
 *
 * @param id     identifiant technique du module (ex : {@code "http"})
 * @param label  libellé affiché en UI (ex : {@code "HTTP & Sécurité"})
 * @param status état courant : {@code PENDING | RUNNING | COMPLETED | FAILED | SKIPPED}
 */
public record ModuleStatus(String id, String label, String status) {

    public static final String PENDING   = "PENDING";
    public static final String RUNNING   = "RUNNING";
    public static final String COMPLETED = "COMPLETED";
    public static final String FAILED    = "FAILED";
    public static final String SKIPPED   = "SKIPPED";

    /** Renvoie une copie avec le statut mis à jour. */
    public ModuleStatus withStatus(String newStatus) {
        return new ModuleStatus(id, label, newStatus);
    }
}
