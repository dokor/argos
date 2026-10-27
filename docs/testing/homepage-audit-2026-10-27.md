# Vérification de l’audit de l’accueil du 27 octobre 2026

Périmètre : `https://argos.lelouet.fr/`, rapport généré à 09:26 UTC, issue #776.
La stack effectivement installée est Next.js 16.4.2 / React 19.2.3, TypeScript,
SCSS Modules, avec le BFF Next et le backend Java. Aucun déploiement ni écriture
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
- `apps/console-web/next.config.ts` : `poweredByHeader: false`, découpage CSS
  Turbopack `graph` pour limiter les styles aux routes concernées, puis
  `inlineCss: true` pour livrer ces styles dans le HTML et supprimer les allers-retours
  CSS bloquants du premier affichage. Ces options sont expérimentales. `inlineCss`
  s’applique à toutes les routes, augmente le HTML et empêche la mise en cache
  indépendante du CSS lors d’un rechargement complet. La documentation Next.js
  [déconseille actuellement son usage en production](https://nextjs.org/docs/app/api-reference/config/next-config-js/inlineCss).
  La PR reste en brouillon pour revue de ce compromis ; aucun déploiement n’est autorisé.
  Le bundler et les dépendances ne changent pas.
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
| `lighthouse.audit.max-potential-fid` | Modifié à vérifier | Même cause et mêmes fichiers. Le travail applicatif diminue ; le runtime React/Next reste nécessaire. Nouvelle mesure sur l’URL déployée requise. |
| `lighthouse.audit.network-dependency-tree-insight` | Modifié à vérifier | Le CSS partagé de 123 006 octets contenait des sélecteurs de rapport. Découpage dans `next.config.ts`. L’arbre fourni montrait des liens directs document → CSS, sans preuve d’une cascade d’imports anormale. Des ressources critiques et le diagnostic Lighthouse restent présents. Aucun préchargement spéculatif ajouté. |
| `lighthouse.audit.unused-css-rules` | Corrigé et vérifié localement | Le fichier public fourni et le build de référence sont identiques. Lighthouse signalait environ 18 Ko compressés inutilisés ; le build avec découpage `graph` ne signale plus de ressource dans cet audit. Les feuilles de style nécessaires aux autres pages sont conservées. |
| `lighthouse.audit.unused-javascript` | Modifié à vérifier, signal persistant | Les deux ressources précises du rapport contiennent les runtimes React DOM et Next.js. La couverture d’un premier chargement ne justifie pas de retirer leur code de navigation. Moins de JavaScript applicatif et d’hydratation avec le rendu serveur et l’import différé ; les deux runtimes restent signalés. |
| `zap.alert.10055` | Modifié à vérifier, traitement partiel | `img-src 'self' data:` est vérifié dans la réponse locale et le test du proxy. Les preuves ZAP regroupent aussi `style-src unsafe-inline` : cette autorisation reste nécessaire aux styles React actuels. L’alerte complète ne doit donc pas être déclarée éliminée. Retirer ces styles demanderait un chantier distinct couvrant notamment les rapports et les valeurs dynamiques. |
| `lighthouse.audit.total-blocking-time` | Modifié à vérifier | Même cause que les deux premières priorités. La réduction mesurée localement ne garantit pas la disparition du constat public. |
| `lighthouse.audit.largest-contentful-paint` | Amélioration vérifiée avec ralentissement appliqué, limite en simulation | CSS critique intégré au HTML. À froid : médiane 2,305 → 1,246 s ; avec cache : 1,186 → 1,038 s, avant/après correction de la PR. Le LCP calculé par le simulateur ne s’améliore pas ; les deux méthodes et leurs limites sont conservées ci-dessous. Aucune garantie de gain public. |
| `lighthouse.audit.legacy-javascript-insight` | Non confirmé comme code supprimable | La ressource pointée contient les polyfills générés par Next.js. Aucune preuve que la compatibilité visée puisse être abandonnée. Aucun retrait aveugle de polyfills ni changement de navigateurs supportés. Le signal demeure. |
| `lighthouse.audit.render-blocking-insight` | Corrigé et vérifié localement | Aucun téléchargement de feuille CSS au chargement initial de l’accueil corrigé ; styles présents dans le HTML. Le diagnostic ne liste plus de ressource bloquante dans la passe locale contrôlée. Les styles des composants différés restent chargés à leur ouverture. |
| `ssl.certificate.expiry_days` | Intervention externe requise | Lecture TLS publique avec validation de chaîne : certificat valide, Let’s Encrypt YR2, expiration le **26 novembre 2026 à 07:22:27 UTC**, 29 jours restants au contrôle. L’échéance est confirmée, pas une panne de renouvellement. Procédure ci-dessous. |
| `zap.alert.10202` | Non confirmé | Le formulaire public d’audit ne dépend pas des droits d’une session anonyme. Dès qu’un cookie de compte est présent, le BFF exige origine exacte, cookie CSRF et en-tête `X-Argos-CSRF` concordants avant tout appel au backend. La newsletter et la liste Premium ne relaient pas les droits de compte. Les tests de refus/acceptation sont passés ; aucun champ caché sans validation n’a été ajouté. Cela ne constitue pas un test d’intrusion en production. |
| `zap.alert.10037` | Corrigé et vérifié localement | La réponse publique exposait `X-Powered-By: Next.js`. Option désactivée dans `next.config.ts` ; absence contrôlée sur l’accueil et une réponse 404 locale. Vérifier aussi la réponse publique après déploiement. |

## Méthode de comparaison

Trois versions comparées : référence `42d549d4` de `origin/main`, PR avant
correction `016185ac`, puis cette PR avec `inlineCss: true`. Le contenu et les
polices sont identiques. Les optimisations de rendu serveur et de dialogue différé
de la PR sont conservées.

Chaque frontend a été compilé avec `API_BASE=http://127.0.0.1:3018`, puis servi
successivement sur **la même URL** `http://localhost:3020/`. Le backend de revue
fournit des fixtures fictives et refuse les écritures. Dépendances verrouillées,
Lighthouse **13.5.0**, Microsoft Edge headless **156**, viewport mobile 412 × 823,
DPR 1,75, CPU ×4. Aucune compilation ni suite de tests pendant les mesures.

Pour observer le navigateur avec les contraintes réellement appliquées, le script
[`scripts/review/measure-homepage-lcp.mjs`](../../scripts/review/measure-homepage-lcp.mjs)
utilise `throttlingMethod: devtools` : latence de requête 562,5 ms, téléchargement
1 474,56 kbit/s, envoi 675 kbit/s (paramètres du profil Lighthouse mobile).
À froid, Lighthouse réinitialise le stockage à chaque passe. Les passes avec
cache réutilisent le même navigateur temporaire sans réinitialisation ; le
transfert des scripts et feuilles CSS y est nul. Le navigateur est fermé ensuite.

Trois passes par état de cache pour la référence et la PR avant correction ;
deux séries indépendantes de trois passes par état pour la correction, soit six.
Toutes les valeurs du tableau sont des médianes ; les échantillons, profils et
plages sont versionnés dans
[`homepage-lcp-2026-10-27.metrics.json`](homepage-lcp-2026-10-27.metrics.json).

| Mesure avec ralentissement appliqué | Référence | PR avant correction | PR corrigée |
| --- | ---: | ---: | ---: |
| LCP à froid | 2 017 ms | 2 305 ms | **1 246 ms (−45,9 % vs PR)** |
| LCP avec cache | 1 045 ms | 1 186 ms | **1 038 ms (−12,5 % vs PR)** |
| TBT à froid | 170 ms | 158 ms | 123 ms |
| TBT avec cache | 61 ms | 29 ms | 27 ms |
| Score performance à froid | 96 | 93 | 99 |
| Score performance avec cache | 100 | 100 | 100 |
| CLS | ≈ 0,0001 | ≈ 0,0001 | ≈ 0,0001 |
| Feuilles CSS demandées au chargement | 4 | 10 | 0 |
| Transfert CSS à froid | 25 782 octets | 19 803 octets | 0 octet (intégré au HTML) |
| Transfert JavaScript à froid | 240 720 octets | 226 705 octets | 226 705 octets |
| Transfert total à froid | 360 546 octets | 343 913 octets | ≈ 342 935 octets |
| Transfert total avec cache | 13 477 octets | 16 832 octets | 35 664 octets |

Le LCP corrigé s’étend de **1 203 à 1 370 ms à froid**, et de **967 à 1 154 ms
avec cache**. Le CSS arrive avec le document : le navigateur n’attend plus dix
réponses CSS pour afficher l’accueil. Les gains de JavaScript de la PR initiale
sont conservés. Le HTML plus volumineux explique le transfert supérieur avec
cache ; les résultats locaux ne prouvent pas que ce compromis sera favorable
pour toutes les routes ou conditions réseau.

La première comparaison ne comportait qu’une passe par version et annonçait
1,72 → 3,07 s de LCP **simulé**. Les nouvelles séries avec ce même mode donnent :

| LCP calculé par le simulateur Lighthouse, trois passes | Référence | PR avant correction | PR corrigée |
| --- | ---: | ---: | ---: |
| Médiane | 2 635 ms | 2 629 ms | 3 031 ms |
| Minimum–maximum | 2 605–2 757 ms | 2 084–3 047 ms | 1 522–3 031 ms |

**La correction n’améliore pas cette estimation simulée.** La dispersion et les
traces des téléchargements/tâches Next/React empêchent de la confondre avec le
LCP observé sous ralentissement appliqué. Les deux résultats sont conservés ;
aucun passage favorable n’a été sélectionné pour représenter la série. Les
limites du simulateur ne sont pas une preuve d’un défaut de Lighthouse.

Le serveur local utilise HTTP/1.1, sans Traefik ni latence de backend public.
Cet échantillon de laboratoire ne constitue ni une mesure terrain ni une garantie
de gain en production. L’option Next.js reste **expérimentale et globale**, avec
le coût de cache décrit plus haut. La PR reste en **brouillon** pour revue du
compromis. Aucun déploiement n’a été effectué.

### Reproduire les mesures

Installer les dépendances verrouillées du frontend et de `apps/lighthouse-service`
avec `npm ci`. Démarrer le backend de revue avec
`node .agents/skills/argos-visual-review/scripts/preview-backend.mjs`, puis compiler
et démarrer le frontend (`npm run build`, `npm run start -- --port 3020`) avec
`API_BASE=http://127.0.0.1:3018`. Sous Windows, les deux serveurs doivent disposer
du même accès loopback.

Définir `CHROME_PATH` vers le même exécutable Chrome/Edge pour chaque version,
puis lancer depuis la racine, sans autre travail consommateur en parallèle :

```text
node scripts/review/measure-homepage-lcp.mjs http://localhost:3020/ outputs/lcp-comparison/version 3 3
```

Le script écrit chaque rapport Lighthouse et un résumé dans le dossier choisi.
`ARGOS_LIGHTHOUSE_ROOT` permet de réutiliser une installation verrouillée du
paquet Lighthouse ; par défaut, il utilise celle de `apps/lighthouse-service`.
Comparer les versions avec le même environnement, le même port et des dossiers
de sortie distincts. La seconde série de confirmation corrigée est conservée
séparément dans les preuves brutes et regroupée dans le fichier de métriques.

### Vérifications du rendu et des fonctionnalités

- `npm run lint` : succès.
- `npm test -- --maxWorkers=4` : **148 fichiers, 1 485 tests réussis**, plus les
  trois tests du contrôle éditorial et la validation de structure FR/EN.
- `npm run build` avec les options finales : succès, TypeScript inclus.
- `node --check scripts/review/measure-homepage-lcp.mjs` et `git diff --check` : succès.
- Accueil FR clair : captures avant/après **identiques octet pour octet** à
  1280 × 900 et 390 × 844. Un seul h1, aucun débordement horizontal ; les styles
  sont disponibles dès le premier document. Les empreintes sont dans le compte
  rendu local `outputs/ui-review/lcp-fix/review.md`.
- Dialogue de retour sur mobile : ouverture différée avec styles, focus initial,
  Escape, reprise du brouillon conservé, abandon explicite et retour du focus.
  Aucun retour n’a été envoyé.
- Formulaire d’audit : validation à vide et erreur du backend de revue après
  soumission d’une URL fictive ; champ réactivé et valeur conservée. Aucun audit
  réel créé. Les succès, refus anti-bot et refus CSRF sont couverts par les tests
  avec services simulés.
- Menu mobile, passage FR → EN et clair → sombre, fermeture Escape et focus
  contrôlés à 390 px ; accueil EN sombre sans débordement à 320 px. À 768 px,
  l’ancre « How it works » reste visible sous la navigation.
- Navigation client vers le rapport d’exemple EN sombre à 768 px et changement
  du scénario de couverture. Rapport fictif EN clair à 390 px : affichage et
  sélection des constats techniques. Pas de débordement observé.
- Connexion EN claire à 390 px : seul l’état « déjà connecté » fourni par la
  fixture a été vérifié. Page 404 FR claire à 390 px : rendu vérifié. Aucune
  erreur CSP dans les journaux de cette revue.
- Aucun compte réel, export PDF, relancement d’audit ni parcours privé complet
  en production n’est déclaré vérifié. La couverture ci-dessus n’est pas une
  matrice exhaustive de toutes les routes, langues, tailles et thèmes.

Preuves brutes locales non commitées : `outputs/lcp-regression/base-real/`,
`pr-before-real/`, `fix-real/`, `fix-confirm-real/`, séries simulées `base-*`,
`pr-before-*`, `inline-css-*`, journaux `final-tests.log`, `inline-css-build.log`
et captures dans `outputs/ui-review/lcp-fix/`. Le résumé des mesures et le script
sont versionnés pour la revue distante. Aucun test Maven n’est nécessaire pour
les sources Java inchangées.

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
et types/documentation du paquet Next.js 16.4.2 installé pour `cssChunking`.
