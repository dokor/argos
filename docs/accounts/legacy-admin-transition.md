# Retrait de l’administration historique

La console mono-admin a été retirée du frontend. L’administration utilise désormais un compte Argos ACTIVE avec rôle ADMIN relu en base et une session HttpOnly `argos_account`. Le cookie `argos_admin` et les variables Next `ADMIN_PASSWORD` / `ADMIN_TOKEN` ne donnent plus accès aux fonctions du frontend.

| Ancienne adresse | Destination permanente |
| --- | --- |
| `/dashboard` | `/account/admin` |
| `/dashboard/analytics` | `/account/admin/analytics` |
| `/dashboard/report/{runId}` | `/account/admin/runs/{runId}` |
| `/login` | `/account/sign-in` |

Les pages cibles vérifient la session de compte. La nouvelle administration et la mesure produit existent aussi sous `/en/account/admin`. Une ancienne session mono-admin ne les autorise pas.

La liste globale présente des **runs**, avec filtres et pagination, et non l’ancienne liste d’URLs avec leur dernier run. Ses compteurs sont les volumes globaux en attente/en cours, sans moyenne calculée sur une page de résultats. Les rapports se lisent par ID de run sans reconstruire de credential public.

AuditList, AuditCard, AuditComparison, FilterBar, KpiCard, ScoreChip, StatusBadge, leurs styles, les pages dashboard/login, leurs tests dédiés et leurs traductions sont retirés. Le formulaire propose uniquement les parcours public et personnel. L’historique/comparaison global et l’export du blob technique de la console ne sont plus proposés. L’historique personnel conserve ses règles de propriété et ses propres composants, sans accès global supplémentaire.

## Frontières d’accès

- `GET /api/account/admin/analytics?days=7|30|90` transmet exclusivement le JWT de compte. Java vérifie la signature, les échéances et la révocation de la session, puis le rôle ACTIVE ADMIN courant avant la lecture de métriques.
- Le BFF refuse les paramètres supplémentaires, répétés et les périodes non autorisées. Les réponses privées ne sont pas mises en cache.
- Les anciennes lectures numériques `GET /api/audits` et `GET /api/audits/*` répondent 410 dans Next, avant le rewrite. `POST /api/audits` conserve la validation SSRF et la création publique/personnelle.
- L’ancienne lecture `/api/product-analytics/metrics` et les endpoints Next `/api/auth/login` / `/api/auth/status` sont supprimés.
- Le panneau JSON des rapports utilise le profil du compte, y compris hors du contexte AccountSession. Connexion, déconnexion et focus rafraîchissent ses droits. Aucun statut mono-admin n’est lu.
- Les routes globales Java sous Bearer serveur sont conservées pour les clients opérateurs directs ; elles ne sont plus consommées par le navigateur. Leur suppression est un autre périmètre.

`ADMIN_API_TOKEN` / `admin-api.token` reste nécessaire à la collecte analytics serveur consentie (événements, attribution, vues de rapport). Ce secret n’est ni une identité utilisateur ni le moyen d’autoriser les nouvelles métriques. Ne pas le retirer avec les anciennes variables Next.

## Exploitation

Avant déploiement, activer/configurer les comptes et vérifier qu’un compte ACTIVE ADMIN peut se connecter, accéder aux runs, aux rapports et aux métriques. Prévoir un accès infra indépendant et un mécanisme opérateur de récupération des comptes. Le code ne crée ni ne promeut automatiquement un administrateur.

Retirer `ADMIN_PASSWORD` / `ADMIN_TOKEN` des configurations Next montées lors de la bascule. Les anciens cookies sont ignorés et expireront normalement ; ils ne constituent aucun accès de secours. Conserver une version/configuration compatible pour un retour arrière depuis l’accès infra. Ce changement ne réalise aucune migration SQL, réattribution des runs ni intervention en production.

## Vérifications

Les tests frontend couvrent les listes blanches BFF, les redirections FR/EN, les anciennes lectures fermées, les transitions de rôle/session et les états de métriques : chargement, erreur, vide, rafraîchissement et réponses tardives. Les tests Java avec JWT/session réels vérifient admin, USER, PENDING, ARCHIVED, rôle retiré, expiration, révocation et absence de credential avant le stockage.

Les tests MariaDB du profil `mariadb-integration` et la recette opérateur déployée restent des vérifications distinctes. Les contrôles navigateur locaux emploient uniquement des comptes et mesures fictifs. Voir la [recette comptes](../testing/accounts.md).
