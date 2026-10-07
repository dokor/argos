package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.QAudit;
import com.dokor.argos.db.generated.QAuditReport;
import com.dokor.argos.db.generated.QAuditRun;
import com.dokor.argos.db.generated.QDomain;
import com.querydsl.core.Tuple;
import com.querydsl.sql.SQLQuery;
import com.querydsl.sql.SQLExpressions;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.time.Instant;


/**
 * DAO responsable de la table ARG_AUDIT.
 * <p>
 * Un audit représente l’analyse d’une URL précise. Il est rattaché à un {@code ARG_DOMAIN}
 * (hostname) qui regroupe toutes les pages du même site.
 * <p>
 * Convention du projet :
 * - une URL normalisée ne doit exister qu’une seule fois en base
 * - cette règle est garantie à la fois par un index unique en base et par les méthodes de ce DAO
 */
@Singleton
public class AuditDao extends CrudDaoQuerydsl<Audit> {

    private static final Logger logger = LoggerFactory.getLogger(AuditDao.class);
    private static final QAudit AUDIT = QAudit.audit;
    private static final QDomain DOMAIN = QDomain.domain;
    private static final QAuditRun RUN = QAuditRun.auditRun;
    /** Alias séparé pour la sous-requête MAX(id) - évite l'ambiguïté de colonnes. */
    private static final QAuditRun SUB_RUN = new QAuditRun("subRun");
    private static final QAuditReport AUDIT_REPORT = QAuditReport.auditReport;

    @Inject
    public AuditDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, AUDIT);
    }

    /**
     * Recherche d’un audit à partir de son URL normalisée.
     * <p>
     * Cas d’usage principal :
     * - éviter de créer plusieurs audits pour la même URL logique
     * - retrouver rapidement l’audit existant avant de créer un run
     * <p>
     * Remarque :
     * - fetchOne() retourne null si aucun résultat
     * - l’index unique garantit au plus 1 ligne
     *
     * @param normalizedUrl URL normalisée (clé fonctionnelle)
     * @return Optional contenant l’audit s’il existe
     */
    public Optional<Audit> findByNormalizedUrl(String normalizedUrl) {
        return Optional.ofNullable(transactionManager.selectQuery()
            .select(AUDIT)
            .from(AUDIT)
            .where(AUDIT.normalizedUrl.eq(normalizedUrl))
            .fetchOne()
        );
    }

    /** A losing insert is rolled back before a fresh connection reads the winner. */
    public Audit findOrCreate(Audit candidate) {
        return findByNormalizedUrl(candidate.getNormalizedUrl()).orElseGet(() -> {
            try { return save(candidate); }
            catch (RuntimeException conflict) {
                if (!UniqueInsertConflict.isDuplicate(conflict)) throw conflict;
                return findByNormalizedUrl(candidate.getNormalizedUrl()).orElseThrow(() -> conflict);
            }
        });
    }

    /**
     * Vérifie l’existence d’un audit à partir de son URL normalisée.
     * <p>
     * Méthode volontairement plus légère que findByNormalizedUrl :
     * - utilisée lorsque seul le booléen est nécessaire
     * - évite de charger inutilement l’entité complète
     *
     * @param normalizedUrl URL normalisée
     * @return true si un audit existe déjà, false sinon
     */
    public boolean existsByNormalizedUrl(String normalizedUrl) {
        return transactionManager.selectQuery()
            .select(AUDIT)
            .from(AUDIT)
            .where(AUDIT.normalizedUrl.eq(normalizedUrl))
            .fetchFirst() != null;
    }

    public record OverviewRow(long auditId, String hostname, String inputUrl, String normalizedUrl,
                              Instant auditCreatedAt, Long runId, String status, Instant runCreatedAt,
                              Instant finishedAt, boolean hasReport, Integer globalScore) {}

    public record HistoryRow(long runId, String status, Instant createdAt, Instant finishedAt,
                             boolean hasReport, Integer globalScore) {}

    /** Latest run per audit, selecting only fields used by the list response. */
    public List<OverviewRow> listAuditsWithLatestRun(int limit) {
        logger.debug("Listing audits with latest run limit={}", limit);

        return overviewQuery(transactionManager.selectQuery(), limit)
            .fetch().stream().map(row -> new OverviewRow(
                row.get(AUDIT.id), row.get(DOMAIN.hostname), row.get(AUDIT.inputUrl),
                row.get(AUDIT.normalizedUrl), row.get(AUDIT.createdAt), row.get(RUN.id),
                row.get(RUN.status), row.get(RUN.createdAt), row.get(RUN.finishedAt),
                row.get(AUDIT_REPORT.id) != null, row.get(AUDIT_REPORT.globalScore))).toList();
    }

    static SQLQuery<Tuple> overviewQuery(SQLQuery<?> query, int limit) {
        return query
            .select(AUDIT.id, DOMAIN.hostname, AUDIT.inputUrl, AUDIT.normalizedUrl,
                AUDIT.createdAt, RUN.id, RUN.status, RUN.createdAt, RUN.finishedAt,
                AUDIT_REPORT.id, AUDIT_REPORT.globalScore)
            .from(AUDIT)
            .innerJoin(DOMAIN).on(DOMAIN.id.eq(AUDIT.domainId))
            .leftJoin(RUN).on(
                RUN.auditId.eq(AUDIT.id),
                RUN.id.eq(
                    SQLExpressions.select(SUB_RUN.id.max())
                        .from(SUB_RUN)
                        .where(SUB_RUN.auditId.eq(AUDIT.id))
                )
            )
            .leftJoin(AUDIT_REPORT).on(AUDIT_REPORT.runId.eq(RUN.id))
            .orderBy(AUDIT.createdAt.desc())
            .limit(limit);
    }


    /** Run history without result_json, report_json or credentials. */
    public List<HistoryRow> listRunsWithReportByAuditId(long auditId, int limit) {
        logger.debug("Listing run history auditId={} limit={}", auditId, limit);

        return historyQuery(transactionManager.selectQuery(), auditId, limit)
            .fetch().stream().map(row -> new HistoryRow(row.get(RUN.id), row.get(RUN.status),
                row.get(RUN.createdAt), row.get(RUN.finishedAt),
                row.get(AUDIT_REPORT.id) != null, row.get(AUDIT_REPORT.globalScore))).toList();
    }

    static SQLQuery<Tuple> historyQuery(SQLQuery<?> query, long auditId, int limit) {
        return query
            .select(RUN.id, RUN.status, RUN.createdAt, RUN.finishedAt,
                AUDIT_REPORT.id, AUDIT_REPORT.globalScore)
            .from(RUN)
            .leftJoin(AUDIT_REPORT).on(AUDIT_REPORT.runId.eq(RUN.id))
            .where(RUN.auditId.eq(auditId))
            .orderBy(RUN.createdAt.desc(), RUN.id.desc())
            .limit(limit);
    }

    /** At most two full reports for an explicitly requested comparison. */
    public List<AuditReport> comparisonReports(long auditId, long runId) {
        Instant createdAt = transactionManager.selectQuery().select(RUN.createdAt).from(RUN)
            .where(RUN.id.eq(runId), RUN.auditId.eq(auditId)).fetchOne();
        if (createdAt == null) return List.of();
        return transactionManager.selectQuery().select(AUDIT_REPORT).from(RUN)
            .innerJoin(AUDIT_REPORT).on(AUDIT_REPORT.runId.eq(RUN.id))
            .where(RUN.auditId.eq(auditId), RUN.createdAt.lt(createdAt)
                .or(RUN.createdAt.eq(createdAt).and(RUN.id.loe(runId))))
            .orderBy(RUN.createdAt.desc(), RUN.id.desc()).limit(2).fetch();
    }

    /**
     * Recherche le rapport public associé à un run.
     *
     * @param runId identifiant du run
     * @return Optional contenant l'AuditReport s'il existe
     */
    public Optional<AuditReport> findReportByRunId(long runId) {
        return Optional.ofNullable(transactionManager.selectQuery()
            .select(AUDIT_REPORT)
            .from(AUDIT_REPORT)
            .where(AUDIT_REPORT.runId.eq(runId))
            .fetchOne()
        );
    }

}
