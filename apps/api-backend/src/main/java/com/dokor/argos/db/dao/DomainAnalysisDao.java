package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.DomainAnalysis;
import com.dokor.argos.db.generated.QDomainAnalysis;
import com.dokor.argos.db.generated.QDomain;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.sql.Connection;
import java.time.Instant;
import java.util.Optional;
import java.util.function.Function;

/**
 * DAO responsable de la table ARG_DOMAIN_ANALYSIS.
 * <p>
 * Chaque entrée représente le résultat du module "tech" pour un domaine donné,
 * avec une date d'expiration (TTL) permettant de décider si le cache est encore valide.
 */
@Singleton
public class DomainAnalysisDao extends CrudDaoQuerydsl<DomainAnalysis> {

    private static final QDomainAnalysis DA = QDomainAnalysis.domainAnalysis;
    private static final QDomain DOMAIN = QDomain.domain;

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
    public <T> T withLockedDomain(long domainId, Function<Connection, T> action) {
        return transactionManager.executeAndReturn(connection -> {
            Long lockedId = transactionManager.selectQuery(connection).select(DOMAIN.id)
                .from(DOMAIN).where(DOMAIN.id.eq(domainId)).forUpdate().fetchOne();
            if (lockedId == null) throw new IllegalStateException("Domain missing: " + domainId);
            return action.apply(connection);
        });
    }

    public Optional<DomainAnalysis> findFreshByDomainId(long domainId, Connection connection) {
        Instant now = Instant.now();
        return Optional.ofNullable(
            transactionManager.selectQuery(connection)
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
    public void deleteByDomainId(long domainId, Connection connection) {
        transactionManager.delete(DA, connection)
            .where(DA.domainId.eq(domainId))
            .execute();
    }
}
