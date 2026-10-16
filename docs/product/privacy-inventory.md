# Inventaire factuel — #384, 10 octobre 2026

| Affirmation | Source |
|---|---|
| Opérateur/hébergeur Antoine Le Louët, serveur France métropolitaine | Réponse de l’opérateur dans cette tâche |
| URL, domaine, états, dates, résultats enregistrés | AuditService, AuditRunService, entités ARG_AUDIT/ARG_AUDIT_RUN/ARG_AUDIT_REPORT |
| Accès par défaut : 3 années calendaires UTC ; purge horaire limitée des rapports expirés et résultats de runs terminés | Réponse opérateur du 11 octobre ; ReportRetentionPolicy ; ReportPublishService écrit expiresAt ; ReportReadService applique aussi le défaut aux historiques ; ReportRetentionService effectue la purge transactionnelle limitée |
| SSL Labs/Observatory reçoivent le domaine | Clients correspondants et ConfigurationService URL par défaut ; configuration production non inspectée |
| Journaux : cible de 90 jours ; application et sauvegardes non vérifiées | Réponse opérateur du 11 octobre ; logback.xml STDOUT ; rotations Docker/proxy et sauvegardes non inspectées |
| Email newsletter | route BFF newsletter et NewsletterSubscriber |
| Retours Bug/Suggestion/Faux positif privés, textes saisis et référence facultative de rapport ; historique de statut avec ID admin ; 90 jours puis purge horaire | FeedbackService, ARG_FEEDBACK/ARG_FEEDBACK_EVENT, migration V16 ; aucun token, URL ou cookie collecté automatiquement |
| Préférence thème/cookie admin | SiteDocument/ThemeContext existants et login BFF |
| Mesure interne optionnelle, désactivée par défaut, accord explicite, cookie de session, tables propres 90 jours | ProductAnalyticsService, BFF /api/product-analytics, migration V10 ; pas de fournisseur tiers |

## Compléments nécessaires avant clôture

Complément du 16 octobre 2026 (#659 / #662), d'après le code livré :

| Traceur / stockage | Finalité, durée, destinataire et décision |
|---|---|
| `argos_account`, `argos_account_csrf`, session et registre serveur | Authentification et protection CSRF nécessaires ; cookie JWT 15 min renouvelable, session 12 h / inactivité 30 min ; serveur Argos |
| Cookies OAuth `argos_oauth_*`, `argos_return_*`, `argos_intent_*` et retour de compte | Connexion ou liaison demandée, cookies bornés dans account-proxy ; fournisseur choisi contacté seulement lors de la connexion |
| Preuve `argos_run_*` / `argos_account_claims` | Revendication d'une analyse, 24 h, HttpOnly ; nécessaire au parcours demandé |
| Cookie admin historique, préférence thème | Session admin et préférence d'affichage ; aucune audience dérivée |
| `argos_product_consent` | Choix de mesure produit, session, HttpOnly Strict ; accord explicite, désactivé par défaut |
| `argos_traffic_consent_v1`, `argos_traffic_visit` | Choix audience et booléen de première visite, session, HttpOnly Strict ; consentement séparé avant collecte FR/BE, retrait supprime le marqueur |
| Compteurs de fréquentation dans ARG_PRODUCT_EVENT_COUNT | Routes publiques et catégories fermées, 90 jours avec purge horaire ; serveur Argos, sans IP, compte, URL libre, empreinte ou destinataire tiers |
| ARG_ACCOUNT_NOTIFICATION | Suivi privé du service demandé, références/domaine/type/dates/lecture, 90 jours et purge horaire ; aucune donnée transmise à un fournisseur |

Pas de SDK analytics tiers ni de stockage local ajouté. Les liens externes
(Calendly, email, réseaux sociaux) sont des navigations à l'initiative de la
personne, pas des scripts de mesure embarqués. Le consentement existant devient
une gestion de préférences à deux finalités, avec refus équivalent, choix
granulaire et retrait persistant via « Gérer mes cookies » lorsque configuré.
La revue juridique et les limites de couverture sont précisées dans
[traffic-analytics.md](traffic-analytics.md). La localisation effective des
services, rotations et sauvegardes de production n'a pas été inspectée.

La page informations-legales publie les seuls faits confirmés, sans prétendre livrer des mentions légales exhaustives. Aucune adresse physique autorisée à publication. Statut de l’opérateur, coordonnées légalement requises, base du traitement, conservation effective et purge des données/journaux/sauvegardes, configuration réelle des prestataires et transferts restent à qualifier. #384 reste ouvert. Aucun placeholder public ni conformité générique.

Références officielles : [mentions d’un entrepreneur](https://entreprendre.service-public.gouv.fr/vosdroits/F31228), [information des personnes](https://www.cnil.fr/fr/informer-les-personnes), [durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees). Ces obligations ne sont pas déduites d’une simple localisation du serveur.

La durée d’accès et la purge limitée sont implémentées : seuls les rapports expirés et leurs résultats internes de runs terminés sont effacés ; métadonnées, caches et sauvegardes conservés. L’accès par possession d’un lien est distinct des directives moteurs (#395). L’instrumentation #42 est décrite dans product-analytics.md et la page de confidentialité. Aucune collecte n’est activée en production par la PR.
