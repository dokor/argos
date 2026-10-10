# Inventaire factuel — #384, 10 octobre 2026

| Affirmation | Source |
|---|---|
| Opérateur/hébergeur Antoine Le Louët, serveur France métropolitaine | Réponse de l’opérateur dans cette tâche |
| URL, domaine, états, dates, résultats enregistrés | AuditService, AuditRunService, entités ARG_AUDIT/ARG_AUDIT_RUN/ARG_AUDIT_REPORT |
| Expiration optionnelle, pas un effacement | ReportReadService.notExpired accepte expiresAt null ; ReportPublishService ne fixe pas expiresAt ; aucune purge trouvée |
| SSL Labs/Observatory reçoivent le domaine | Clients correspondants et ConfigurationService URL par défaut ; configuration production non inspectée |
| Journaux console et durée inconnue | logback.xml STDOUT ; rotation Docker, proxy et sauvegardes non qualifiés |
| Email newsletter | route BFF newsletter et NewsletterSubscriber |
| Préférence thème/cookie admin | SiteDocument/ThemeContext existants et login BFF |
| Pas d’analytics ajouté | #42 plan uniquement |

## Compléments nécessaires avant clôture

La page informations-legales publie les seuls faits confirmés, sans prétendre livrer des mentions légales exhaustives. Aucune adresse physique autorisée à publication. Statut de l’opérateur, coordonnées légalement requises, base du traitement, conservation effective et purge des données/journaux/sauvegardes, configuration réelle des prestataires et transferts restent à qualifier. #384 reste ouvert. Aucun placeholder public ni conformité générique.

Références officielles : [mentions d’un entrepreneur](https://entreprendre.service-public.gouv.fr/vosdroits/F31228), [information des personnes](https://www.cnil.fr/fr/informer-les-personnes), [durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees). Ces obligations ne sont pas déduites d’une simple localisation du serveur.

La FAQ est corrigée pour ne promettre ni TTL ni purge absents. L’accès par possession d’un lien est distinct des directives moteurs (#395). Toute instrumentation future (#42) doit actualiser cet inventaire avant activation.
