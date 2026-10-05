package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.Domain;
import com.dokor.argos.db.generated.QDomain;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.time.Instant;
import java.util.Optional;

/**
 * DAO responsable de la table ARG_DOMAIN.
 * <p>
 * Un domaine représente un hostname unique (ex: {@code example.com}).
 * Plusieurs audits (pages différentes du même site) partagent le même domaine.
 */
@Singleton
public class DomainDao extends CrudDaoQuerydsl<Domain> {

    private static final QDomain DOMAIN = QDomain.domain;

    @Inject
    public DomainDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, DOMAIN);
    }

    /**
     * Recherche un domaine par son hostname exact.
     *
     * @param hostname hostname normalisé (ex: {@code example.com})
     * @return Optional contenant le domaine s'il existe
     */
    public Optional<Domain> findByHostname(String hostname) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(DOMAIN)
                .from(DOMAIN)
                .where(DOMAIN.hostname.eq(hostname))
                .fetchOne()
        );
    }

    /**
     * Trouve ou crée un domaine pour un hostname donné.
     * <p>
     * L'index unique arbitre les insertions concurrentes. Après rollback d'une
     * insertion perdante, une nouvelle connexion relit le domaine gagnant.
     *
     * @param hostname  hostname normalisé (ex: {@code example.com})
     * @param createdAt timestamp de création si insertion nécessaire
     * @return domaine existant ou nouvellement créé
     */
    public Domain findOrCreate(String hostname, Instant createdAt) {
        return findByHostname(hostname).orElseGet(() -> {
            Domain d = new Domain();
            d.setHostname(hostname);
            d.setCreatedAt(createdAt);
            try { return save(d); }
            catch (RuntimeException conflict) {
                if (!UniqueInsertConflict.isDuplicate(conflict)) throw conflict;
                return findByHostname(hostname).orElseThrow(() -> conflict);
            }
        });
    }
}
