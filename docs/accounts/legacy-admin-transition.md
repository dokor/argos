# Transition de l'administration historique — préparation #516

Inventaire du 13 octobre 2026, base `3ca8de0`. Ce lot prépare la migration de
[#516](https://github.com/dokor/argos/issues/516), à coordonner avec
[#444](https://github.com/dokor/argos/issues/444) et
[#475](https://github.com/dokor/argos/issues/475). Il conserve les mécanismes
actifs : les prérequis de retrait ci-dessous ne sont pas encore satisfaits.
Il n'active pas les comptes et ne comporte aucun déploiement.

## Autorités et consommateurs actuels

`ADMIN_PASSWORD` authentifie l'opérateur dans Next. `ADMIN_TOKEN` est la valeur
du cookie HttpOnly `argos_admin` (30 jours), vérifiée par Next ; ce cookie
n'est pas une session Java. `ADMIN_API_TOKEN` est un Bearer serveur distinct,
vérifié par Java. Il ne constitue pas une identité de compte.

`argos_account` porte le JWT de compte HttpOnly. Le BFF ne transmet que ce
credential en Bearer sur `/api/account/*`, en ignorant les headers d'identité
entrants. Java vérifie signature, échéances JWT/registre/inactivité, révocation,
état courant et rôle relu en base. Le rôle ADMIN exige un compte ACTIVE ;
un compte PENDING, même avec ce rôle, n'accède pas à l'administration.
CSRF/origine et réauthentification récente restent requis pour les mutations
sensibles. Voir [contrat des comptes](contract.md) et
[contrat d'administration](administration-contract.md).

Les cibles ci-dessous sont proposées ; une cible absente n'est pas une route
disponible. Le middleware et les liens sont des aides au parcours ; Java reste
l'autorité même si le navigateur contourne Next.

| Routes / consommateurs | Droit actuel et contrôle | Cible et écart avant retrait |
| --- | --- | --- |
| `/login`, `POST/DELETE /api/auth/login`, `GET /api/auth/status` | Next : password partagé, émission/suppression du cookie, statut comparé à `ADMIN_TOKEN` | Connexion/déconnexion de compte existantes ; retirer ces routes seulement après migration de leurs consommateurs et du secours opérateur |
| `/dashboard`, `/dashboard/analytics`, `/dashboard/report/{runId}` | `middleware.ts` contrôle `argos_admin` ; rapport SSR recontrôlé par `adminReadProxy` | `/account/admin` et `/en/account/admin`, détail `/account/admin/runs/{id}` ; analytics et remplacement complet du dashboard encore à réaliser |
| `GET /api/audits` ; `AuditList`, `Dashboard`, `ArgosApi` | BFF cookie historique → Bearer serveur ; Java `AdminReadAccess` avant lecture globale | Liste globale de runs via `/api/account/admin/runs` (session ACTIVE ADMIN). Les unités diffèrent : un audit/URL avec dernier run versus un run par ligne ; valider filtres, pagination et KPI avant remplacement |
| `GET /api/audits/runs/{id}`, `/report` ; statut et rapport privé du dashboard | BFF historique + contrôle Java Bearer ; aucune autorisation par rôle utilisateur sur ces routes | `/api/account/admin/runs/{id}` et `/report` existent sous session ADMIN ; leurs DTO réduits ne remplacent pas tous les détails techniques du run historique |
| `GET /api/audits/{id}/history`, `/{runId}/comparison` ; `AuditHistory`, `AuditComparison` | Lectures globales BFF historique + Java Bearer | Historique/comparaison admin équivalents à préparer sous contrôle ADMIN Java et BFF. Ne pas utiliser l'historique personnel comme substitut global ni élargir ses règles de propriété |
| `GET /api/product-analytics/metrics?days=7\|30\|90` ; dashboard analytics | `adminReadProxy` puis contrôle du secret dans `ProductAnalyticsService` | Lecture de métriques sous session ADMIN à créer dans Java, liste blanche BFF et écran FR/EN ; ne jamais convertir un JWT utilisateur en Bearer serveur pour contourner Java |
| `/account/admin`, `/en/account/admin`, détails de run et feedback ; `AdminView`, `FeedbackAdmin` | Session de compte ; affichage puis contrôle Java du rôle courant, `AdminService` / `FeedbackService` | Déjà cible pour ces fonctions. Aucun droit accordé par `argos_admin` ou un Bearer de service |
| `/api/account/admin/{users,runs,queue,events,feedback}`, détails et rapports ; PATCH entitlement/feedback | BFF liste blanche + cookie de compte, mutations CSRF ; Java ACTIVE ADMIN, transaction et règles propres à chaque mutation | Conserver ces contrôles ; aucune route publique de promotion de rôle, aucune attribution implicite selon offre ou email |
| `SiteNav` → console ; `PersonalNavigation` → administration | `useIsAdmin` combine statut historique et profil admin du contexte de compte ; `SiteNav` vise toujours `/dashboard`. Navigation personnelle vise `/account/admin` | Résoudre une destination selon le mécanisme réellement autorisé, puis utiliser exclusivement les comptes après bascule. Le contexte de compte n'est pas installé sur toutes les pages publiques |
| `ReportPage` → panneau JSON « données » | Même `useIsAdmin`. Le panneau sérialise le DTO `report` déjà chargé, sans lecture privée additionnelle | Visibilité sous rôle de compte après bascule ; ne pas ajouter de blob privé dans le DTO public. La vue technique des constats est publique par lien et reste distincte de ce panneau |
| `POST /api/product-analytics`, `POST /api/audits`, `GET /api/reports/{token}` instrumentés ; `analytics/server.ts` | Collecte consentie, drapeaux explicites Next/Java, Bearer `ADMIN_API_TOKEN` émis seulement côté serveur | Conserver l'usage serveur séparé ; aucun rôle admin exigé pour l'audit public ou la lecture consentie d'un lien |
| `GET /api/reports/{token}`, `/status`, SSR rapport et vue de progression | Capacité du token opaque ; réponse publique réduite, sans propriétaire/liste/credential | Inchangé : aucune migration du mécanisme admin ne doit élargir les données publiques ni obliger à créer un compte |
| `/api/account/runs`, rapports et historique personnels | Session vérifiée et propriété contrôlée/filtrée en SQL | Inchangé : un admin utilise les routes admin explicites pour les lectures globales |

Sources principales : `src/middleware.ts`, `src/lib/admin-read-proxy.ts`,
`src/lib/account-proxy.ts`, `src/lib/admin-request.ts`, `src/lib/useIsAdmin.ts`,
`src/lib/ArgosApi.ts`, `src/components/site/SiteNav.tsx`, `src/components/account/AccountSession.tsx`,
`src/app/(fr)/report/[token]/ReportPage.tsx` dans `apps/console-web` ;
`AdminReadAccess`, `AdminWs`, `AdminService`, `AccountPermissionProvider`,
`AccountSessionService`, `ProductAnalyticsWs` et `ProductAnalyticsService` dans Java.
Le routage générique Next et Traefik doit aussi être contrôlé : un handler BFF
absent ne doit pas transformer une nouvelle lecture privée en proxy public.

## Prérequis opérateur bloquants

- [ ] Décider explicitement d'activer les comptes, puis satisfaire la
  [recette de mise en service](operations.md) : origine Next/Java, SMTP,
  callbacks OAuth, HTTPS, migrations, registre révocable, dimensionnement et
  validation de #444. La présence du code ou de cette documentation ne vaut
  pas autorisation d'activation.
- [ ] Identifier un opérateur et un compte ACTIVE vérifié ; attribuer ADMIN
  hors API publique, sous accès DB restreint. Vérifier connexion, renouvellement,
  refus après retrait de rôle, révocation et archivage avec le BFF et Java direct.
- [ ] Valider un second accès opérateur et la procédure de récupération sur
  un environnement isolé ; conserver un accès infra/config/DB indépendant de
  l'application. Un compte social seul ne suffit pas si le fournisseur devient
  indisponible ; préparer un moyen de connexion Argos validé selon le contrat.
- [ ] Remplacer tous les usages globaux, historique/comparaison, DTO techniques
  et analytics. Tester la parité fonctionnelle et FR/EN avant de rediriger
  les anciennes pages.
- [ ] Conserver le secours historique tant que les comptes peuvent être
  désactivés sans autre accès opérateur validé. Ne jamais accepter automatiquement
  une session de compte invalide comme une session historique valide.

### Provisionnement et récupération

Aujourd'hui aucune route ne crée ni ne restaure un ADMIN. Après identification
hors bande du compte et vérification de son état ACTIVE, l'opérateur DB peut
promouvoir **uniquement ce compte**, avec une requête paramétrée exécutée dans
une transaction ; l'exemple désigne un paramètre, pas un ID de production :

```sql
START TRANSACTION;
SELECT id, state, role FROM ARG_ACCOUNT_USER WHERE id = :operator_id FOR UPDATE;
UPDATE ARG_ACCOUNT_USER SET role = 'ADMIN'
WHERE id = :operator_id AND state = 'ACTIVE' AND role = 'USER';
COMMIT;
```

Contrôler la ligne choisie et le nombre de lignes affectées ; si l'identité ou
l'état ne convient pas, effectuer ROLLBACK. Cette opération ne vérifie pas
l'email, ne réactive pas un compte ARCHIVED et ne change pas l'offre. Consigner
l'intervention dans le journal opérateur restreint (sans secrets). La promotion
hors application n'émet pas automatiquement un `ARG_ADMIN_EVENT`.

En cas de perte du moyen de connexion, utiliser la récupération Argos existante
si le compte est ACTIVE et le canal email vérifié disponible. Elle n'attribue
pas de rôle et ne restaure pas un compte archivé. Si l'admin est archivé ou
indisponible, passer par le second opérateur ou provisionner un autre compte
ACTIVE après vérification hors bande ; ne pas modifier son état pour contourner
les règles d'archivage. En cas de compromission, révoquer ses sessions dans le
registre et retirer le rôle sous procédure opérateur avant de restaurer l'accès.

Si `account.enabled=false`, les routes privées de comptes renvoient `account_unavailable`.
Le chemin utilisable actuellement est `/login` → `/dashboard` avec les secrets
historiques montés et le Bearer serveur concordant ; il n'ouvre pas la gestion
des comptes. Garder ces fonctions administratives disponibles jusqu'à décision
explicite sur un secours après retrait. Le dépôt ne possède pas encore de
commande de récupération indépendante remplaçant ce chemin : son absence
interdit le retrait définitif.

## Bascule proposée et retour arrière

1. **Préparation (ce lot).** Conserver routes, cookies, secrets et drapeaux.
   Exécuter les tests ci-dessous ; enregistrer les écarts dans la PR.
2. **Parité.** Ajouter uniquement les lectures admin manquantes avec le service
   de sessions existant et une liste blanche BFF. Contrôler rôle/registre dans
   Java et recontrôler chaque mutation dans sa transaction. Ne pas envoyer
   `ADMIN_API_TOKEN` après un simple contrôle de rôle Next. Valider les champs
   privés, pagination, comparaisons, SSR et réponses no-store.
3. **Recette opérateur.** Vérifier les prérequis et le second accès ; tester
   compte désactivé, JWT expiré, révocation, changement de rôle et récupération.
   Éprouver le retour arrière avant tout changement de routage.
4. **Bascule des consommateurs, dans un lot réversible.** Navigation et panneau
   de données utilisent le rôle de compte ; liens globaux visent l'administration
   de compte. Redirections prévues : `/dashboard` → `/account/admin`, détail
   → `/account/admin/runs/{id}` et analytics → écran équivalent validé. Les
   destinations EN utilisent `/en/account/...`. Une session manquante/expirée
   dirige vers la connexion localisée avec une destination interne contrôlée ;
   un utilisateur non-admin reçoit un refus, jamais une boucle de connexion.
   `safeAccountReturn` refuse actuellement `/account/admin` : étendre sa liste
   blanche et tester les variantes FR/EN avant de promettre ce retour.
5. **Retrait dans une PR distincte.** Après preuves de disparition de tous les
   consommateurs et validation du secours indépendant, retirer `/login`,
   `/api/auth/login`, `/api/auth/status`, le contrôle historique du middleware,
   `useIsAdmin` historique et `adminReadProxy` historique. Expirer `argos_admin`
   avec son Path `/` ; un cookie résiduel ne doit plus autoriser de route.
   Retirer `ADMIN_PASSWORD` et `ADMIN_TOKEN` des fichiers montés et exemples.
   Ne pas supprimer globalement `ADMIN_API_TOKEN`.

Avant l'étape 5, le rollback consiste à restaurer la version applicative
précédente et ses secrets historiques montés, puis vérifier `/login`, les
lectures globales et les métriques ; renouveler le cookie si son secret a
changé. Désactiver les comptes uniquement par décision explicite, tout en
gardant l'accès historique opérationnel. Révoquer les sessions compromises,
sans changer la propriété des runs ni les liens partagés. Aucune migration SQL
destructive n'est requise par cette préparation ; ne pas annuler les migrations
de comptes pour revenir au dashboard.

Après retrait, restaurer une version/configuration compatible depuis l'accès
infra indépendant, avec secrets issus du gestionnaire de secrets, si le secours
validé l'exige. Conserver cette version et tester sa compatibilité avec le schéma
avant retrait ; ne pas compter sur un ancien cookie ou un compte archivé.

## Credential de collecte analytics

`ADMIN_API_TOKEN` / `admin-api.token` sert aujourd'hui à la fois aux lectures
historiques et à la collecte serveur consentie : événements, attribution d'un
audit consenti et affichage de rapport. Le secret n'est jamais remis au
navigateur ; un cookie admin n'est pas nécessaire pour consentir ou auditer.
Les métriques restent une **lecture administrative** distincte de la collecte.

À la cible, les métriques utiliseront la session ADMIN. Le Bearer serveur doit
rester configuré pour la collecte tant qu'elle l'utilise. Une séparation en
credential analytics à portée dédiée nécessiterait un contrat/configuration
et des contrôles Java/BFF propres ; aucune variable de ce type n'est
implémentée ici. Ne pas la simuler en renommant le secret ou en laissant les
métriques publiques. Voir [mesure produit](../product/product-analytics.md).

## Vérifications et conditions de retrait

Les tests ajoutés figent les frontières actuelles pour rendre le prochain lot
reviewable ; ils ne certifient pas une migration déployée.

| Couche | Preuve automatisée | Limite |
| --- | --- | --- |
| BFF global et métriques | `admin-access-boundaries.test.ts`, `admin-read-proxy.test.ts` : cookie absent/faux, compte sans cookie historique refusé, Bearer entrant ignoré, pas de cache partagé | Réponses Java simulées côté BFF |
| BFF compte | `admin-access-boundaries.test.ts`, `account-proxy.test.ts` : ancien cookie sans identité de compte, refus 401/403/503 relayés, cookie effacé sur 401, CSRF et liste blanche | Le rôle et la révocation sont contrôlés par Java, pas validés localement par le BFF |
| Java | `AccountAdminAccessTest` : signature réelle, admin courant, rôle retiré, PENDING/ARCHIVED, JWT/registre/inactivité expirés, révocation ; `AuditAccessHttpTest` : HTTP direct sur routes globales | Registre simulé dans le test unitaire |
| Java + MariaDB | `AccountLifecycleIT.administrationHttpDeniesEveryReadToNonAdminsAndHonorsRevocation`, tests d'expiration/archivage et mutations | Nécessite la fixture locale et le profil `mariadb-integration` ; à exécuter avant bascule |
| Navigation/données | `useIsAdmin.dom.test.tsx`, `AdminView.dom.test.tsx`, `SiteNav.dom.test.tsx` et tests de destinations/redirections FR/EN | Le dashboard historique n'a pas de route EN ; la recette navigateur de la cible demeure requise |
| Collecte | `analytics.test.ts`, `ProductAnalyticsServiceTest` | Ne prouve ni la config de production ni un credential à portée dédiée |

Commandes : depuis `apps/console-web`, `npx vitest run`, `npm run lint`,
`npm run build` ; depuis `apps/api-backend`, `mvn -Duser.timezone=UTC test` puis
`mvn -Duser.timezone=UTC -P mariadb-integration -Dit.test=AccountLifecycleIT verify`.
Les commandes et résultats réellement exécutés figurent dans la PR.
La [recette comptes](../testing/accounts.md) fournit la fixture navigateur.

Avant retrait, refaire l'inventaire avec `rg` sur `ADMIN_PASSWORD`, `ADMIN_TOKEN`,
`argos_admin`, `useIsAdmin`, `adminReadProxy`, `/api/auth/`, `/login`, `/dashboard`
dans les sources, tests, scripts, Compose, configurations montées et clients
opérateurs. Classer chaque occurrence restante (redirection, cookie à expirer,
test de refus ou consommateur actif) ; une absence dans `src` seule ne suffit
pas. Chercher `ADMIN_API_TOKEN` séparément et conserver les consommateurs de
collecte identifiés. Toute lecture globale restante bloque la suppression.

Recette bloquante : visite anonyme, compte PENDING, USER, ADMIN, rôle retiré,
JWT expiré et session révoquée sur chaque lecture/mutation, via Next et Java
direct ; headers/cookies forgés ; pages FR/EN et retour après connexion ;
absence de données privées après refus ; rapport partagé conservé sans données
supplémentaires ; comptes désactivés et récupération opérateur ; analytics
collectée uniquement après accord et métriques jamais publiques. Ajouter mobile,
clavier, thèmes et noindex lors du changement effectif des écrans.
