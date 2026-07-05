package com.dokor.argos.db.dao;


import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.QAuditRun;
import com.dokor.argos.services.domain.audit.enums.AuditRunStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.time.Instant;
import java.util.List;
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
            // Chaque claim = une tentative de traitement. Compteur utilisé par le
            // reaper (StuckAuditRunReaper) pour borner les reprises (#127, #211).
            .set(RUN.attemptCount, RUN.attemptCount.add(1))
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
     * Recherche les runs bloqués en {@code RUNNING} : démarrés (claim) avant
     * {@code threshold} et jamais terminés. Correspond à un worker mort/redémarré
     * ou à un traitement figé (#127, #211).
     *
     * @param threshold instant limite ; un run dont {@code started_at < threshold}
     *                  est considéré comme bloqué
     * @return les runs bloqués, du plus ancien au plus récent
     */
    public List<AuditRun> findStuckRunningRuns(Instant threshold) {
        return transactionManager.selectQuery()
            .select(RUN)
            .from(RUN)
            .where(
                RUN.status.eq(AuditRunStatus.RUNNING.name()),
                RUN.startedAt.isNotNull(),
                RUN.startedAt.lt(threshold)
            )
            .orderBy(RUN.startedAt.asc())
            .fetch();
    }

    /**
     * Remet atomiquement un run bloqué en file d'attente pour un nouveau traitement.
     * <p>
     * L'update est gardé par {@code status = RUNNING} : si le run a entre-temps été
     * terminé (COMPLETED/FAILED) ou re-claimé, aucune ligne n'est modifiée — on évite
     * ainsi d'écraser un run redevenu actif ou une double reprise concurrente.
     * <p>
     * Le {@code claim_token} et {@code started_at} sont remis à NULL pour que le run
     * redevienne éligible à {@link #findNextQueuedRun()}. {@code attempt_count} est
     * conservé (déjà incrémenté au claim initial) : il sera ré-incrémenté au prochain
     * claim, ce qui borne le nombre de reprises.
     *
     * @param runId identifiant du run à relancer
     * @return true si le run a bien été remis en QUEUED, false sinon
     */
    public boolean requeueStuckRun(long runId) {
        long updated = transactionManager.update(RUN)
            .set(RUN.status, AuditRunStatus.QUEUED.name())
            .setNull(RUN.claimToken)
            .setNull(RUN.startedAt)
            .setNull(RUN.finishedAt)
            .setNull(RUN.lastError)
            .where(
                RUN.id.eq(runId),
                RUN.status.eq(AuditRunStatus.RUNNING.name())
            )
            .execute();

        return updated == 1;
    }

    /**
     * Marque atomiquement un run bloqué comme {@code FAILED} (abandon volontaire).
     * <p>
     * Gardé par {@code status = RUNNING} pour ne jamais écraser un run terminé
     * normalement ou re-claimé entre-temps.
     *
     * @param runId      identifiant du run à abandonner
     * @param finishedAt date de fin (abandon)
     * @param lastError  message d'erreur exploitable
     * @return true si le run a bien été marqué FAILED, false sinon
     */
    public boolean markStuckFailed(long runId, Instant finishedAt, String lastError) {
        long updated = transactionManager.update(RUN)
            .set(RUN.status, AuditRunStatus.FAILED.name())
            .set(RUN.finishedAt, finishedAt)
            .set(RUN.lastError, lastError)
            .where(
                RUN.id.eq(runId),
                RUN.status.eq(AuditRunStatus.RUNNING.name())
            )
            .execute();

        return updated == 1;
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
