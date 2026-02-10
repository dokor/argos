package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.QAudit;
import com.dokor.argos.db.generated.QAuditRun;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.NumberExpression;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

import static com.querydsl.core.types.dsl.Expressions.numberTemplate;

/**
 * DAO responsable de la table ARG_AUDIT.
 * <p>
 * Cette table représente un audit logique d’URL :
 * - une URL brute fournie par l’utilisateur
 * - une URL normalisée (clé fonctionnelle)
 * - un hostname
 * <p>
 * Convention du projet :
 * - une URL normalisée ne doit exister qu’une seule fois en base
 * - cette règle est garantie à la fois :
 * - par un index unique en base
 * - par les méthodes de ce DAO
 */
@Singleton
public class AuditDao extends CrudDaoQuerydsl<Audit> {

    private static final Logger logger = LoggerFactory.getLogger(AuditDao.class);
    private static final QAudit AUDIT = QAudit.audit;
    private static final QAuditRun RUN = QAuditRun.auditRun;

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

    /**
     * Liste des audits avec leur dernier run (par id max, simple MVP).
     *
     * @param limit nombre max de lignes
     */
    public List<Tuple> listAuditsWithLatestRun(int limit) {
        logger.debug("Listing audits with latest run limit={}", limit);

        return transactionManager.selectQuery()
            .select(AUDIT, RUN)
            .from(AUDIT)
            .leftJoin(RUN).on(RUN.auditId.eq(AUDIT.id))
            .orderBy(AUDIT.createdAt.desc())
            .limit(limit)
            .fetch();
    }

}
