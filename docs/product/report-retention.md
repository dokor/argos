# Conservation et expiration — #384

L’opérateur confirme trois ans pour les rapports et 90 jours pour les journaux le 11 octobre 2026. Le code implémente la durée d’accès : publication avec expiresAt en années calendaires UTC et contrôle identique des rapports historiques sans date. Une expiration explicite antérieure prime. Les lectures par token, par run et le polling du rapport expiré sont refusés.

Paramètre report.retention-years=3, également utilisé par défaut dans une configuration externe sans cette clé. Valeurs admises : 1 à 10 ; une valeur invalide échoue au démarrage. Un changement ne prolonge pas une expiration explicite déjà inscrite.

ARG_AUDIT_REPORT, ARG_AUDIT_RUN et leurs résultats restent en base. Les métadonnées ARG_AUDIT/ARG_DOMAIN, caches et sauvegardes ne reçoivent aucune suppression. La page de confidentialité expose cette limite et propose le contact pour une demande d’effacement.

La cible de 90 jours pour les journaux est confirmée, mais la configuration effective des rotations Docker/Traefik et des sauvegardes n’est pas vérifiée. Aucun déploiement n’a été réalisé ici. Il reste à inventorier les destinations des journaux, vérifier leurs rotations sur le serveur et distinguer les sauvegardes. Une limite de taille/nombre de fichiers ne prouve pas une durée maximale.

La revue automatique a refusé la purge horaire irréversible proposée pour les runs terminés et leurs rapports, jugeant la durée confirmée insuffisante pour autoriser cette suppression. Aucune requête DELETE de données métier n’est ajoutée ou appliquée. Une autorisation distincte doit préciser rapports, résultats internes, métadonnées et sauvegardes concernés. #384 reste ouvert pour la conservation effective et les informations d’opérateur inconnues.

Validation : tests de l’année bissextile, frontière d’expiration, historiques sans date, expiration explicite antérieure/postérieure et configuration invalide ; tests de lecture et recette MariaDB de publication et expiration.


## Purge limitée autorisée le 11 octobre 2026
Après revue de la PR sur expiration seule, l’opérateur a explicitement autorisé cette purge dans une PR séparée, sans intervention en production. La tâche horaire sélectionne au plus 500 rapports effectivement expirés (date explicite antérieure ou date de création + durée par défaut), associés uniquement à des runs COMPLETED/FAILED. Verrouillage et transaction unique : effacement result_json, module_statuses, last_error, claim_token, report_token_hash puis suppression du rapport. Aucun run/audit/domaine, cache ou sauvegarde supprimé. Les dates, états, tentatives et associations restent conservés. La révocation du hash empêche de ressusciter la progression après suppression du rapport.

Une défaillance entraîne rollback et nouvelle tentative au tick suivant, sans journaliser données privées. Accès expiré refusé indépendamment du rythme de purge. Les gros volumes peuvent nécessiter plusieurs ticks. Validation MariaDB réelle : historique sans expires_at, expiration anticipée, année bissextile, protection de run RUNNING, transaction échouée, conservation des métadonnées et absence des deux chemins d’accès. La rotation des journaux en production et la durée des sauvegardes restent inconnues ; #384 conserve ces critères ouverts.
