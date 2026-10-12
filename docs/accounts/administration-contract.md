# Administration — milestone 10

L'administration des comptes utilise exclusivement une session Argos ACTIVE avec rôle ADMIN relu côté serveur. L'ancien accès mono-admin reste distinct et ne donne aucun droit sur ces routes.

La [préparation du retrait historique #516](legacy-admin-transition.md) détaille
les routes encore dépendantes du secret partagé, les écarts de parité et les
prérequis opérateur. La transition n'est pas activée par la présence de ces routes.

- `/api/account/admin/users` : recherche nom/email, filtres état/offre, pagination par identifiant décroissant (20 par défaut, 100 maximum).
- `/api/account/admin/users/{id}` : profil minimal, consommation du mois calendaire configuré, plafond individuel éventuel.
- `PATCH /api/account/admin/users/{id}/entitlement` : offre configurée et plafond individuel entier positif ou nul ; `null` rétablit le plafond de l'offre. Le rôle ne peut jamais être modifié. Connexion récente, CSRF et confirmation explicite requis. Compte archivé non modifiable. Effet immédiat sur les nouvelles admissions ; les réservations et rapports existants sont conservés.
- `/api/account/admin/runs` : pagination et filtres utilisateur (ou anonymous), site (nom d'hôte), statut, dates UTC inclusives/exclusives. Chaque ligne est un run, y compris les réanalyses. Aucun blob de rapport ni credential dans les listes.
- `/api/account/admin/queue` : nombres globaux QUEUED/RUNNING, toutes dates, visiteurs et comptes ; aucun délai ou rang promis.
- `/api/account/admin/runs/{id}` et `/report` : détail restreint et rapport privé sans régénération de lien. Les erreurs brutes et URLs avec paramètres ne sont pas exposées ; codes d'échec et statuts des modules suffisent à la consultation.
- `/api/account/admin/events` : journal paginé, auteur/cible/date, ancienne/nouvelle offre et plafond. Écriture atomique avec la modification ; conservation 90 jours, purgée lors des écritures. Aucun texte libre, email, URL, token ou mot de passe.

Les réponses sont privées/no-store, les identifiants sont des chaînes JSON. 401 session invalide, 403 droits/CSRF/réauthentification, 404 ressource absente, 400 filtres ou contenu invalides. Les offres proviennent de `usage.offers`, FREE existe toujours ; aucune valeur commerciale ou facturation ajoutée. Les plafonds restent indépendants des rôles.

La modification d'un autre compte ADMIN est refusée : pas de délégation de gestion entre administrateurs dans ce lot. Chaque administrateur peut ajuster son offre/plafond, sans changement de rôle. Les cibles ordinaires sont verrouillées après l'acteur puis avant le verrou de consommation ; cette restriction évite les prises de verrous croisées entre administrateurs. Le rôle est provisionné par un opérateur de confiance, hors API publique.

## Mise en service

Appliquer V15 après V14 avec Flyway ; les mappings `UsageAccount/QUsageAccount` et `AdminEvent/QAdminEvent` accompagnent la migration. Les plafonds individuels sont initialement NULL : l'admission conserve le comportement précédent. Activer/configurer les comptes selon [operations.md](operations.md), puis attribuer explicitement le rôle ADMIN à un compte ACTIVE vérifié par l'opérateur. Aucun compte de production n'est créé ni promu par cette PR.

Ouvrir `/account/admin` ou `/en/account/admin`, également accessibles depuis la navigation personnelle d'un administrateur. L'ancien `/dashboard` et son cookie mono-admin restent disponibles pour leurs fonctions existantes ; ils ne donnent pas accès à la gestion des comptes. Les KPI de la nouvelle administration sont calculés sur les runs en base, jamais sur une page de résultats.

La fin de période, les réservations et les débits conservent le contrat [usage-contract.md](usage-contract.md). Une baisse du plafond sous l'usage actuel bloque seulement les nouvelles admissions ; elle ne supprime aucun débit ni run. Un envoi identique ne génère pas de second événement. Les listes affichent les hôtes uniquement ; les rapports se consultent sous session administrative par identifiant de run.

Le BFF ne transmet que les routes et paramètres autorisés, construit l'identité depuis le cookie HttpOnly et ignore les en-têtes d'identité du navigateur. Les pages FR/EN sont noindex. Les contrôles d'accès ne dépendent pas de la visibilité du lien dans la navigation.
