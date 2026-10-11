# Non-indexation des rapports : décision #395

Vérification locale du 10 octobre 2026, build production et backend HTTP contrôlé. Aucun rapport utilisateur ni token réel utilisé. Reproduction depuis la racine : `npm run build --prefix apps/console-web`, puis `node scripts/e2e/report-indexing.mjs`. Ports de fixture 3090/3091, fermés à la fin du test.

## Décision

Les liens de rapports sont des secrets de consultation, pas une authentification utilisateur. Leur accès et leur génération sont inchangés. Aucun lien de rapport réel dans le site public, sitemap ou démonstration. Un lien communiqué ou divulgué reste lisible par son détenteur.

Une directive noindex ne peut pas être lue sur une URL bloquée au crawl. On permet donc aux robots de consulter une URL de rapport qu’ils connaissent, pour qu’ils lisent `noindex, nofollow`, à la fois en meta SSR et dans `X-Robots-Tag`. La canonique et les alternates de l’accueil ne sont plus hérités. Il ne s’agit pas de publier les liens ni de protéger le contenu par robots.txt. Les robots qui ignorent ces directives peuvent toujours lire un lien connu ; aucune absence absolue des résultats n’est promise. La FAQ et la confidentialité (#384) décrivent déjà cette limite.

Sources : [Google, introduction robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro) et [blocage de l’indexation](https://developers.google.com/search/docs/crawling-indexing/block-indexing). Le crawl sert à prendre connaissance du refus d’indexation ; un vrai contrôle d’accès reste une autre propriété.

## Résultats effectifs

| État contrôlé | FR et EN | HTTP | Meta robots | X-Robots-Tag | Canonique / hreflang |
|---|---|---|---|---|---|
| Publié | Rapport de la fixture fictive | 200 | noindex, nofollow | noindex, nofollow | Absents |
| QUEUED / RUNNING | Progression SSR avant polling | 200 | noindex, nofollow | noindex, nofollow | Absents |
| FAILED | Vue échec | 200 | noindex, nofollow | noindex, nofollow | Absents |
| Expiré / inconnu | Vue introuvable | 200 | noindex, nofollow | noindex, nofollow | Absents |

Les erreurs sont actuellement des réponses HTML 200 : ce lot ne modifie pas les codes métier ni la navigation. Le header assure la directive dès la réponse HTTP, même si Next streame certaines métadonnées. Le test vérifie le HTML reçu avant hydratation, le contenu de l’état, le sitemap, robots.txt et les href des pages publiques/exemples. Résultats détaillés : docs/testing/epic-373/report-indexing.json.

Le backend conserve le contrôle par hash du token et l’expiration facultative. Les règles dashboard/login/api restent en place ; aucune autorisation ou publication de données utilisateur ajoutée.
