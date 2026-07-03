package com.dokor.argos.db.dao;


import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.QAuditRun;
import com.dokor.argos.services.domain.audit.enums.AuditRunStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.time.Instant;
import java.util.Optional;


@Singleton
public class AuditRunDao extends CrudDaoQuerydsl<AuditRun> {

    private static final QAuditRun RUN = QAuditRun.auditRun;


    @Inject
    public AuditRunDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, QAuditRun.auditRun);
    }

    public Optional<AuditRun> findNextQueuedRun() {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(RUN)
                .from(RUN)
                .where(
                    RUN.status.eq(AuditRunStatus.QUEUED.name()),
                    RUN.claimToken.isNull()
                )
                .orderBy(RUN.createdAt.asc())
                .limit(1)
                .fetchOne()
        );
    }


    /**
     * Recherche un AuditRun à partir de son claimToken.
     * <p>
     * Le claimToken est utilisé pour identifier quel worker
     * a "pris" (claim) une tâche à traiter.
     *
     * @param claimToken token unique associé à un run
     * @return Optional contenant l'AuditRun s'il existe, vide sinon
     */
    public Optional<AuditRun> findByClaimToken(String claimToken) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(RUN)
                .from(RUN)
                .where(RUN.claimToken.eq(claimToken))
                .fetchOne()  // retourne null si aucun résultat
        );
    }

    /**
     * Claim atomique d'un AuditRun.
     * <p>
     * Objectif :
     * - Permettre à plusieurs workers de consommer une queue
     * - Garantir qu'un run n'est traité que par UN seul worker
     * <p>
     * Conditions pour réussir le claim :
     * - status = QUEUED
     * - claimToken IS NULL
     * <p>
     * Si un autre worker a déjà claim le run,
     * la requête ne modifie aucune ligne.
     *
     * @param runId      identifiant du run à claim
     * @param claimToken token unique du worker
     * @param now        instant de démarrage du traitement
     * @return true si le claim a réussi, false sinon
     */
    public boolean claimRun(long runId, String claimToken, Instant now) {
        long updated = transactionManager.update(RUN)
            .set(RUN.claimToken, claimToken)
            .set(RUN.status, AuditRunStatus.RUNNING.name())
            .set(RUN.startedAt, now)
            .where(
                RUN.id.eq(runId),
                RUN.status.eq(AuditRunStatus.QUEUED.name()),
                RUN.claimToken.isNull()
            )
            .execute();

        // Si exactement 1 ligne a été modifiée, le claim a réussi
        return updated == 1;
    }

    /**
     * Marque un run comme terminé avec succès.
     * <p>
     * Cette méthode est appelée lorsque le traitement
     * de l'audit s'est bien déroulé.
     *
     * @param runId      identifiant du run
     * @param finishedAt date de fin de traitement
     * @param resultJson résultat du traitement (JSON sérialisé)
     */
    public void markCompleted(long runId, Instant finishedAt, String resultJson) {
        transactionManager.update(RUN)
            .set(RUN.status, AuditRunStatus.COMPLETED.name())
            .set(RUN.finishedAt, finishedAt)
            .set(RUN.resultJson, resultJson)
            .where(RUN.id.eq(runId))
            .execute();
    }

    /**
     * Marque un run comme échoué.
     * <p>
     * Utilisé si une exception ou une erreur métier
     * empêche la fin normale du traitement.
     *
     * @param runId      identifiant du run
     * @param finishedAt date de fin (échec)
     * @param lastError  message d'erreur à conserver en base
     */
    public void markFailed(long runId, Instant finishedAt, String lastError) {
        transactionManager.update(RUN)
            .set(RUN.status, AuditRunStatus.FAILED.name())
            .set(RUN.finishedAt, finishedAt)
            .set(RUN.lastError, lastError)
            .where(RUN.id.eq(runId))
            .execute();
    }

    /**
     * Recherche un AuditRun par son reportToken pré-généré.
     * Utilisé pour résoudre le statut d'un run depuis la page rapport,
     * avant même que le rapport public soit publié.
     */
    public Optional<AuditRun> findByReportToken(String reportToken) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(RUN)
                .from(RUN)
                .where(RUN.reportToken.eq(reportToken))
                .fetchOne()
        );
    }

    /**
     * Met à jour le JSON des statuts de modules pour un run donné.
     *
     * @param runId        identifiant du run
     * @param statusesJson JSON array des {@code ModuleStatus}
     */
    public void updateModuleStatuses(long runId, String statusesJson) {
        transactionManager.update(RUN)
            .set(RUN.moduleStatuses, statusesJson)
            .where(RUN.id.eq(runId))
            .execute();
    }
}
