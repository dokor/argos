package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.DomainAnalysis;
import com.dokor.argos.db.generated.QDomainAnalysis;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.time.Instant;
import java.util.Optional;

/**
 * DAO responsable de la table ARG_DOMAIN_ANALYSIS.
 * <p>
 * Chaque entrée représente le résultat du module "tech" pour un domaine donné,
 * avec une date d'expiration (TTL) permettant de décider si le cache est encore valide.
 */
@Singleton
public class DomainAnalysisDao extends CrudDaoQuerydsl<DomainAnalysis> {

    private static final QDomainAnalysis DA = QDomainAnalysis.domainAnalysis;

    @Inject
    public DomainAnalysisDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, DA);
    }

    /**
     * Retourne l'analyse de domaine la plus récente et encore valide (non expirée).
     *
     * @param domainId identifiant du domaine
     * @return Optional contenant l'analyse si elle existe et n'est pas expirée
     */
    public Optional<DomainAnalysis> findFreshByDomainId(long domainId) {
        Instant now = Instant.now();
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(DA)
                .from(DA)
                .where(
                    DA.domainId.eq(domainId),
                    DA.expiresAt.gt(now)
                )
                .orderBy(DA.analyzedAt.desc())
                .limit(1)
                .fetchOne()
        );
    }

    /**
     * Supprime toutes les analyses (expirées ou non) pour un domaine.
     * Utilisé avant d'insérer un nouveau résultat pour garder la table propre.
     *
     * @param domainId identifiant du domaine
     */
    public void deleteByDomainId(long domainId) {
        transactionManager.delete(DA)
            .where(DA.domainId.eq(domainId))
            .execute();
    }
}
