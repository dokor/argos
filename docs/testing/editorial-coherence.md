# Validation éditoriale — 12 octobre 2026

Milestone 17, issues #478, #479 et #480. Revue effectuée par un agent sur le
worktree `codex/editorial-coherence`, à partir de `c863572`. Aucun déploiement.

## Vérifications automatisées

Depuis `apps/console-web` : `npm run lint`, `npm run test`,
`API_BASE=http://127.0.0.1:3018 npm run build` (adapter la variable à PowerShell).
Le test frontend exécute aussi les tests du contrôle éditorial et ce contrôle.

Résultats finaux : lint réussi ; 60 fichiers et 436 tests Vitest réussis ;
3 tests du contrôle éditorial réussis ; contrôle FR/EN réussi (63 routes et
3 181 candidats) ; build de production réussi ; `git diff --check` réussi.
Les premières exécutions ont
permis de corriger les assertions d’anciens libellés, un remplacement trop large,
des accords au singulier et le correctif de recommandation. Aucune assertion de
sécurité, de filtre, de compteur ou d’impression n’a été supprimée.

Le contrôle compare les clés, structures, textes non vides et variables FR/EN,
et cherche des marqueurs explicites de brouillon dans les candidats de source.
Les tests injectent des clés absentes, chaînes vides, variables différentes,
structures incompatibles et marqueurs ; un test accepte les variables réordonnées
et les termes techniques. Des tests Vitest couvrent aussi les dictionnaires
et cinq sources bilingues partagées, ainsi que zéro/un/plusieurs constats FR/EN
et une recommandation manquante sans confirmation répétée.

## Navigateur réellement examiné

Next local sur `127.0.0.1:3020`, backend de fixtures en lecture sur
`127.0.0.1:3018`, navigateur intégré Codex. Données fictives exclusivement.

| Parcours | État, taille et résultat |
|---|---|
| `/faq`, `/en/faq` | 390 × 844 sombre, EN 1440 × 900 clair. Ouverture au clavier de la réponse PDF, ouverture du plafond, lien localisé de méthode et focus visible. Aucun débordement horizontal observé. |
| `/`, `/en` | FR 1440 × 900 clair, EN 390 × 844 clair. H1 et formulaire lisibles, exemple explicitement fictif ; aucun débordement horizontal observé. |
| `/report/review-complete-fixture` | FR 390 × 844 clair et 768 × 900 clair. Résumé, score, constats au singulier ; passage aux constats techniques puis filtre Opportunités : 2 constats sur 5, preuve et score conservés. |
| `/en/report/review-partial-fixture` | 768 × 900 clair et 390 × 844 sombre. Score provisoire, couverture 55 %, sécurité non évaluée, bouton de thème traduit ; aucun débordement horizontal observé. |
| `/account/sites` | 390 × 844 sombre. Nouveau texte du nom d’hôte, consommation et erreur de lecture visibles. La fixture ne fournit pas la liste des sites ; aucun lancement ni ajout réalisé. |
| `/en/account/admin` | 390 × 844 sombre. Navigation, volumes et filtres traduits lisibles, table fictive confinée à sa région. Aucun changement d’offre réalisé. |

Captures locales dans `outputs/ui-review/editorial/` du checkout principal :
`faq-en-desktop.jpg` et `report-en-partial-mobile.jpg`. Les fixtures de rapport
contiennent des observations techniques en français, y compris en vue EN : ces
preuves originales sont conservées ; les libellés éditoriaux sont traduits.
Les avertissements de développement Next sur eval/hydratation du thème et la
convention middleware ont été observés ; cette revue ne certifie pas l’absence
de tout défaut préexistant ni la conformité WCAG.

L’historique, les écritures personnelles, les contrôles d’accès et l’impression
sont vérifiés par les tests existants ; ils n’ont pas fait l’objet d’une recette
humaine sur un service réel. Les pages juridiques et leurs références n’ont pas
été réévaluées juridiquement.

## Validation humaine avant publication

En attente. Aucun nom de relecteur, entretien propriétaire non technique ou
validation juridique n’est inventé. Le mainteneur suit le
[guide court](../product/editorial-guide.md) et consigne dans la PR le relecteur,
la date, les parcours relus et les réserves avant publication. Les tests de
structure ne prétendent pas détecter toutes les formulations artificielles.

## Mise à jour après intégration de main

`main` à `d70a80d` (#513) a ajouté les conditions d’utilisation et les liens
de confidentialité avant connexion. Les conflits des deux dictionnaires ont
été résolus en gardant toutes les corrections éditoriales et les quatre nouvelles
clés de compte par langue. L’inventaire inclut désormais cette page française.
Les validations automatisées ci-dessus ont été relancées sur cette résolution.
