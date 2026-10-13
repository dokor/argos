# F02 — Cadre et composants Clarté

Lot [#552](https://github.com/dokor/argos/issues/552), dépendant de F01 / PR #562.
Exigences : UI-01, UI-13, QA-01, QA-02 ; contrôle de non-régression QA-15.

## Périmètre implémenté

Les layouts serveur `/account` et `/en/account` partagent `AccountShell`.
Navigation, identité, quota, langue, thème, accès au contenu et footer sont
centralisés. Les pages sites, historique, compte et administration utilisent
ce cadre ; les rapports privés masquent leur en-tête public. Les formulaires
de connexion, inscription, vérification et récupération conservent le cadre public.
Les layouts conservent leurs directives de non-indexation et de confidentialité.

Le menu se replie à 900 px, ferme sur navigation ou Échap et restitue le focus
au bouton. Le compte reste accessible même quand le menu est fermé.
L’administration n’est proposée qu’au profil ADMIN vérifié, avec session active.
Le footer conserve aide, contact, mentions légales et confidentialité dans
les états chargement, erreur, session expirée et indisponibilité d’une ressource.

`PageHeading`, `Surface`, `KpiCard`, `DataTable`, `StatusBadge`, `EmptyState`
et `QuotaSummary` sont partagés, avec SCSS Modules et traductions FR/EN.
Le tableau défile dans une région nommée accessible au clavier. Le quota
utilise le service existant : `max(0, limit - used - reserved)`, illimité
si `limit=null`, message et réessai si indisponible. Aucun quota de démonstration
n’est injecté dans les pages de production.

La page Intégrations comporte une introduction et trois blocs API, CI et
webhooks, marqués « Bientôt », avec exemples repliables. Ils présentent des
usages envisagés, sans création de clé ni activation.

## Frontières et suite des lots

Le cadre visuel ne remplace aucune autorisation Java. Les appels navigateur
restent same-origin ; sessions, CSRF, droits, moteur et calculs restent ceux
des services existants. Aucun schéma ni contrat API n’est modifié dans F02.

La vue d’ensemble et les domaines sont indiqués indisponibles dans le menu
jusqu’à F10 et F09. Leur présence « Bientôt » est transitoire ; la cible reste
une gestion effective des domaines. Le contenu métier des pages existantes
sera repris dans F03/F04/F05/F11. Ce lot ne clôture pas ces écrans.

## Aperçu des composants avec données canoniques

Depuis `apps/console-web`, lancer `npm run dev` avec
`ARGOS_CONNECTED_PREVIEW=1`, puis ouvrir `/account/design-preview`
(ou `/en/account/design-preview`) avec une session de test.
Le serveur de fixtures en lecture du skill `argos-visual-review` peut fournir
le profil fictif via `API_BASE=http://127.0.0.1:3018`.

Cette route lit `fixtures/connected-space.json` côté serveur et affiche
9 URL prioritaires, 3 incomplètes, 68 crédits, un tableau avec score absent,
statuts complets/partiels/échoués, et les composants vide/erreur.
Un bandeau signale les données fictives. Le quota du bandeau global vient
toujours du service de session, indépendamment de cette galerie.
La route est désactivée hors développement même si la variable est présente.
Elle ne remplace pas un dashboard métier et n’apparaît pas dans la navigation.

## Comparaison avec la référence

Comparaison effectuée avec les captures Intégrations 1056/390 et la galerie
de composants. Sidebar 212 px, fond, surfaces, accent, rayons 9 px, marges
28/14 px et ordre des blocs reprennent le contrat visuel. Les tokens sont
redéfinis uniquement sous `.shell`, y compris les rôles de succès et d’alerte
`--argos-connected-success[-bg]` et `--argos-connected-warning[-bg]`.

Écarts explicites :

- Navigation compacte dès 900 px pour garder le diagnostic lisible sur tablette.
- Identité et quota issus des services, contrôles de langue/thème existants,
  marque Argos existante, liens textuels sans nouvelle bibliothèque d’icônes.
- Textes utiles agrandis, cibles de 44 px, états et exemples réellement accessibles.
- Cadre externe arrondi et commandes de démonstration du prototype exclus.
- Navigation vers les futurs modules désactivée plutôt que résultats fictifs.

## Validation reproductible

Vérifications locales réalisées : lint, 520 tests Vitest, 3 tests éditoriaux,
build Next.js, validation du dossier. Neuf tests DOM ciblent le cadre : droits
d’affichage, invalidation de session, quota absent/zéro/illimité, navigation
localisée, fermeture et restitution du focus.

Sur un build de production local, exécuter depuis la racine :

```powershell
$env:CONNECTED_BASE_URL='http://localhost:3021'
node scripts/e2e/connected-shell.mjs
$env:HISTORY_BASE_URL='http://localhost:3021'
node scripts/e2e/account-history.mjs
```

`CLARTE_BROWSER_PATH` peut préciser un Chromium local pour le premier script.
Le script Clarté couvre 84 scénarios : 320/390/768/1056/1440, FR/EN, clair/sombre,
profil standard/non vérifié/admin, quota indisponible/zéro/illimité, session
expirée, erreur et chargement. Il vérifie titres, footer, overflow, menu et
exemples au clavier, et exécute axe sur le cadre. Il contrôle aussi l’absence
de la galerie dans le build de production. L’historique couvre 8 scénarios
avec pagination, relance, clavier, liens localisés et invalidation de session.

Les résultats et captures sont écrits dans `outputs/ui-review/clarte-shell`
et `outputs/account-history`. La CI `Controlled audit E2E` les rejoue et
publie les artefacts `connected-shell-<sha>` et `account-history-<sha>`.
La version de Chromium figure dans `results.json` ; hauteur du viewport : 900 px.
Deux captures représentatives sont versionnées dans [evidence/f02](evidence/f02/README.md).
Ce sont des captures du produit avec réponses API fictives, pas du prototype.

La revue manuelle complémentaire porte sur les exemples, menu, changement de
langue/thème, galerie, administration et diagnostic à largeur intermédiaire.
Les tests mockés prouvent le rendu et les interactions, pas les autorisations
serveur. Ils ne constituent pas une certification WCAG ni une recette du crawler,
des transactions de quota, de l’authentification externe ou du dashboard futur.
