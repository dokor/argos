# Vérification de l’audit de l’accueil du 27 octobre 2026

Périmètre : `https://argos.lelouet.fr/`, rapport généré à 09:26 UTC, issue #776.
L’audit initial utilisait Next.js 16.4.2 / React 19.2.3. La solution finale utilise
le correctif stable Next.js 16.4.3, TypeScript et SCSS Modules, avec le BFF Next
et le backend Java. Aucun déploiement ni écriture
de données de production n’a été effectué.

## Changements livrés

- `apps/console-web/src/app/(fr)/LandingPage.tsx`, les routes `page.tsx` FR/EN et
  `components/marketing/HomeReportPreview.tsx` : la langue des contenus statiques
  est résolue côté serveur. Les formulaires, liens et préférences gardent leurs
  composants client. Les textes, classes de style et ancres sont conservés.
- `components/feedback/FeedbackButton.tsx`, `FeedbackButton.module.scss` et le
  nouveau `FeedbackDialog.tsx` : le dialogue et le formulaire sont importés à
  l’ouverture. Le brouillon, l’abandon explicite, le verrou pendant l’envoi et le
  retour du focus sont conservés. L’annonce de chargement ne déplace pas la navigation.
- `apps/console-web/next.config.ts` : `poweredByHeader: false` conservé ; retrait
  de `inlineCss` **et** de `cssChunking: "graph"`. Les styles restent externes avec
  le découpage par défaut. L’option préexistante `globalNotFound` est conservée
  pour les racines FR/EN ; aucune nouvelle option expérimentale d’optimisation.
- `LangProvider.tsx` sélectionne le dictionnaire côté serveur. `LangContext.tsx`
  reçoit uniquement la langue de la route et ses traductions ; il n’importe plus
  les deux catalogues JSON dans le JavaScript client. Le footer utilise ce même
  contexte, sans importer un catalogue français de secours ; sa propriété
  `fixedFrench`, sans appelant, a été retirée. Les liens de langue restent pilotés
  par l’URL. Les tests isolés injectent maintenant un dictionnaire explicite.
- `SiteDocument.tsx` : seul le préchargement de Geist Mono est désactivé. Cette
  police n’est utilisée que pour le code de la page d’erreur ; elle reste disponible
  à l’usage. Les polices, variantes, métriques de repli et couleurs sont conservées.
- `ReportExport.tsx` importe le code PDF à la demande après la vérification d’accès.
  Les règles d’impression restent chargées comme auparavant et l’aperçu attend
  les feuilles de style et les polices avant d’annoncer qu’il est prêt.
- Next.js et sa configuration ESLint passent à la version stable 16.4.3, sans
  changer React ni le bundler. Les [notes de version](https://github.com/vercel/next.js/releases/tag/v16.4.3)
  décrivent notamment le correctif du runtime chargé dans `proxy.ts` et des URL
  de polices. Les gains revendiqués sont ceux de la solution complète mesurée.
- `apps/console-web/src/lib/content-security-policy.ts` : retrait de la source
  générale `https:` des images. Les sources utilisées sont locales ou `data:`.
  Les nonces de scripts et les permissions Turnstile restent en place.
- Tests adaptés dans `FeedbackButton.dom.test.tsx`, `FeedbackForm.dom.test.tsx`,
  `SiteNav.dom.test.tsx`, `AccountShell.dom.test.tsx`, et assertion CSP dans
  `src/proxy.test.ts`.

## Bilan par identifiant

« Vérifié » signifie vérifié sur le build local de production, sauf mention
expresse d’une lecture publique. Une nouvelle analyse après mise en ligne reste
nécessaire pour constater le résultat à travers Traefik.

| Identifiant | État | Preuve, fichiers et reste à traiter |
| --- | --- | --- |
| `lighthouse.audit.mainthread-work-breakdown` | Modifié à vérifier | Accueil et aperçu rendus côté serveur ; dialogue différé. Comparaison Lighthouse locale dans le tableau de mesures ci-dessous. Le temps de l’audit public n’est pas reproduit à l’identique. |
| `lighthouse.audit.max-potential-fid` | Modifié à vérifier | Le volume de JavaScript initial diminue ; les coûts CPU ne progressent pas uniformément et le runtime React/Next reste nécessaire. Nouvelle mesure publique requise si une mise en ligne est décidée. |
| `lighthouse.audit.network-dependency-tree-insight` | Modifié à vérifier, signal persistant | JavaScript et préchargement de police réduits. La solution finale utilise le découpage CSS par défaut ; des styles partagés et des ressources critiques restent présents. Aucun préchargement spéculatif ajouté. |
| `lighthouse.audit.unused-css-rules` | Signal persistant dans la solution stable | Le découpage expérimental `graph`, qui supprimait le signal dans l’essai précédent, a été retiré. Le découpage par défaut charge encore des styles partagés inutilisés sur l’accueil. La correction finale ne prétend pas éliminer cet audit. |
| `lighthouse.audit.unused-javascript` | Modifié à vérifier, signal persistant | Les deux ressources précises du rapport contiennent les runtimes React DOM et Next.js. La couverture d’un premier chargement ne justifie pas de retirer leur code de navigation. Moins de JavaScript applicatif et d’hydratation avec le rendu serveur et l’import différé ; les deux runtimes restent signalés. |
| `zap.alert.10055` | Modifié à vérifier, traitement partiel | `img-src 'self' data:` est vérifié dans la réponse locale et le test du proxy. Les preuves ZAP regroupent aussi `style-src unsafe-inline` : cette autorisation reste nécessaire aux styles React actuels. L’alerte complète ne doit donc pas être déclarée éliminée. Retirer ces styles demanderait un chantier distinct couvrant notamment les rapports et les valeurs dynamiques. |
| `lighthouse.audit.total-blocking-time` | Résultats mixtes selon la méthode | Le TBT médian appliqué baisse face à la PR originale ; le TBT simulé augmente. Les deux séries sont conservées ci-dessous, sans déclarer le constat public éliminé. |
| `lighthouse.audit.largest-contentful-paint` | Mesuré dans les deux modes, sans inlineCss | Dictionnaire résolu au serveur et préchargement inutile retiré. Comparaison finale de la PR originale, de l’essai inlineCss et de la solution stable ci-dessous, avec tous les échantillons et les compromis. Aucune garantie de gain public. |
| `lighthouse.audit.legacy-javascript-insight` | Non confirmé comme code supprimable | La ressource pointée contient les polyfills générés par Next.js. Aucune preuve que la compatibilité visée puisse être abandonnée. Aucun retrait aveugle de polyfills ni changement de navigateurs supportés. Le signal demeure. |
| `lighthouse.audit.render-blocking-insight` | Signal persistant dans la solution stable | Quatre feuilles CSS demandées initialement, dont trois listées par le diagnostic de la passe contrôlée. Elles sont mises en cache indépendamment du document. Le gain LCP ne signifie pas que les styles ont cessé de bloquer le rendu. |
| `ssl.certificate.expiry_days` | Intervention externe requise | Lecture TLS publique avec validation de chaîne : certificat valide, Let’s Encrypt YR2, expiration le **26 novembre 2026 à 07:22:27 UTC**, 29 jours restants au contrôle. L’échéance est confirmée, pas une panne de renouvellement. Procédure ci-dessous. |
| `zap.alert.10202` | Non confirmé | Le formulaire public d’audit ne dépend pas des droits d’une session anonyme. Dès qu’un cookie de compte est présent, le BFF exige origine exacte, cookie CSRF et en-tête `X-Argos-CSRF` concordants avant tout appel au backend. La newsletter et la liste Premium ne relaient pas les droits de compte. Les tests de refus/acceptation sont passés ; aucun champ caché sans validation n’a été ajouté. Cela ne constitue pas un test d’intrusion en production. |
| `zap.alert.10037` | Corrigé et vérifié localement | La réponse publique exposait `X-Powered-By: Next.js`. Option désactivée dans `next.config.ts` ; absence contrôlée sur l’accueil et une réponse 404 locale. Vérifier aussi la réponse publique après déploiement. |

## Méthode de comparaison

Comparaison finale de trois versions : PR originale `016185ac`, essai avec
`inlineCss` `fa7533ae`, puis solution stable de cette PR. Les deux références ont
été reconstruites avec leur lockfile Next.js 16.4.2 ; la solution utilise 16.4.3.
Le code applicatif de `fa7533ae` ne diffère de `016185ac` que par `next.config.ts` :
la référence originale est reconstruite avec cette configuration d’origine.

Builds de production servis successivement sur **la même URL**
`http://localhost:3020/`, avec `API_BASE=http://127.0.0.1:3018` et le backend fictif
en lecture seule. Deux lectures HTML préparent chaque serveur avant la série.
Aucun build ni test n’a tourné pendant les mesures. Lighthouse **13.5.0**, Edge
headless **156**, mobile 412 × 823, DPR 1,75, CPU ×4, HTTP/1.1 local.

Deux méthodes conservées séparément :

- `simulate` : cinq passages à froid, profil mobile Lighthouse (RTT 150 ms,
  débit cible 1 638,4 kbit/s). Le modèle calcule le résultat à partir de la trace.
- `devtools` : ralentissement réellement appliqué au navigateur (latence des
  requêtes 562,5 ms, téléchargement 1 474,56 kbit/s, envoi 675 kbit/s). Trois
  passages à froid, puis trois avec cache dans le même navigateur temporaire.
  Les passes froides réinitialisent le stockage ; les passes chaudes conservent
  les ressources et leur transfert JS/CSS/polices est nul. Le navigateur est fermé
  après chaque série.

Tous les passages des séries finales sont conservés, y compris les valeurs les
moins favorables. Les essais exploratoires restent séparés et ne sont pas intégrés
aux médianes finales. Profils, échantillons, indices CPU, plages et médianes :
[`homepage-lcp-stable-2026-10-27.metrics.json`](homepage-lcp-stable-2026-10-27.metrics.json).
Le précédent fichier `homepage-lcp-2026-10-27.metrics.json` conserve l’historique
de l’essai expérimental ; il ne décrit pas la solution actuelle.

### Résultats de l’accueil

Valeurs médianes ; les transferts sont ceux enregistrés par le navigateur,
en octets, avec les en-têtes. Ils ne sont pas des tailles gzip calculées hors ligne.

| Mesure | PR originale | Essai inlineCss | Solution stable |
| --- | ---: | ---: | ---: |
| LCP simulé, 5 passages | 2 628 ms | 2 996 ms | **2 313 ms** |
| FCP simulé | 1 089 ms | 1 011 ms | 1 215 ms |
| TBT simulé | 45,5 ms | 66 ms | 114 ms |
| Score performance simulé | 97 | 94 | 98 |
| LCP appliqué, à froid | 2 431 ms | 1 300 ms | **2 142 ms** |
| LCP appliqué, avec cache | 1 150 ms | 1 003 ms | **1 095 ms** |
| TBT appliqué, à froid | 339 ms | 117 ms | 182 ms |
| TBT appliqué, avec cache | 150 ms | 37 ms | 148 ms |
| Score appliqué, à froid | 87 | 99 | 94 |
| Score appliqué, avec cache | 98 | 100 | 98 |
| CLS | ≈ 0,0001 | ≈ 0,0001 | ≈ 0,0001 |
| Feuilles CSS demandées initialement | 10 | 0 | 4 |
| Transfert CSS à froid | 19 803 | 0 (intégré au HTML) | 27 789 |
| Transfert JavaScript à froid | 226 705 | 226 705 | **179 498** |
| Transfert polices à froid | 53 518 | 53 518 | **29 849** |
| Transfert HTML à froid | 14 579 | 33 406 | 39 257 |
| Transfert total à froid | 343 910 | 342 934 | **305 698** |
| Transfert total avec cache | 16 834 | 35 668 | 41 517 |

La solution stable réduit le LCP simulé médian de **12,0 % face à la PR originale**
et de **22,8 % face à inlineCss**. Le JavaScript initial baisse de **20,8 %** et
le transfert total à froid de **11,1 %** face à la PR originale. Sous ralentissement
appliqué, les médianes LCP baissent de **11,9 % à froid** et **4,8 % avec cache**
face à la PR originale. Le faible écart avec cache reste dans la variabilité observée.

Les plages LCP simulées sont respectivement **2 595–3 545 ms**, **2 863–3 011 ms**
et **1 659–2 890 ms**. Pour la solution stable, le LCP appliqué va de
**2 054 à 2 327 ms à froid**, et de **1 049 à 1 215 ms avec cache**.

Compromis conservés dans le bilan :

- L’essai `inlineCss` reste plus rapide en LCP appliqué à froid (1,30 contre
  2,14 s) et avec cache (1,00 contre 1,10 s). Il a été retiré pour respecter le
  critère de stabilité et améliorer aussi l’estimation simulée.
- Le FCP et le TBT simulés augmentent. Cette PR ne revendique pas une amélioration
  de toutes les métriques ni de chaque passage.
- Le dictionnaire de la langue courante est sérialisé dans le document : le HTML
  et le transfert total avec cache augmentent. Les CSS restent externes et se
  mettent en cache indépendamment. Des styles inutilisés et le diagnostic CSS
  bloquant persistent avec le découpage par défaut.
- La station est partagée ; les indices CPU et tous les échantillons sont exposés.
  Cet échantillon local ne fournit ni intervalle de confiance ni mesure terrain.
  Les conditions publiques avec Traefik, HTTP/2 et backend réel restent à mesurer
  si une mise en ligne est décidée séparément. Aucun déploiement dans cette tâche.

### Contrôle d’un consommateur partagé

Le rapport d’exemple EN a aussi été mesuré sur trois passages simulés par version,
face à la dernière version avec `inlineCss` : LCP médian **3 496 → 3 485 ms**,
JavaScript **383 652 → 333 750 octets**, transfert total **516 325 → 459 293 octets**.
Le LCP est pratiquement identique dans cet échantillon ; aucun gain significatif
n’est revendiqué pour cette page.

### Reproduire

Installer les dépendances verrouillées de `apps/console-web` et
`apps/lighthouse-service` avec `npm ci`. Démarrer le backend de revue avec
`node .agents/skills/argos-visual-review/scripts/preview-backend.mjs`, puis compiler
et démarrer le frontend avec `API_BASE=http://127.0.0.1:3018` (`npm run build`,
`npm run start -- --port 3020`). Les deux processus doivent disposer du même accès
loopback. Préparer le serveur par deux lectures HTML avant de mesurer.

Définir `CHROME_PATH` vers le même Chrome/Edge pour toutes les versions, puis :

```text
node scripts/review/measure-homepage-lcp.mjs http://localhost:3020/ outputs/lcp/version-sim 5 0 simulate
node scripts/review/measure-homepage-lcp.mjs http://localhost:3020/ outputs/lcp/version-real 3 3 devtools
```

Ne pas lancer de build ou de tests pendant les mesures. Chaque commande écrit
ses rapports complets et `summary.json`. `ARGOS_LIGHTHOUSE_ROOT` peut réutiliser
une installation verrouillée de Lighthouse ; par défaut, le script utilise celle
de `apps/lighthouse-service`. Comparer les versions sur le même port, avec des
dossiers de sortie distincts. Les variantes de bundler, de police et le premier
prototype i18n explorés puis retirés ne font pas partie du code livré.

### Vérifications de non-régression

- Lint, build de production et TypeScript : succès. Syntaxe du script de mesure
  et `git diff --check` contrôlés avant livraison.
- **1 489 tests frontend distincts réussis** : suite complète de 1 487 tests,
  dont deux nouveaux contrôles de langue résolue au serveur, puis deux nouveaux
  cas PDF ciblés FR/EN. Les refus d’accès existants ont été rejoués avec ces cas.
  Trois tests éditoriaux et la structure FR/EN passent également.
- `node scripts/e2e/report-pdf.mjs` avec Edge installé : **24 PDF générés et
  contrats vérifiés** (FR/EN, synthèse/complet, accès public/propriétaire/partagé,
  expiration, compteurs uniques et absence de token dans l’aperçu). Le chargement
  du module différé, les feuilles de style et les polices sont donc exercés dans
  un navigateur réel. La capture HTML en média print `empty-en-summary.png` a été
  examinée ; toutes les pages PDF n’ont pas été inspectées manuellement.
- Accueil FR clair à **1280 × 900 et 390 × 844** : captures avant/après identiques
  octet pour octet. Un h1, aucun débordement horizontal. Les empreintes et preuves
  sont dans `outputs/ui-review/lcp-stable/review.md`.
- FR mobile : dialogue de retour chargé à la demande, focus initial, Escape,
  conservation/reprise/abandon du brouillon et retour du focus vérifiés sans envoi.
  Formulaire d’audit vide puis URL fictive : validation et refus attendu du backend
  en lecture seule, champ réactivé et valeur conservée. Aucun audit réel créé.
- EN sombre à 390 et 320 px : langue, thème, fermeture clavier du menu, focus
  et absence de débordement vérifiés. À 768 px, l’ancre reste visible à 136 px
  sous un en-tête finissant à 121 px. Navigation cliente vers l’exemple EN et
  changement de couverture vérifiés.
- Rapport fictif EN clair à 390 px : rendu, vue des constats techniques et
  commandes d’export vérifiés. Le navigateur de revue a affiché l’état d’export
  indisponible avec ces fixtures ; le succès PDF est vérifié par la recette
  contrôlée ci-dessus. État de connexion déjà active EN et 404 FR vérifiés.
- HTTP `/`, `/en`, rapport fictif et 404 : aucune bannière `X-Powered-By`, cache
  HTML privé/no-store, CSP des images conservée, nonce concordant sur tous les
  scripts et aucune balise `<style>`. Aucun message CSP dans la revue navigateur.
- Aucun compte réel, audit de production, envoi de retour ou déploiement. Cette
  couverture n’est ni une matrice manuelle exhaustive ni une certification WCAG
  ou PDF/UA ; aucun test avec lecteur d’écran n’est revendiqué.

Les rapports bruts, journaux et captures locaux sont ignorés par Git :
`outputs/lcp-stable/`, `outputs/ui-review/lcp-stable/` et
`outputs/pdf/report-fixtures/`. Le résumé des mesures et le script sont versionnés
pour la revue distante. Aucun test Maven n’est requis pour le code Java inchangé.


## Certificat : procédure pour l’exploitant

Le [renouvellement ACME de Traefik](https://doc.traefik.io/traefik/v3.2/https/acme/)
est automatique selon la durée configurée du certificat ; pour la durée par
défaut de 90 jours, la fenêtre commence 30 jours avant expiration. À 29 jours,
il faut examiner la configuration effective et les tentatives, sans conclure à
un échec à partir de cette seule alerte.

Accès requis : SSH au serveur hébergeant Traefik, droit de lire sa configuration
statique et ses logs Docker, et visibilité sur le volume de stockage ACME.
Le dépôt configure le resolver `le` mais ne contient pas la configuration
statique du Traefik qui le réalise. Aucun secret ACME n’est nécessaire dans une PR.

1. Identifier le conteneur avec `docker ps --filter name=traefik --format '{{.Names}}'`.
2. Lire `docker logs --since 48h <nom-du-conteneur-traefik>` et rechercher les
   erreurs ACME/renouvellement pour `argos.lelouet.fr`.
3. Vérifier dans la configuration statique effective que `certificatesResolvers.le.acme`
   est configuré, que son stockage persistant est monté et inscriptible par Traefik,
   et que le challenge configuré atteint bien ce serveur. Les labels du service
   sont dans `infra/compose/console-web/docker-compose.prod.yml`.
4. Selon le challenge trouvé, vérifier l’accès entrant HTTP port 80, TLS port 443,
   ou les droits du fournisseur DNS. L’accès DNS n’est requis que pour un diagnostic
   de challenge/DNS qui le justifie. Corriger la cause réelle avec l’accord de
   l’exploitant ; ne pas supprimer le stockage ACME ni forcer des renouvellements
   répétés.
5. Vérifier le certificat servi après renouvellement, par exemple avec
   `openssl s_client -connect argos.lelouet.fr:443 -servername argos.lelouet.fr -verify_hostname argos.lelouet.fr -verify_return_error`
   puis l’affichage de ses dates, et relancer le contrôle Argos. Vérifier chaque
   endpoint public si le DNS en annonce plusieurs. Une date inchangée ne prouve
   pas à elle seule un échec avant examen des logs et de la politique de renouvellement.

## Après approbation et mise en ligne

Relancer une analyse Argos complète de **la même URL** `https://argos.lelouet.fr/`,
et comparer les preuves plutôt que le seul score. Contrôler les en-têtes sur une
réponse 200 et 404, les mesures LCP/TBT, le dialogue de retour à la première
ouverture, les thèmes FR/EN et la navigation entre accueil et rapport.
Ne pas présenter les constats partiellement traités comme résolus.

Références : [configuration de la bannière Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/poweredByHeader)
et [correctif stable Next.js 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3).
