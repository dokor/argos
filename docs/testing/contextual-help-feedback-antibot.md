# Recette #665 / #666 / #667 — 16 octobre 2026

Recette locale avec le build Next de production et les fixtures fictives en
lecture seule. Aucun envoi vers les données de production, aucun secret réel ni
compte fournisseur utilisé. Les captures locales sont dans
`outputs/ui-review/` (ignoré par Git).

| Taille / langue / thème | Parcours réellement inspecté | Résultat |
| --- | --- | --- |
| Desktop, FR, sombre | `/feedback`, ouverture Bug, Échap | Modal sans navigation, catégorie Bug, champs nommés ; retour du focus au bouton d'ouverture. |
| 768 × 1024, FR, sombre | Ouverture Suggestion, formulaire complet | Modal de 680 px dans un viewport utile de 753 px ; actions et focus visibles, aucune largeur de page supplémentaire. |
| 390 × 844, EN, clair | Rapport partiel fictif → Send feedback | Type modifiable ; contexte de page et URL facultatifs ; checkbox de partage décochée. Largeur du dialog 341 px dans un viewport utile de 375 px. |
| 390 × 844, EN, clair | Brouillon → Échap → Keep writing | Confirmation sans perte de texte ; focus sur Keep writing puis retour au textarea. Tab depuis le dernier bouton reste dans la modal. |
| 320 × 812, FR, clair | Progression fictive → badge En attente | Tooltip au tap, fermeture par Échap. Après correction, bornes 8–297 px dans un viewport utile de 305 px ; Observatory reste sur une ligne. |

Corrections issues de cette inspection : focus de la confirmation et de la
reprise du brouillon, largeur utile du viewport hors scrollbar, suppression du
padding natif des déclencheurs et espacement des modules à petite largeur.

Les tests de composants couvrent aussi ouverture/fermeture, conservation après
erreur, doublons, confirmation de réception, opt-in du rapport, FR/EN et les
erreurs du fournisseur simulé. Le test HTTP Java vérifie les requêtes directes,
la barre finale, les paramètres de matrice, une route encodée non reconnue et un
faux en-tête de validation. Les tests de service contrôlent hôte, action, âge,
preuve absente/invalide/réutilisée et panne fournisseur. Les BFF ne transmettent
aucune déclaration de validation côté client.

Commandes de validation : `mvn -o test`, tests HTTP anti-bot ciblés, `npm test`,
ESLint sur les fichiers modifiés et `npm run build -- --webpack`. Des exécutions
frontend concurrentes avec le build ont expiré sous charge à la limite de 5 s ;
la validation finale limite les workers à deux et le timeout par test à 15 s,
sans modification des délais du dépôt.

Limites : les parcours d'envoi sont simulés par les tests, le serveur de revue
refuse les écritures. Les autorisations admin et entre comptes ne sont pas
prouvées par les captures. Une recette du vrai widget Turnstile sur ses domaines
autorisés, une lecture avec un lecteur d'écran et une séance avec des personnes
non techniques restent à mener avant de revendiquer ces validations. Aucun
déploiement ni conformité WCAG/RGPD n'est déduit de cette recette.
