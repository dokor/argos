# Administration — F11

La refonte Clarté est décrite dans [le dossier F11](../connected-space/administration-f11.md).

L'administration des comptes utilise exclusivement une session Argos ACTIVE avec rôle ADMIN relu côté serveur. L'ancien accès mono-admin reste distinct et ne donne aucun droit sur ces routes.

La [préparation du retrait historique #516](legacy-admin-transition.md) détaille
le retrait de la console historique et les prérequis opérateur avant déploiement.
La mesure produit est disponible dans `/account/admin/analytics` et sa variante EN.

- `/api/account/admin/users` : recherche nom/email, filtres état/offre, pagination par identifiant décroissant (20 par défaut, 100 maximum).
- `/api/account/admin/users/{id}` : profil minimal, consommation du mois calendaire configuré, plafond individuel éventuel.
- `PATCH /api/account/admin/users/{id}/entitlement` : offre configurée et plafond individuel entier positif ou nul ; `null` rétablit le plafond de l'offre. Le rôle ne peut jamais être modifié. Connexion récente, CSRF, `expectedVersion`, `reasonCode` contrôlé et `confirmation:true` requis. 409 pour version périmée ou plafond effectif inférieur à consommé + réservé. Compte archivé non modifiable. Effet immédiat sur les nouvelles admissions ; les réservations et rapports existants sont conservés.
- `/api/account/admin/runs` : pagination et filtres utilisateur (ou anonymous), site (nom d'hôte), statut, dates UTC inclusives/exclusives. Chaque ligne est un run, y compris les réanalyses. Aucun blob de rapport ni credential dans les listes.
- `/api/account/admin/queue` : nombres globaux QUEUED/RUNNING, toutes dates, visiteurs et comptes ; aucun délai ou rang promis.
- `/api/account/admin/runs/{id}` et `/report` : détail restreint et rapport privé sans régénération de lien. Les erreurs brutes et URLs avec paramètres ne sont pas exposées ; codes d'échec et statuts des modules suffisent à la consultation.
- `/api/account/admin/events` : journal paginé, auteur/cible/date, ancienne/nouvelle offre et plafond. Écriture atomique avec la modification ; conservation 90 jours, purgée lors des écritures. Aucun texte libre, email, URL, token ou mot de passe.

Les réponses sont privées/no-store, les identifiants sont des chaînes JSON. 401 session invalide, 403 droits/CSRF/réauthentification, 404 ressource absente, 400 filtres ou contenu invalides. Les offres proviennent de `usage.offers`, FREE existe toujours ; aucune valeur commerciale ou facturation ajoutée. Les plafonds restent indépendants des rôles.

La modification d'un autre compte ADMIN est refusée : pas de délégation de gestion entre administrateurs dans ce lot. Chaque administrateur peut ajuster son offre/plafond, sans changement de rôle. Les cibles ordinaires sont verrouillées après l'acteur puis avant le verrou de consommation ; cette restriction évite les prises de verrous croisées entre administrateurs. Le rôle est provisionné par un opérateur de confiance, hors API publique.

## Mise en service

Appliquer V15 après V14 avec Flyway ; les mappings `UsageAccount/QUsageAccount` et `AdminEvent/QAdminEvent` accompagnent la migration. Les plafonds individuels sont initialement NULL : l'admission conserve le comportement précédent. Activer/configurer les comptes selon [operations.md](operations.md), puis attribuer explicitement le rôle ADMIN à un compte ACTIVE vérifié par l'opérateur. Aucun compte de production n'est créé ni promu par cette PR.

Ouvrir `/account/admin` ou `/en/account/admin`, également accessibles depuis la navigation personnelle d'un administrateur. Les anciennes adresses `/dashboard` et `/login` redirigent vers les pages de compte ; le cookie mono-admin ne donne plus aucun accès dans Next. Les KPI de la nouvelle administration sont calculés sur les runs en base, jamais sur une page de résultats.

La fin de période, les réservations et les débits conservent le contrat [usage-contract.md](usage-contract.md). Une baisse du plafond effectif sous les crédits consommés + réservés est refusée avec 409 ; elle ne modifie aucun débit ni run. Un envoi identique avec la version courante ne génère pas de second événement ; une ancienne version renvoie 409. Les listes affichent l’hôte exact et une URL projetée sans données sensibles ; les rapports se consultent sous session administrative par identifiant de run.

Le BFF ne transmet que les routes et paramètres autorisés, construit l'identité depuis le cookie HttpOnly et ignore les en-têtes d'identité du navigateur. Les pages FR/EN sont noindex. Les contrôles d'accès ne dépendent pas de la visibilité du lien dans la navigation.

F11 ajoute `POST /api/account/admin/users/{id}/suspension`, `/entitlement-options` et le journal par compte `/users/{id}/events`. Suspension interdite sur soi et tout ADMIN ; reprise sans restaurer de session. V26 remplace la contrainte d’état et ajoute version/état antérieur/motif/états du journal. Le journal conserve les champs NULL des événements antérieurs sans inventer de valeurs. La liste accepte désormais SUSPENDED.

## Liste des analyses — #655

Les lignes restent des runs individuels. Elles distinguent l’hôte exact de displayUrl, une projection serveur qui supprime requête et fragment, refuse credentials, ports non normalisés et hôtes internes, et masque routes de rapport et jetons opaques. rawTarget ne fait jamais partie de la réponse. Pour un enfant de lot, batchId/pageCount indiquent « Analyse de domaine » et le détail contient batchPages, les URL affichables des runs concernés. L’URL d’une page ne représente donc jamais tout le lot.

La résolution d’identité utilise une jointure unique, sans requête par ligne ; resolvedUserId autorise le lien vers la fiche. Un compte archivé ou absent reste non résolu (ID secondaire), un propriétaire null est anonyme. Les choix de filtres passent par GET /api/account/admin/run-options?kind=site|user&q=…&limit=20&cursor=… : recherche serveur, limite 100, pagination par ID, utilisateurs archivés exclus. Les valeurs choisies et les dates restent dans l’URL de la liste, le curseur est réinitialisé à l’application des filtres et returnTo conserve le contexte du détail. Tous les accès exigent la session administrateur.
