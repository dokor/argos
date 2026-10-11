# Mes sites — milestone 7

Base : main 4754f91, epic #445, issues #446–#448.

Les sites sont personnels, regroupés par hostname normalisé exact. HTTP/HTTPS,
chemins, query et ports suivent UrlNormalizer sans nouvelle simplification.
Suivre un hostname ne vérifie pas sa propriété. ARG_AUDIT et ARG_DOMAIN restent
partagés ; seul ARG_AUDIT_RUN.owner_user_id autorise l'accès à un résultat.

Toutes les routes ci-dessous exigent un compte ACTIVE et une session valide.
Les mutations exigent le CSRF existant. Les réponses sont private, no-store.
Les identifiants JSON sont des chaînes et les dates des instants ISO UTC.

| Route sous /api/account | Résultat |
|---|---|
| GET /sites?limit=20&cursor=… | {items: Site[], nextCursor: string ou null} |
| POST /sites, {url} | {site: Site, siteUrlId: string, created: boolean} |
| GET /sites/{id} | Site |
| GET /sites/{id}/urls?limit=20&cursor=… | {items: SiteUrl[], nextCursor: string ou null} |
| POST /sites/{id}/urls, {url} | Même résultat que POST /sites |

Site = siteId, hostname, urlCount, latestActivityAt nullable, latestRunStatus
nullable. L'activité est la date de création de la dernière tentative possédée
sur une URL suivie ; sans tentative elle reste null, même après ajout.

SiteUrl = siteUrlId, auditId, normalizedUrl, latestAttempt nullable,
latestAvailableReport nullable.

latestAttempt = runId, status (QUEUED/RUNNING/COMPLETED/FAILED), createdAt,
finishedAt nullable. Ordre created_at DESC, id DESC, après filtre propriétaire.

latestAvailableReport = runId, publishedAt, expiresAt nullable, globalScore
nullable, provisional nullable. publishedAt est ARG_AUDIT_REPORT.created_at
(publication persistée, pas la date de création du run). Le rapport est
présent, non expiré, et appartient à un run du même propriétaire et de la
même URL. Ordre created_at DESC, id DESC. Une tentative plus récente échouée
ou active ne remplace pas ce rapport. provisional null signifie qualification
historique inconnue. Aucun score de domaine ni score zéro n'est inventé.

Pagination par ID croissant, limite 1–100, défaut 20, lecture limit+1.
Le curseur est l'ID de la dernière relation reçue et doit exister dans la
portée du propriétaire (et du site pour les URL). Aucun ownerId n'est accepté
par le BFF. Les projections SQL ne sélectionnent aucun result_json,
report_json ou token ; provisional est projeté à la publication et repris
une fois par V13.

Le lancement reste POST /api/audits, avec mode frontend personnel explicite
qui refuse une session absente plutôt que lancer anonymement. Le BFF et Java
conservent leurs validations URL. Le rapport s'ouvre avec runId. GET
/account/runs/{id} ajoute siteId nullable après contrôle propriétaire.
Le rapport revalide sa propriété et sa disponibilité lors de chaque lecture.

Erreurs : 401 session invalide/compte archivé ; 403 compte non vérifié ou CSRF ;
404 uniforme pour site/run absent ou d'autrui ; 400 URL, hostname différent,
limite ou curseur invalides ; 429 selon le contrat comptes existant.
Ajouter une URL d'un autre hostname à un site possédé ne modifie rien.
Ajouter ne crée aucun run ; répétition et concurrence sont idempotentes.
Deux lancements volontaires restent deux runs distincts.

## Transactions et reprise

Création connectée et claim ajoutent les relations dans leur transaction
existante. Le verrou compte puis session sérialise les insertions personnelles
d'un propriétaire ; claim conserve ensuite le verrou run. La référence audit
est relue avec LOCK IN SHARE MODE : lecture courante même lorsqu'un DAO global
vient de la créer après établissement du snapshot, sans conversion du verrou
partagé acquis pour la FK. Les contraintes uniques restent le dernier garde-fou.

V12 contient les DDL ; V13 reprend les données par plages d'au plus 1000
runs/rapports, en ordre ID. Les INSERT SELECT agrégés utilisent les contraintes
uniques et ON DUPLICATE KEY UPDATE pour être rejouables après interruption.
Chaque groupe produit une seule relation ; aucun tableau de runs n'est chargé
en mémoire et aucune limite globale ne tronque la reprise. MIN(run.id) dans
la plage fournit les IDs historiques ; les nouveaux IDs suivent Plume.
Les comptes archivés sont repris sans changement d'état et les anonymes ignorés.
Les dates de suivi conservent le minimum historique entre plages.

V13 n'utilise pas une transaction géante ; chaque statement de plage est
committé. Arrêter les écritures applicatives pendant la migration, comme pour
les autres migrations de schéma. La projection provisional des anciens rapports
est également bornée à 1000 lignes par statement. Mesurer la durée totale sur
une copie représentative avant production. Les DDL MariaDB de V12 ont des
commits implicites ; après interruption inspecter Flyway avant réparation.
V13 peut être rejouée sans duplication, après réparation de son état échoué.

## Session et consultation

Un fournisseur client dans le layout serveur partage un seul renouvellement
toutes les dix minutes. Le renouvellement n'actualise pas l'activité métier.
Pas de GET périodique de liste/me pour garder la session active. Un 401 coupe
l'affichage privé et le renouvellement. Les rapports déjà chargés ne sont pas
pollés ; une révocation extérieure est détectée à la prochaine requête privée
ou au renouvellement.

Seul le run affiché est pollé, en séquence, toutes les 1,5 secondes après une
réponse ; pause onglet masqué, annulation au démontage, arrêt terminal et
erreurs permanentes. Au plus trois reprises GET transitoires, avec Retry-After.
Aucune reprise POST automatique. Les retours FR/EN n'acceptent que les routes
exactes compte/sites/sites-ID/runs-ID et les rapports partagés déjà autorisés.

Historique, courbes, quotas, crawl, suppression de site et vérification DNS
restent hors périmètre.
