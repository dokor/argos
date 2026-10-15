# Pages publiques pour Google OAuth — issue #512

> Archive : ce compte rendu conserve son périmètre et ses résultats d'origine.
> Pour la référence maintenue, consulter [la documentation courante](../../accounts/operations.md).
> Voir [l'index des archives](../README.md) pour les dates et limites.

Validation locale le 12 octobre 2026, sur une branche dédiée à partir de `main` (`c863572`).

## Vérifications exécutées

- Tests ciblés `AccountView.dom.test.tsx` et `SiteFooter.dom.test.tsx` : 32 tests réussis. Les liens des écrans FR/EN de connexion et d’inscription restent sur les deux routes publiques françaises ; le footer anglais signale leur langue.
- ESLint sur les fichiers TypeScript/TSX modifiés : réussi.
- `npm run build` : réussi, vérification TypeScript incluse ; `/conditions-utilisation` et `/confidentialite` sont pré-rendues statiquement.
- HTTP local, sans cookie de session : les deux pages répondent 200. La canonique des CGU pointe vers `https://argos.lelouet.fr/conditions-utilisation` et cette URL figure dans le sitemap. Aucun en-tête X-Robots-Tag de compte privé sur les CGU.
- `git diff --check` : réussi.

## Revue du navigateur

Build de production sur `127.0.0.1:3040`. Les écrans de compte utilisent une fixture anonyme GET uniquement sur loopback : fournisseur Google/GitHub/LinkedIn disponible, `/me` refusé en 401, aucune donnée réelle ni soumission de formulaire.

Parcours : CGU → confidentialité via le lien d’introduction ; liens CGU/confidentialité des écrans de connexion et d’inscription en français et anglais ; présence des liens dans les footers des accueils FR/EN. Les pages légales restent en français, explicitement indiqué depuis les écrans anglais.

Échantillons examinés : CGU à 1440/390 px en clair et 1440/320 px en sombre ; confidentialité à 390 px en clair et 1440 px en sombre ; connexion FR à 390 px en clair et 1440 px en sombre ; inscription EN à 768 px en sombre ; connexion EN à 320 px en sombre et 1440 px en clair ; inscription FR à 390 px en sombre ; accueils FR/EN à 390/768 px en sombre. Aucun débordement horizontal mesuré, titres et paragraphes lisibles. Un seul H1 par page. La tabulation entre les liens de politique affiche un outline solide de 3 px.

Captures locales conservées dans `outputs/ui-review/google-public-policies/` du checkout principal (fichiers ignorés par Git). Cette revue ne constitue ni un essai OAuth réel avec Google ni une certification juridique ou WCAG.

## Mise en service

La PR livre les pages et documente les URL dans [la procédure d’exploitation](../../accounts/operations.md). Après fusion et déploiement, vérifier leur accessibilité HTTPS publique puis renseigner les deux liens dans Google Auth Platform. Aucun compte activé, aucun changement des scopes/callbacks et aucun déploiement exécuté pour cette issue.
