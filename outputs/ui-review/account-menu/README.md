# Menu de compte — issue #623

Recette du 15 octobre 2026 sur le frontend local et les fixtures fictives en lecture seule de `argos-visual-review`. Aucun compte de production utilisé.

## Choix UX

- Un seul composant et un seul bouton de compte dans le DOM. Sur PC, il remplace l’identité statique en pied de barre latérale ; le panneau s’ouvre vers le haut.
- Sous 900 px, il passe dans l’en-tête et ouvre le panneau sous la navigation. « Mon compte » reste visible sans ouvrir le menu de navigation. L’avatar disparaît à 360 px et moins pour préserver le libellé.
- Le nom complet reste dans le nom accessible et le panneau ; un nom long est abrégé dans le bouton desktop.
- Liens/boutons natifs avec ordre Tab normal : pas de rôle ARIA `menu` exigeant un second modèle de navigation clavier. État développé annoncé, focus visible, Échap, clic extérieur, départ du focus et changement de route ferment le panneau. Les menus compte/navigation sont exclusifs.
- La déconnexion utilise le client existant : POST avec CSRF, attente annoncée, double soumission bloquée, erreur réessayable ; invalidation du contexte privé et remplacement de la route par la connexion localisée après succès ou session déjà expirée.

## Contrôles réels

- `/account/integrations` et `/en/account/integrations` : PC (1366 px), tablette (768 px), mobile (390 et 320 px).
- Français clair et anglais sombre, menu ouvert/fermé, nom de fixture long. Absence de débordement horizontal mesurée à 1366, 768 et 320 px. Panneau mobile à 320 px contenu entre x=14 et x=291 ; boutons de compte/navigation de 44 px de haut.
- Ouverture au clic/Entrée, fermeture Échap avec retour du focus, coexistence avec la navigation mobile et changement de langue.
- Captures : `desktop-en-dark.jpg`, `mobile-390-fr-light.jpg`, `mobile-320-en-dark.jpg`.
- Tests ciblés : 179 tests passants dans `AccountMenu.dom.test.tsx`, `AccountShell.dom.test.tsx`, `AccountSession.dom.test.tsx` et `account-proxy.test.ts`. Ils couvrent notamment FR/EN, utilisateur non vérifié, attente, double clic, échecs réseau/CSRF/429, session expirée, invalidation des données privées et suppression du cookie par le BFF.
- ESLint et build frontend de production exécutés.

## Limites

La révocation d’une vraie session Java n’a pas été exécutée dans cette recette : le serveur de fixtures refuse les écritures. Le contrat BFF existant et le comportement du composant sont couverts par les tests. Les autorisations administrateur sont fictives dans le navigateur ; cette recette n’établit pas une conformité WCAG.
