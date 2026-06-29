package com.dokor.argos.services.domain.domain;

import com.dokor.argos.db.dao.DomainDao;
import com.dokor.argos.db.generated.Domain;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

/**
 * Service métier pour la gestion des domaines.
 * <p>
 * Un domaine représente un hostname unique (ex: {@code example.com}).
 * Il regroupe tous les audits de pages du même site, et porte l'analyse
 * technique partagée (stack, CMS, CDN…).
 */
@Singleton
public class DomainService {

    private static final Logger logger = LoggerFactory.getLogger(DomainService.class);

    private final DomainDao domainDao;

    @Inject
    public DomainService(DomainDao domainDao) {
        this.domainDao = domainDao;
    }

    /**
     * Trouve ou crée le domaine associé à un hostname.
     * <p>
     * Cette opération est idempotente : deux appels avec le même hostname
     * retournent le même domaine (grâce à la contrainte UNIQUE en base).
     *
     * @param hostname hostname normalisé (ex: {@code example.com})
     * @return domaine existant ou nouvellement créé
     */
    public Domain findOrCreate(String hostname) {
        Domain domain = domainDao.findOrCreate(hostname, Instant.now());
        logger.debug("Domain resolved hostname={} domainId={}", hostname, domain.getId());
        return domain;
    }
}
