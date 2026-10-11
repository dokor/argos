# Conservation et expiration — #384

L’opérateur confirme trois ans pour les rapports et 90 jours pour les journaux le 11 octobre 2026. Le code implémente la durée d’accès : publication avec expiresAt en années calendaires UTC et contrôle identique des rapports historiques sans date. Une expiration explicite antérieure prime. Les lectures par token, par run et le polling du rapport expiré sont refusés.

Paramètre report.retention-years=3, également utilisé par défaut dans une configuration externe sans cette clé. Valeurs admises : 1 à 10 ; une valeur invalide échoue au démarrage. Un changement ne prolonge pas une expiration explicite déjà inscrite.

ARG_AUDIT_REPORT, ARG_AUDIT_RUN et leurs résultats restent en base. Les métadonnées ARG_AUDIT/ARG_DOMAIN, caches et sauvegardes ne reçoivent aucune suppression. La page de confidentialité expose cette limite et propose le contact pour une demande d’effacement.

La cible de 90 jours pour les journaux est confirmée, mais la configuration effective des rotations Docker/Traefik et des sauvegardes n’est pas vérifiée. Aucun déploiement n’a été réalisé ici. Il reste à inventorier les destinations des journaux, vérifier leurs rotations sur le serveur et distinguer les sauvegardes. Une limite de taille/nombre de fichiers ne prouve pas une durée maximale.

La revue automatique a refusé la purge horaire irréversible proposée pour les runs terminés et leurs rapports, jugeant la durée confirmée insuffisante pour autoriser cette suppression. Aucune requête DELETE de données métier n’est ajoutée ou appliquée. Une autorisation distincte doit préciser rapports, résultats internes, métadonnées et sauvegardes concernés. #384 reste ouvert pour la conservation effective et les informations d’opérateur inconnues.

Validation : tests de l’année bissextile, frontière d’expiration, historiques sans date, expiration explicite antérieure/postérieure et configuration invalide ; tests de lecture et recette MariaDB de publication et expiration.
