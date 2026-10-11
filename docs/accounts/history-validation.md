# Historique privé par URL — milestone 9

Les issues #454, #455 et #456 étendent les comptes et Mes sites existants.
L’historique appartient au compte, même lorsque plusieurs comptes suivent la
même URL. Aucun historique public par domaine n’est ajouté.

## Contrat

`GET /api/account/urls/{siteUrlId}/history?limit=20&cursor={runId}` vérifie la
session et la propriété de l’URL. La taille doit être comprise entre 1 et 100.
L’ordre est `created_at DESC, id DESC` ; le curseur doit être un run du même
compte et de la même URL. Un élément supplémentaire permet de calculer la
comparaison à la frontière de page et le curseur suivant.

La réponse contient le contexte de navigation, les tentatives, les dates, la
disponibilité du rapport, le score publié, la version de scoring, la couverture
pondérée et le contrat de comparaison existant. Le serveur extrait uniquement
l’URL et les scores du JSON figé pour comparer ; ni les tokens, ni les résultats
techniques, ni le rapport complet ne sont envoyés dans la liste.

Les comparaisons concernent des tentatives adjacentes. Une tentative sans
rapport disponible crée une rupture. Un rapport expiré est traité comme
indisponible, même avant sa purge. Les rapports historiques sans preuves restent
lisibles sans être recalculés ; leurs métadonnées manquantes restent inconnues.
`AuditComparisonService` décide seul de la comparabilité. Le frontend masque
tout delta et tout segment de courbe lorsque le motif n’est pas `COMPARABLE`.

`GET /api/account/report-context/{token}` exige également une session vérifiée,
un rapport disponible et un run appartenant au compte. Un lien partagé ne donne
donc aucun accès à l’historique d’autrui. Les routes passent par le BFF, transmettent
uniquement l’identité du cookie de session et répondent `private, no-store`.

## Parcours

Mes sites → une URL → Historique → ancien rapport → historique ou relance.
Routes FR `/account/urls/{id}/history` et EN `/en/account/urls/{id}/history`.
Le graphique représente la page courante ; la liste donne les mêmes scores et
leurs dates sous forme textuelle, avec couverture, méthode et motif de non-comparaison.
La pagination permet de lire les plus anciennes analyses puis de revenir aux plus récentes.

La relance préremplit exactement l’URL normalisée et utilise le formulaire
personnel existant : CSRF, SSRF BFF/backend et limites du compte sont conservés.
Les routes personnelles héritent des métadonnées `noindex` et `no-referrer`.
Aucune migration, recalculation ni modification d’un ancien rapport.

## Validation

- Build Next.js de production exécuté avec succès le 11 octobre 2026.
- 322 tests frontend réussis, dont 68 tests ciblés : BFF, historique, navigation, relance,
  révocation, pagination, courbe interrompue, FR/EN, états vides et erreurs.
- ESLint ciblé sur les nouveaux composants et contrats : réussi.
- `mvn test` : 638 tests réussis, 1 test conditionnel ignoré. Les tests MariaDB ne sont pas exécutés par cette commande.
- Deux scénarios ajoutés à `AccountLifecycleIT`, inclus dans le workflow MariaDB :
  isolation compte/URL/curseur, dates identiques, limites, absence de session,
  confidentialité de la réponse, scores figés, comparaison entre pages,
  changement de méthode et expiration.
- CI sur `008c856` : backend, frontend et intégration MariaDB réussis.
- Huit scénarios Playwright : 320/1280 px × FR/EN × clair/sombre ; absence de
  débordement horizontal et d’erreur JavaScript, formulaire prérempli activé au
  clavier, pagination, révocation et zéro violation axe WCAG A/AA sur `main`.
  Les API sont simulées dans ce test visuel ; les contrôles SQL sont testés
  séparément dans MariaDB. Script `scripts/e2e/account-history.mjs`, captures et
  résultat JSON conservés par le workflow Controlled audit E2E.

La suite globale contenait deux échecs préexistants dans ReportConsistency : le
statut de partage ajouté dans le hero rendait les sélecteurs `getByRole("status")`
ambigus. Les tests ciblent maintenant le texte du compteur et vérifient son rôle,
sans modifier le comportement du rapport.

Pour exécuter ces scénarios, préparer la base jetable de
[mariadb.md](../testing/mariadb.md), puis lancer
`mvn -Duser.timezone=UTC -P mariadb-integration -Dit.test=AccountLifecycleIT verify`.
Le résultat CI de la PR fait foi pour l’intégration MariaDB.

Recette humaine à effectuer : naviguer en FR/EN, thèmes clair/sombre, mobile et
clavier ; ouvrir l’historique de deux URL, paginer, ouvrir un ancien rapport,
relancer son URL et vérifier qu’un second compte disposant du lien partagé ne
voit pas la navigation privée. Cette recette humaine n’est pas déclarée exécutée.
