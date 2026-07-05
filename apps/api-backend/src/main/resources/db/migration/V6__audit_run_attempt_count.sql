-- V6 : compteur de tentatives de traitement pour la reprise des runs interrompus (#127, #211)
--
-- attempt_count : nombre de fois où le run a été pris en charge (claim) pour traitement.
--                 Incrémenté atomiquement à chaque claim (voir AuditRunDao.claimRun).
--                 Sert au reaper de runs bloqués (StuckAuditRunReaper) à décider entre :
--                   - relance (requeue) si attempt_count < audit.scheduler.max-attempts
--                   - abandon (FAILED) si les tentatives sont épuisées

ALTER TABLE ARG_AUDIT_RUN
    ADD COLUMN attempt_count INT NOT NULL DEFAULT 0 AFTER module_statuses;
