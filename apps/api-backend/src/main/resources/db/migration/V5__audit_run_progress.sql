-- V5 : ajout du suivi de progression par module sur ARG_AUDIT_RUN
--
-- report_token  : token public pré-généré à la création du run (avant publication).
--                 Permet de rediriger le frontend vers /report/{token} immédiatement,
--                 même si l'analyse n'est pas encore terminée.
--
-- module_statuses : JSON array des statuts par module.
--                   Exemple : [{"id":"http","label":"HTTP & Sécurité","status":"PENDING"}, …]
--                   Valeurs possibles : PENDING | RUNNING | COMPLETED | FAILED | SKIPPED

ALTER TABLE ARG_AUDIT_RUN
    ADD COLUMN report_token    VARCHAR(64)   NULL AFTER claim_token,
    ADD COLUMN module_statuses TEXT          NULL AFTER report_token;

CREATE INDEX idx_run_report_token ON ARG_AUDIT_RUN (report_token);
