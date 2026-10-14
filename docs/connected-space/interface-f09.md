# Interface domaine F09 — #557

## Périmètre livré

Routes FR et EN : `/account/domains`, `/account/domains/new`,
`/account/domains/{domainId}/batches/{batchId}`. La fin du tunnel et la liste
ouvrent cette même ressource privée persistée. Le footer et le cadre Clarté
sont ceux du shell connecté F02. Le moteur et les règles de calcul restent F06–F08.

- Liste recherchable et paginée : dernière tentative, statut, pages prioritaires,
  pages incomplètes et diagnostics complets / pages sélectionnées.
- Découverte bornée : hôte exact, profondeur, nombre d’URL, exclusions, limites
  effectives, motif d’arrêt, pages exclues, date d’expiration et reprise.
- Sélection des pages éligibles, profil serveur, crédits disponibles et restants.
  Une lecture fraîche du quota précède la confirmation ; l’admission serveur
  reste l’autorité si le quota change ensuite. `null` signifie illimité.
- Synthèse : problèmes communs avec affectées / évaluées / sélectionnées,
  non-évaluées et causes d’exclusion ; impact, recommandation et exemples.
  Pages prioritaires et couverture à compléter restent deux sections distinctes.
- Table des pages : recherche URL, règle/version, sévérité, exécution, complétude,
  périmètre et tri dans l’URL ; pagination, états des modules et diagnostic exact.
- Historique, annulation explicite, crédits réservés / consommés / libérés.

## Navigation et reprise

Les identifiants restent des chaînes BIGINT. Le retour depuis un diagnostic
n’accepte que les routes domaine et les filtres autorisés. Aucune recherche du
« dernier rapport disponible » ne remplace le run enfant demandé.

Un GET n’émet jamais de commande. Le polling ne se chevauche pas, s’interrompt
dans un onglet caché, s’arrête au statut terminal, annule les lectures lors d’un
changement de route et borne les reprises des erreurs transitoires à trois.
La reprise d’une découverte ou d’un lot actif est visible dans le tunnel.

Le tunnel conserve dans l’URL l’identifiant de découverte, la sélection et le
profil. Pendant une commande, il conserve aussi sa clé d’idempotence et son
corps exact. Après une réponse perdue, un bouton explicite rejoue la même demande,
y compris après refresh ; aucun POST automatique. Les contrôles restent verrouillés
jusqu’à résolution. Un refus métier connu libère la demande et conserve la sélection.
Ces informations ne sont ni une session ni une autorisation ; le serveur revérifie
propriétaire, pages, profil et quota. Aucun stockage navigateur persistant ajouté.

## Écarts motivés par les contrats réels

- La liste utilise le nombre de pages incomplètes disponible dans F08, au lieu
  d’inventer un total de problèmes communs absent du contrat de liste.
- Le profil affiché est l’identifiant et la version du scoring réellement figés.
  Les collecteurs gardent leurs réglages serveur ; aucun faux profil mobile/desktop.
- Les titres, impacts et recommandations sont ceux du diagnostic persisté. Leur
  langue n’est pas réécrite par l’interface ; les contrôles et états sont FR/EN.
- Les exemples d’une règle sont résolus par une lecture bornée des pages du lot
  (50 au maximum), sans requête par exemple.
- Les listes sont paginées et les tables défilent dans une région nommée au clavier.
  Le nombre de cartes et la hauteur des sections suivent les données, pas la fixture.

## Recette et preuves

Exigences : UI-06 à UI-09, QA-01, QA-07, QA-14.

`connected-domains.mjs` vérifie le rendu sur 320, 390, 768, 1056 et 1440 px,
FR/EN et clair/sombre : liste, synthèse, filtre, retour au run exact, tunnel,
confirmation clavier/focus, quota nul/inconnu/illimité/modifié, expiration,
réponse perdue et reprise, progression, vide et ressource absente. Ces réponses
sont explicitement synthétiques et ne prouvent pas la persistance serveur.

`ControlledAuditE2eIT` et `domain-browser.mjs` ajoutent une recette sans mock des
réponses API : navigateur → BFF → Jersey → MariaDB → découverte, admission,
queue, scoring, publication et agrégation. Seuls les transports de collecte
sont adaptés à un serveur local contrôlé (et les fournisseurs externes déjà
simulés dans le test d’audit). La session de fixture est passée en mémoire et
n’apparaît pas dans les preuves. La recette vérifie deux runs enfants uniques,
les crédits consommés, le même lot depuis la liste et la fin du tunnel, le
refresh sans nouvelle admission et le retour aux filtres depuis le bon rapport.

Captures et résultats : `outputs/ui-review/clarte-domains/`, artefact CI
`connected-domains-<sha>` ; preuve réelle dans `real/proof.json` et
`outputs/domain-e2e.json`. Les captures locales ne sont pas versionnées.
La validation MariaDB nécessite le service isolé de la CI ; aucune base de
production n’est utilisée. Ne pas confondre capture produite et revue visuelle humaine.

Commande locale : `CONNECTED_BASE_URL=http://127.0.0.1:3030 node scripts/e2e/connected-domains.mjs`
après un build et le lancement du frontend. `CLARTE_BROWSER_PATH` permet le navigateur
local ; la CI utilise Chromium installé par Playwright.

## Limites

L’offre multi-clients, le paiement, les intégrations CI/API et le dashboard global
ne font pas partie de ce lot. Aucune fusion ou mise en production automatique.
