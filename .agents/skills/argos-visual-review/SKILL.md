---
name: argos-visual-review
description: Vérifier et corriger le rendu des pages Argos dans le navigateur après un changement UI ou UX, notamment les rapports, le responsive, les thèmes et les interactions accessibles. Ne pas activer pour une modification backend sans effet visuel.
---

# Revue visuelle Argos

Inspecter les écrans réellement rendus. Un build réussi ne valide pas une composition, et une capture seule ne valide pas un parcours.

## Préparer

Lire les instructions du dépôt et des outils de navigateur disponibles. Lancer le frontend local depuis `apps/console-web`. Préserver les changements existants. Utiliser un rapport de test contrôlé ou une fixture locale pour inspecter les rapports privés ; ne pas afficher de données utilisateur dans une capture partageable.

Le serveur local `scripts/preview-backend.mjs` fournit uniquement des fixtures fictives en lecture. Démarrer avec `node .agents/skills/argos-visual-review/scripts/preview-backend.mjs`, puis lancer Next avec `API_BASE=http://127.0.0.1:3018` dans l’environnement du processus (PowerShell : `$env:API_BASE='http://127.0.0.1:3018'`). Pour une revue du build de production, fournir aussi cette variable à `npm run build`, car les rewrites sont résolus au build, puis à `npm run start`. Ce serveur écoute exclusivement sur loopback et refuse toute écriture. Il ne doit jamais être déployé. Parcours : `/report/review-complete-fixture`, `/report/review-partial-fixture`, `/report/review-unavailable-fixture`, `/report/review-empty-fixture`, `/report/review-running-fixture`, `/report/review-failed-fixture`, `/report/review-missing-fixture`, `/report/review-details-fixture` (panneau de qualification fictif), ainsi que leurs variantes `/en/report/…`.

Les fixtures comprennent aussi `/account/admin`, les utilisateurs et leur fiche, les analyses et leur détail, le journal, ainsi que `/account/admin/feedback`. Le profil administrateur retourné par le backend de démonstration est fictif ; cela ne vérifie pas les autorisations de production. Pour la console historique `/dashboard`, lancer Next avec des valeurs temporaires locales pour `ADMIN_PASSWORD`, `ADMIN_TOKEN` et `ADMIN_API_TOKEN`, puis se connecter normalement dans `/login`. Ne jamais enregistrer des identifiants réels dans ces fixtures. Examiner filtres, absence de résultat, chargement, erreurs, détails longs, tableaux confinés, focus après fermeture, pagination et accès au rapport. Les modifications d’offres et de retours sont couvertes par les tests de composants, pas par des écritures dans les données de production.

## Examiner

- Vérifier accueil, rapport et pages modifiées à une largeur desktop et mobile (environ 390 px ; contrôler aussi 320 px si la navigation ou les actions sont serrées).
- Contrôler aussi une largeur intermédiaire autour de 768 px et les abords des seuils de grille : titres et valeurs de score ne doivent pas provoquer des alignements différents entre cartes.
- Examiner les thèmes clair et sombre, et les versions française et anglaise des interactions modifiées. Contrôler titres longs, paragraphes, preuves/URLs longues, états vides et scores partiels/indisponibles.
- Chercher les débordements horizontaux, textes tronqués, contrastes faibles, éléments trop serrés et empilements de panneaux. Les tableaux peuvent défiler dans leur propre conteneur, pas toute la page.
- Comparer les CTA voisins dans chaque groupe : même hauteur rendue, alignement vertical, typographie et centrage des icônes. Contrôler aussi les champs accompagnés d’un bouton. Mesurer les rectangles du DOM en cas de doute ; `min-height: 44px` identique ne suffit pas si les paddings, bordures ou interlignes diffèrent. Vérifier notamment relance/partage en tête de rapport et rendez-vous/copie en pied, en FR/EN et sur mobile.
- Vérifier les espacements, rayons et bordures des composants comparables, et les états chargement/erreur/succès : absence de déplacement des actions, libellés complets et messages lisibles hors des boutons.
- Tester les liens d’ancrage, filtres et accordéons. Un filtre actif doit être exposé aux technologies d’assistance et un résultat vide doit se distinguer de l’absence de problème détecté. Les en-têtes fixes ne doivent pas masquer la destination d’une ancre.
- Mesurer les bords communs des sections, vérifier la graisse calculée des sous-titres et les marqueurs de listes. Comparer aussi le rendu avant et après une copie de lien : le retour de succès ne doit pas modifier les colonnes ou le retour à la ligne des boutons.
- Vérifier le focus clavier visible, les noms accessibles et la hiérarchie des titres. Respecter `prefers-reduced-motion` pour les animations décoratives.

Corriger les défauts observés, puis revoir les écrans concernés. Exécuter les tests pertinents pour les comportements changés et le build frontend. Ne pas ajouter des tests qui ne font que recopier du CSS.

## Livrer

Conserver une capture du résultat dans `outputs/ui-review/` si l’outil le permet, avec une note courte des parcours, tailles, langues et états réellement vérifiés. Distinguer données fictives et mesures réelles. Rapporter les améliorations visibles et les éventuelles limites ; ne jamais déclarer une conformité WCAG sur la seule base de cette revue.
