# Inventaire factuel — #384, mis à jour le 16 octobre 2026

| Affirmation | Source |
|---|---|
| Opérateur : Antoine Le Louët EI, microentreprise française ; outil d’appui à son activité professionnelle. Serveur principal hébergé par l’opérateur en France métropolitaine | Identité/statut et usage confirmés par l’opérateur le 16 octobre 2026 dans cette tâche ; localisation du serveur principal confirmée le 10 octobre, inchangée par la précision sur le stockage des sauvegardes |
| URL, domaine, états, dates, résultats enregistrés | AuditService, AuditRunService, entités ARG_AUDIT/ARG_AUDIT_RUN/ARG_AUDIT_REPORT |
| Accès par défaut : 3 années calendaires UTC ; purge horaire limitée des rapports expirés et résultats de runs terminés | Réponse opérateur du 11 octobre ; ReportRetentionPolicy ; ReportPublishService écrit expiresAt ; ReportReadService applique aussi le défaut aux historiques ; ReportRetentionService effectue la purge transactionnelle limitée |
| SSL Labs/Observatory reçoivent le domaine | Clients correspondants et ConfigurationService URL par défaut ; configuration production non inspectée |
| Journaux techniques de production et sauvegardes : 3 ans, stockage uniquement local en Belgique, hébergement et administration manuels sans hébergement GAFAM pour ce stockage | Nouvelle confirmation de l’opérateur du 16 octobre 2026 dans cette tâche, remplaçant la cible technique de 90 jours ; déclaration opérateur, aucune inspection de production effectuée |
| Journaux de sécurité de compte : purge après 90 jours à l’écriture suivante | AccountSessionService.event ; distincts des journaux d’infrastructure et des copies de sauvegarde |
| E-mails de compte : SMTP OVH, adresse destinataire + contenu du message (lien/code inclus) | Confirmation opérateur du 16 octobre ; AccountAuthService, AccountEmail, SmtpAccountMail ; aucune durée de conservation OVH annoncée |
| Connexion Google/GitHub/LinkedIn ; identifiant stable, e-mail/état de vérification si disponibles, nom ; jetons non conservés | Fournisseurs confirmés par l’opérateur le 16 octobre ; AccountOAuthClient, AccountOAuthService, ARG_ACCOUNT_IDENTITY ; permissions Google/LinkedIn openid email profile, GitHub read:user user:email |
| Synthèse par possession du lien ; preuves/recommandations détaillées après authentification vérifiée ; partage révocable 7/30 jours ou sans échéance additionnelle, plafonné par la rétention du rapport | ReportsWs, SharedReportsWs, ReportDto.publicSummary, ReportAccessWs, ReportSharingService ; remplacer/révoquer un partage ne révoque pas le lien initial |
| Email newsletter | route BFF newsletter et NewsletterSubscriber |
| Retours Bug/Suggestion/Faux positif privés, textes saisis et référence facultative de rapport ; historique de statut avec ID admin ; 90 jours puis purge horaire | FeedbackService, ARG_FEEDBACK/ARG_FEEDBACK_EVENT, migration V16 ; aucun token, URL ou cookie collecté automatiquement |
| Préférence thème/cookie admin | SiteDocument/ThemeContext existants et login BFF |
| Mesure interne optionnelle, désactivée par défaut, accord explicite, cookie de session, tables propres 90 jours | ProductAnalyticsService, BFF /api/product-analytics, migration V10 ; pas de fournisseur tiers |

## Traçabilité et compléments avant clôture

L’intégration de `main` conserve aussi la divulgation FR/EN de Cloudflare
Turnstile, ajoutée par #686 : protection optionnelle des formulaires sensibles,
preuve non conservée par Argos, échanges IP/signaux navigateur chez le tiers.
Sources : `AntiBotService`, `useAntiBot`, BFF antirobot et configuration
`antibot.enabled`. Cela ne confirme pas son activation en production.

Complément du 16 octobre 2026 (#659 / #662), d'après le code livré :

| Traceur / stockage | Finalité, durée, destinataire et décision |
|---|---|
| `argos_account`, `argos_account_csrf`, session et registre serveur | Authentification et protection CSRF nécessaires ; cookie JWT 15 min renouvelable, session 12 h / inactivité 30 min ; serveur Argos |
| Cookies OAuth `argos_oauth_*`, `argos_return_*`, `argos_intent_*` et `argos_account_return` | Connexion ou liaison demandée : 10 minutes pour les trois cookies OAuth, 24 h pour le retour de compte ; fournisseur choisi contacté seulement lors de la connexion |
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
[traffic-analytics.md](traffic-analytics.md). Les déclarations opérateur sur le stockage sont consignées ci-dessus ; la configuration des tiers et les mécanismes de rotation n’ont pas été inspectés.

Les pages FR/EN publient les faits confirmés, y compris le statut EI, OVH et le stockage belge. Elles ne prétendent pas constituer des mentions légales exhaustives. L’opérateur maintient son refus antérieur de publier une adresse physique ; aucune adresse ni immatriculation n’est inventée. Le numéro d’immatriculation (non fourni), les coordonnées légalement requises et la qualification complète des bases juridiques/transferts/prestataires restent à valider. La confirmation du stockage local n’établit pas la localisation du SMTP ou des fournisseurs OAuth. Les durées de conservation des comptes archivés et métadonnées ne sont pas définies par une purge générale. #384 ne doit donc pas être clôturée automatiquement par cette PR.

Les informations du 16 octobre sont des déclarations directes de l’opérateur dans cette conversation : usage professionnel ; autoentreprise française « Antoine Le Louët EI » ; journaux et sauvegardes locaux en Belgique trois ans ; SMTP OVH ; connexion LinkedIn/GitHub/Google. Elles remplacent les inconnues correspondantes de l’inventaire du 10/11 octobre. Les affirmations publiques n’inventent pas de coordonnées et ne présentent pas cette recette comme une certification juridique.

Références officielles : [mentions d’un entrepreneur](https://entreprendre.service-public.gouv.fr/vosdroits/F31228), [information des personnes](https://www.cnil.fr/fr/informer-les-personnes), [durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees). Ces obligations ne sont pas déduites d’une simple localisation du serveur.

La durée d’accès et la purge limitée sont implémentées : seuls les rapports expirés et leurs résultats internes de runs terminés sont effacés ; métadonnées, caches et sauvegardes conservés. L’accès par possession d’un lien est distinct des directives moteurs (#395). L’instrumentation #42 est décrite dans product-analytics.md et la page de confidentialité. Aucune collecte n’est activée en production par la PR.
