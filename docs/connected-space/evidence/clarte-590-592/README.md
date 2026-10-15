# Recette Clarté — #590, #591, #592

Le diagnostic privé retrouve une lecture contexte → mesures → constats et preuves, avec preuve et correction côte à côte sur desktop. Le rapport public reste inchangé. Les modes de lecture, filtres, identifiants canoniques et liens de retour sont conservés.

Le dashboard affiche des URL compactes, les états d’exécution et de couverture, puis des métadonnées dépliables. Ses KPI retrouvent une action explicite. Le panneau récent est limité au dernier diagnostic avec un accès aux sites et historiques.

La synthèse domaine affiche le ratio affectées/évaluées sur les règles fermées. Les exemples sont limités à trois chemins, avec accès à toutes les pages concernées. Les conditions de découverte restent consultables dans un détail replié.

## Vérification du 15 octobre 2026

- Build de production local (`API_BASE=http://127.0.0.1:3018`), servi sur `127.0.0.1:3024`, fixtures fictives en lecture seule. Aucune requête de recette vers la production.
- Trois pages en FR clair à 1056, 768, 390 et 320 px : un h1, aucune largeur de document supérieure au viewport. Mesures dans [checks.json](checks.json).
- Trois pages en EN sombre à 390 px. Les textes techniques des fixtures restent volontairement dans leur langue source ; cette PR ne résout pas #584.
- Détails du dashboard ouverts au clavier : focus visible et contenu accessible. Accordéons domaine ouverts à 320 px, portée toujours visible lorsqu’ils sont fermés.
- Lien règle → pages filtrées → diagnostic : le retour conserve `tab`, `rule` et `definitionVersion`, y compris les liens localisés.
- Filtre technique du diagnostic : sélection de sécurité puis retour à la vue d’ensemble rétablit les cinq constats de la fixture.
- `npm test` : 75 fichiers, 716 tests Vitest et 3 tests éditoriaux passés. Contrôle éditorial FR/EN passé. Tests ciblés rejoués après correction de l’empreinte de la fixture.
- `npm run build`, TypeScript, ESLint ciblé et `git diff --check` passent. Aucun log navigateur de niveau error pendant la passe finale.

## Captures

| Page | Desktop 1056 | Mobile 390 | EN sombre 390 |
| --- | --- | --- | --- |
| Vue d’ensemble | [Capture](overview-1056.jpg) | [Capture](overview-390.jpg) | [Capture](overview-en-dark-390.jpg) |
| Diagnostic privé | [Capture](report-1056.jpg) | [Capture](report-390.jpg) | [Capture](report-en-dark-390.jpg) |
| Synthèse domaine | [Capture](domain-1056.jpg) | [Capture](domain-390.jpg) | [Capture](domain-en-dark-390.jpg) |

## Limites des données

Les six emplacements de mesures n’inventent aucune valeur : seule une mesure numérique structurée avec unité correspondante et couverture compatible est présentée. Les anciens rapports omettant des contrôles réussis peuvent donc afficher « Indisponible ». Un score Lighthouse ou une phrase de preuve n’est jamais converti en durée. La fixture présente volontairement un LCP disponible et cinq valeurs manquantes.

L’URL demandée vient du contexte du run ; les paramètres sensibles restent masqués par le helper de périmètre existant. Le contrat actuel ne fournit pas séparément l’URL finale et son statut HTTP : le diagnostic le dit explicitement. Les limites de couverture, de collecte et les métadonnées techniques restent disponibles. Les états expiré/indisponible/échec et la révocation de session sont couverts par les tests du conteneur `PersonalReport`, sans nouveau test d’écriture sur un compte réel.
