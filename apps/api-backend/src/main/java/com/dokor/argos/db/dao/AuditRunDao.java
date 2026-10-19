package com.dokor.argos.db.dao;


import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.QAuditRun;
import com.dokor.argos.services.domain.audit.enums.AuditRunStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import com.querydsl.core.types.dsl.Expressions;
import com.querydsl.core.types.dsl.StringExpression;
import com.dokor.argos.services.scheduler.AuditQueuePolicy;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.sql.Connection;


@Singleton
public class AuditRunDao extends CrudDaoQuerydsl<AuditRun> {

    private static final QAuditRun RUN = QAuditRun.auditRun;


    private final com.dokor.argos.services.account.UsageService usage;
    private final AuditQueuePolicy queuePolicy;
    private final java.time.Clock clock;
    public AuditRunDao(TransactionManagerQuerydsl transactionManager) {
        this(transactionManager,new com.dokor.argos.services.account.UsageService(transactionManager,
            new com.dokor.argos.services.account.UsagePolicy(com.typesafe.config.ConfigFactory.empty()),java.time.Clock.systemUTC()));
    }
    public AuditRunDao(TransactionManagerQuerydsl transactionManager, com.dokor.argos.services.account.UsageService usage) {
        this(transactionManager, usage, new AuditQueuePolicy(com.typesafe.config.ConfigFactory.empty()), java.time.Clock.systemUTC());
    }
    @Inject
    public AuditRunDao(TransactionManagerQuerydsl transactionManager, com.dokor.argos.services.account.UsageService usage,
            AuditQueuePolicy queuePolicy, java.time.Clock clock) {
        super(transactionManager, QAuditRun.auditRun);
        this.usage=usage;
        this.queuePolicy=queuePolicy;
        this.clock=clock;
    }
    public com.dokor.argos.services.account.UsageService usage() { return usage; }

    /** Reset needs the scope alone, without loading a potentially large private result. */
    public String executionScope(long runId) {
        return transactionManager.selectQuery().select(RUN.executionScope).from(RUN).where(RUN.id.eq(runId)).fetchOne();
    }

    /** Admission and terminal publication both acquire queue before usage. */
    public void lockAdmission(Connection c) {
        try(var s=c.prepareStatement("SELECT id FROM ARG_AUDIT_ADMISSION WHERE id=1 FOR UPDATE");var r=s.executeQuery()) {
            if(!r.next())throw new IllegalStateException("Audit admission missing");
        }catch(java.sql.SQLException e){throw new IllegalStateException("Audit admission unavailable",e);}
    }

    /** Metadata is committed with the report; retention does not erase a batch outcome. */
    public void recordBatchCompleteness(long runId,String completeness,Connection c) {
        var page=com.dokor.argos.db.generated.QDomainBatchPage.table;
        transactionManager.update(page,c).set(page.completeness,completeness).where(page.runId.eq(runId)).execute();
    }

    public enum Recovery { REQUEUED, FAILED, CANCELED, STALE }
    /** The observation is fenced, including when two reapers overlap a fresh worker claim. */
    public Recovery recoverStuck(AuditRun observed,int maxAttempts,Instant now,String initialModules) {
        return transactionManager.executeAndReturn(c->{
            var run=lockForPublication(observed.getId(),c).orElse(null);
            if(run==null||observed.getClaimToken()==null||!"RUNNING".equals(run.getStatus())
                ||!java.util.Objects.equals(run.getClaimToken(),observed.getClaimToken())
                ||!java.util.Objects.equals(run.getStartedAt(),observed.getStartedAt()))return Recovery.STALE;
            if(Boolean.TRUE.equals(run.getCancelRequested())){finishCanceled(run,now,c);return Recovery.CANCELED;}
            if(run.getAttemptCount()!=null&&run.getAttemptCount()>=maxAttempts){
                transactionManager.update(RUN,c).set(RUN.status,"FAILED").set(RUN.finishedAt,now).set(RUN.lastError,"AUDIT_WORKER_LOST").where(RUN.id.eq(run.getId())).execute();
                usage.release(run,c);return Recovery.FAILED;
            }
            transactionManager.update(RUN,c).set(RUN.status,"QUEUED").setNull(RUN.claimToken).setNull(RUN.startedAt)
                .setNull(RUN.finishedAt).setNull(RUN.lastError).set(RUN.moduleStatuses,initialModules).where(RUN.id.eq(run.getId())).execute();
            if(run.getCiNavigationOrigins()!=null){lockAdmission(c);usage.requeuedCi(run,c);}
            return Recovery.REQUEUED;
        });
    }

    /** Global durable admission, including anonymous and personal runs, before inserting the run. */
    public AuditRun saveQueued(AuditRun run, Connection connection) {
        if (connection == null) return usage.transaction(c -> saveQueued(run, c));
        try (var statement = connection.prepareStatement(
            "UPDATE ARG_AUDIT_ADMISSION SET pending=pending+1 WHERE id=1 AND pending<100")) {
            if (statement.executeUpdate() != 1) throw new jakarta.ws.rs.WebApplicationException(
                jakarta.ws.rs.core.Response.status(429).type("application/json")
                    .header("Retry-After", "60").header("Cache-Control", "no-store")
                    .entity(java.util.Map.of("error", "Audit queue full")).build());
            return save(run, connection);
        } catch (java.sql.SQLException error) { throw new IllegalStateException("Audit admission unavailable", error); }
    }

    public Optional<AuditRun> findNextQueuedRun() {
        Instant now = clock.instant();
        // Current server-side owner and entitlement only; no client-provided priority.
        // Older requests outrank recent Premium work. Keep fair owner rotation within a band.
        var band = Expressions.numberTemplate(Integer.class,
                "CASE WHEN {0}<={1} THEN 0 WHEN EXISTS (SELECT 1 FROM ARG_ACCOUNT_USER qp "
                    + "JOIN ARG_ACCOUNT_CI_ENTITLEMENT qe ON qe.id=qp.id "
                    + "WHERE qp.id={2} AND qp.state='ACTIVE' AND qp.offer='PREMIUM' "
                    + "AND qe.ci_access=1 AND qe.valid_until>{3}) THEN 1 ELSE 2 END",
                RUN.createdAt, now.minusSeconds(queuePolicy.agingSeconds), RUN.ownerUserId, now);
        var query = transactionManager.selectQuery()
                .select(RUN)
                .from(RUN)
                .where(
                    RUN.status.eq(AuditRunStatus.QUEUED.name()),
                    RUN.claimToken.isNull(),
                    RUN.ciNavigationOrigins.isNull().or(Expressions.booleanTemplate(
                        "NOT EXISTS (SELECT 1 FROM ARG_USAGE_RUN ci_busy WHERE ci_busy.user_id={0} AND ci_busy.state='RESERVED' AND ci_busy.ci_started_at IS NOT NULL)",RUN.ownerUserId))
                );
        if (queuePolicy.premiumPriorityEnabled) query.orderBy(band.asc());
        return Optional.ofNullable(query.orderBy(Expressions.dateTimeTemplate(Instant.class,
                    "COALESCE((SELECT MAX(h.started_at) FROM ARG_AUDIT_RUN h WHERE h.owner_user_id <=> {0}), {1})",
                    RUN.ownerUserId, Instant.EPOCH).asc(), RUN.createdAt.asc(), RUN.id.asc())
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
        String ciScope=transactionManager.selectQuery().select(RUN.ciNavigationOrigins).from(RUN).where(RUN.id.eq(runId)).fetchOne();
        if(ciScope!=null) return transactionManager.executeAndReturn(c->{
            var run=lockForPublication(runId,c).orElse(null);
            if(run==null || run.getOwnerUserId()==null || !"QUEUED".equals(run.getStatus()) || run.getClaimToken()!=null)return false;
            lockAdmission(c);
            if(!usage.startCi(run,now,c))return false;
            return transactionManager.update(RUN,c).set(RUN.claimToken,claimToken).set(RUN.status,"RUNNING")
                .set(RUN.startedAt,now).set(RUN.attemptCount,RUN.attemptCount.add(1)).where(RUN.id.eq(runId)).execute()==1;
        });
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

    /** Lock on the caller's transaction connection; no autonomous connection is opened. */
    public Optional<AuditRun> lockForPublication(long runId, Connection connection) {
        return Optional.ofNullable(transactionManager.selectQuery(connection).select(RUN)
            .from(RUN).where(RUN.id.eq(runId)).forUpdate().fetchOne());
    }

    /** Caller authenticates the owner and holds its transaction; lock order: run -> usage. */
    public boolean requestCancellation(long runId,long owner,Connection c,Instant now) {
        var run=lockForPublication(runId,c).orElseThrow(com.dokor.argos.services.account.AccountError::missing);
        if(!java.util.Objects.equals(run.getOwnerUserId(),owner)) throw com.dokor.argos.services.account.AccountError.missing();
        if(!List.of("QUEUED","RUNNING").contains(run.getStatus())) return false;
        transactionManager.update(RUN,c).set(RUN.cancelRequested,true).where(RUN.id.eq(runId)).execute();
        run.setCancelRequested(true);
        if("QUEUED".equals(run.getStatus())) finishCanceled(run,now,c);
        return true;
    }
    public void finishCanceled(AuditRun run,Instant now,Connection c) {
        long changed=transactionManager.update(RUN,c).set(RUN.status,"CANCELED").set(RUN.finishedAt,now)
            .set(RUN.lastError,"CANCELED").where(RUN.id.eq(run.getId()),RUN.status.in("QUEUED","RUNNING")).execute();
        if(changed==1) usage.release(run,c);
    }

    /** Must execute in the transaction that inserts the report, with the same connection. */
    public boolean markCompleted(long runId, String claimToken, Instant finishedAt, String resultJson, Connection connection) {
        return transactionManager.update(RUN, connection)
            .set(RUN.status, AuditRunStatus.COMPLETED.name())
            .set(RUN.finishedAt, finishedAt)
            .set(RUN.resultJson, resultJson)
            .setNull(RUN.lastError)
            .where(RUN.id.eq(runId), RUN.status.eq("RUNNING"), RUN.claimToken.eq(claimToken))
            .execute() == 1;
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
    public boolean markFailed(long runId, Instant finishedAt, String lastError, String claimToken) {
        if (claimToken == null) return false;
        return failAndRelease(runId,finishedAt,lastError,claimToken);
    }
    private boolean failAndRelease(long runId,Instant finishedAt,String lastError,String claimToken) {
        return transactionManager.executeAndReturn(c -> {
            var run=lockForPublication(runId,c).orElse(null);
            if(run==null || !"RUNNING".equals(run.getStatus()) || claimToken!=null && !claimToken.equals(run.getClaimToken())) return false;
            if(Boolean.TRUE.equals(run.getCancelRequested())) {finishCanceled(run,finishedAt,c);return true;}
            long updated=transactionManager.update(RUN,c)
            .set(RUN.status, AuditRunStatus.FAILED.name())
            .set(RUN.finishedAt, finishedAt)
            .set(RUN.lastError, lastError)
            .where(RUN.id.eq(runId), RUN.status.eq("RUNNING"))
            .execute();
            if(updated==1) usage.release(run,c);
            return updated==1;
        });
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
        return transactionManager.executeAndReturn(c->{
            var run=lockForPublication(runId,c).orElse(null);
            if(run==null || !"RUNNING".equals(run.getStatus()))return false;
            if(Boolean.TRUE.equals(run.getCancelRequested())){finishCanceled(run,Instant.now(),c);return false;}
            if(run.getCiNavigationOrigins()!=null){lockAdmission(c);usage.requeuedCi(run,c);}
            return transactionManager.update(RUN,c).set(RUN.status,"QUEUED").setNull(RUN.claimToken)
                .setNull(RUN.startedAt).setNull(RUN.finishedAt).setNull(RUN.lastError)
                .where(RUN.id.eq(runId),RUN.status.eq("RUNNING")).execute()==1;
        });
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
        return failAndRelease(runId,finishedAt,lastError,null);
    }

    /**
     * Recherche un AuditRun par son reportToken pré-généré.
     * Utilisé pour résoudre le statut d'un run depuis la page rapport,
     * avant même que le rapport public soit publié.
     */
    public Optional<AuditRun> findByReportTokenHash(byte[] reportTokenHash) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(RUN)
                .from(RUN)
                .where(RUN.reportTokenHash.eq(reportTokenHash))
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

    /** One atomic UPDATE, without loading the run/result_json or overwriting another module. */
    public boolean updateModuleStatus(long runId, String moduleId, String status,
                                      String initialStatusesJson, boolean onlyRunning) {
        return updateModuleStatus(runId,moduleId,status,initialStatusesJson,onlyRunning,null);
    }
    /** An old worker cannot overwrite progress belonging to a new claim. */
    public boolean updateModuleStatus(long runId,String moduleId,String status,String initialStatusesJson,boolean onlyRunning,String expectedClaim) {
        StringExpression document = Expressions.stringTemplate(
            "CASE WHEN JSON_VALID({0}) THEN CASE WHEN JSON_TYPE({0}) = 'ARRAY' AND JSON_LENGTH({0}) > 0 "
                + "THEN {0} ELSE {1} END ELSE {1} END", RUN.moduleStatuses, initialStatusesJson);
        StringExpression path = Expressions.stringTemplate(
            "REPLACE(JSON_UNQUOTE(JSON_SEARCH({0}, 'one', {1}, NULL, '$[*].id')), '.id', '.status')",
            document, moduleId);
        StringExpression current = Expressions.stringTemplate("JSON_UNQUOTE(JSON_EXTRACT({0}, {1}))", document, path);
        var allowed = onlyRunning ? current.eq("RUNNING") : "RUNNING".equals(status)
            ? current.eq("PENDING") : current.in("PENDING", "RUNNING");
        var runState = onlyRunning ? RUN.status.in("RUNNING", "FAILED", "CANCELED") : RUN.status.eq("RUNNING");
        return transactionManager.update(RUN)
            .set(RUN.moduleStatuses, Expressions.stringTemplate("JSON_SET({0}, {1}, {2})", document, path, status))
            .where(RUN.id.eq(runId), runState, path.isNotNull(), allowed, expectedClaim==null?null:RUN.claimToken.eq(expectedClaim))
            .execute() == 1;
    }
}
