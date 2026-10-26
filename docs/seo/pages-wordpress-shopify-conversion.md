# Pages WordPress, Shopify et conversion — issues #67, #68 et #74

Implémentation et vérification locale du 16 octobre 2026. Les contenus sont proposés à la relecture dans la PR ; aucune relecture éditoriale humaine ni publication en production n’est revendiquée.

## Intentions et routes

| Intention | Français | Anglais |
|---|---|---|
| WordPress : relier les constats publics aux vérifications du thème, des extensions et de la maintenance | `/ressources/audit-wordpress` | `/en/resources/wordpress-audit` |
| Shopify : examiner une fiche produit ou une collection publique | `/ressources/audit-shopify` | `/en/resources/shopify-audit` |
| Conversion : distinguer obstacles techniques, mesure et hypothèses marketing | `/ressources/pourquoi-mon-site-ne-convertit-pas` | `/en/resources/why-is-my-website-not-converting` |

Les six routes rendent le contenu éditorial côté serveur et sont prégénérées au build. Elles partagent une composition SCSS Modules avec les tokens, introductions et géométries de CTA Argos. Leurs contenus, exemples et suites de vérification sont distincts. Les exemples sont explicitement fictifs et ne reprennent aucun rapport privé.

Chaque route fournit son title, sa description, son canonical, ses métadonnées sociales et ses alternances FR/EN réciproques. Le sitemap, le hub de ressources traduit et les liens entre les trois pages rendent les routes découvrables. Les liens vers l’exemple public, la checklist et la méthode du score sont localisés.

Le CTA réutilise `AuditForm` et son flux BFF `/api/audits`. Les trois routes fixes sont ajoutées aux listes d’attribution frontend/backend existantes ; le consentement, les contrôles SSRF, l’anti-robot, les secrets serveur et l’exclusion des rapports privés restent régis par les mécanismes existants.

## Limites éditoriales explicites

- WordPress : détection probable à partir de traces publiques ; aucun inventaire exhaustif des plugins, versions ou failles, accès wp-admin ou contrôle des sauvegardes promis.
- Shopify : aucune connexion admin, analyse privée du thème, commande ou vérification de paiement ; aucune affiliation ou certification revendiquée.
- Conversion : aucune lecture des statistiques métier, aucun taux de conversion déduit d’un score technique, aucune hausse de ventes garantie. Les causes marketing restent des hypothèses à confronter aux données et aux essais humains.

Sources officielles consultées pendant l’implémentation : [optimisation WordPress](https://developer.wordpress.org/advanced-administration/performance/optimization/), [performance des thèmes Shopify](https://shopify.dev/docs/storefronts/themes/best-practices/performance), [événements clés Google Analytics](https://support.google.com/analytics/answer/9267568?hl=fr) et [limites des outils d’évaluation W3C WAI](https://www.w3.org/WAI/test-evaluate/tools/). Elles sont accessibles depuis les pages concernées. La date de première version dans `lib/editorial.ts` correspond à l’ajout du texte au dépôt, sans supposer une mise en ligne.

## Vérifications exécutées

Depuis `apps/console-web` :

```sh
npm run lint
npm test -- src/components/marketing/DiagnosticPage.test.tsx src/components/marketing/DiagnosticPage.dom.test.tsx src/lib/i18n/seo.test.tsx src/lib/analytics/analytics.test.ts src/components/marketing/EditorialMeta.test.tsx src/components/AuditForm.dom.test.tsx
npm run build
```

- Lint : aucune erreur ; un avertissement préexistant `@typescript-eslint/no-unused-expressions` dans `ReportPriorityList.tsx:20`.
- Tests : 36 tests Vitest réussis dans 6 fichiers, plus les 3 tests du contrôle éditorial et le contrôle structurel FR/EN exécutés par `npm test`.
- Les nouveaux tests couvrent les six pages au rendu serveur, les métadonnées, les entrées de sitemap, les liens localisés, l’attribution et l’intégration du vrai formulaire. Ils vérifient URL invalide, focus, chargement, erreur de service sans fuite de détail backend, conservation de l’URL et redirection vers le rapport privé localisé.
- Build Next.js de production réussi : les six nouvelles routes figurent parmi les pages statiques. `API_BASE` pointe vers le serveur de fixtures local pour la recette.

Depuis `apps/api-backend`, avec Java 21 et Maven installés localement :

```sh
mvn -B -Dtest=AnalyticsDimensionsTest,ProductAnalyticsServiceTest package
```

6 tests réussis, puis packaging réussi. Le test d’attribution accepte les trois routes fixes pour FR/EN et refuse une route de rapport privé, une URL absolue et une query ajoutée à une route publique.

## Revue navigateur effectuée

Build de production sur `127.0.0.1:3026`, backend de démonstration en lecture seule sur `127.0.0.1:3018`. Les seuls rapports consultés sont fictifs.

| Écrans | Tailles et thèmes examinés |
|---|---|
| Trois pages FR | Desktop 1280 px et mobile 390 px, thème clair ; conversion également à 320 px |
| WordPress et Shopify EN | Desktop 1280 px et mobile 390 px, thème sombre |
| Conversion EN | Desktop 1280 px clair, mobile 390 et 320 px sombre |
| Shopify et conversion EN | Largeur intermédiaire de 768 px, thème sombre |
| Ressources FR/EN | Nouvelles cartes sur mobile 390 px ; ressources EN également sur desktop |
| Accueil et rapport fictif complet | Desktop 1280 px et mobile 390 px, thème clair |

Pas de débordement horizontal observé sur ces vues. Les titres, listes numérotées, puces et exemples restent lisibles. Le CTA long du guide conversion passe sur deux lignes à 320 px, sans troncature. Champ et bouton mesurent 44 px de haut sur desktop ; le bouton grandit avec son texte sur petit mobile.

Interactions vérifiées : passage FR → EN sur la bonne route, ancres du formulaire, URL invalide FR/EN, message d’erreur, retour de focus et navigation clavier du champ vers le bouton avec outline visible. L’ancre desktop du formulaire se place à environ 88 px pour une navigation fixe de 73 px. Les envois réussis et erreurs de service sont vérifiés dans les tests de composants, sans déclencher d’audit réel dans le navigateur.

Captures locales conservées dans `outputs/ui-review/cms-conversion-pages/` du checkout principal, notamment les trois introductions FR desktop, WordPress/Shopify EN desktop sombre, les trois introductions EN mobile sombre et la validation du formulaire conversion EN à 320 px. Ce répertoire de preuves locales est ignoré par Git.

Cette revue par l’agent ne constitue ni une recette éditoriale humaine ni une évaluation complète WCAG. Les issues #67 et #68 demandent une relecture humaine avant publication ; celle-ci reste à effectuer au cours de la revue de PR.

## Révision WordPress du 25 octobre 2026

Les contenus FR/EN de WordPress deviennent un guide de passage du constat
public à la vérification dans le CMS : noindex, description périmée, élément
LCP et conflit supposé de composant. Les étapes distinguent HTML reçu,
configuration enregistrée, couches de cache et vérification anonyme. Le mode
dépannage Health Check reste limité à la session connectée ; l’analyse publique
ne doit pas être présentée comme observant cette même configuration.

L’ancien exemple alt générique est remplacé par un scénario HTML avant/après
de description périmée. Il est explicitement fictif, sans installation WordPress
ni mesure client. Les explications demandent d’écarter URL, langue et producteur
de balise avant d’attribuer le décalage au cache. Les références WordPress de
Réglages → Lecture, du dépannage et de l’optimisation ont été consultées.

Des liens contextuels partent de la checklist générale, des diagnostics SEO
et vitesse et du guide LCP vers WordPress ; WordPress renvoie vers leurs
procédures pertinentes. Le hub de ressources décrit ce rôle spécifique. Les
titres et descriptions FR/EN sont alignés, sans changer routes ou canoniques.
Les dates initiales sont conservées ; seule la révision substantielle est datée
dans le registre éditorial, avec une durée de lecture estimée adaptée.

Vérifications communes à cette révision et au guide e-commerce : lint, contrôle
éditorial, 69 tests ciblés et build réussis. Les tests des six pages diagnostic
continuent à couvrir métadonnées, liens localisés et formulaire réel. Le test
serveur WordPress vérifie aussi l’ancre de l’exemple, qui doit rester sur la
page courante au lieu de pointer vers l’accueil.
