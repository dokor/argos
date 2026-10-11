# Conservation et purge limitée — #384

L’opérateur confirme trois ans pour les rapports et 90 jours pour les journaux, puis autorise explicitement une purge limitée en PR le 11 octobre 2026. Aucun déploiement ou intervention en production réalisé ici.

Publication avec expiresAt en années calendaires UTC ; contrôle identique des rapports historiques sans date. Une expiration explicite antérieure prime. Les lectures par token, par run et le polling du rapport expiré sont refusés immédiatement. Paramètre report.retention-years=3, défaut identique dans une configuration externe sans clé. Valeurs admises : 1 à 10 ; une valeur invalide échoue au démarrage. Un changement ne prolonge pas une expiration explicite déjà inscrite.

La tâche horaire sélectionne au plus 500 rapports effectivement expirés, associés uniquement à des runs COMPLETED/FAILED. Verrouillage et transaction unique : effacement result_json, module_statuses, last_error, claim_token, report_token_hash puis suppression du rapport. Aucun run/audit/domaine, cache ou sauvegarde supprimé. Les dates, états, tentatives et associations restent conservés. La révocation du hash empêche de ressusciter la progression après suppression du rapport.

Une défaillance entraîne rollback et nouvelle tentative au tick suivant, sans journaliser données privées. Accès expiré refusé indépendamment du rythme de purge. Les gros volumes peuvent nécessiter plusieurs ticks.

Validation MariaDB réelle : historique sans expires_at, expiration anticipée, année bissextile, protection de run RUNNING, transaction échouée, conservation des métadonnées et absence des deux chemins d’accès. Policy et scheduler testés en unitaire.

La cible de 90 jours pour les journaux est confirmée, mais la configuration effective des rotations Docker/Traefik et des sauvegardes reste non vérifiée. Une limite de taille/nombre de fichiers ne prouve pas une durée maximale. #384 reste ouvert pour ces vérifications et les informations d’opérateur inconnues.
