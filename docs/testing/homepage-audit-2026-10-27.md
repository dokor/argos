# Vérification de l’audit de l’accueil du 27 octobre 2026

Périmètre : `https://argos.lelouet.fr/`, rapport généré à 09:26 UTC, issue #776.
La stack effectivement installée est Next.js 16.4.2 / React 19.2.3, TypeScript,
SCSS Modules, avec le BFF Next et le backend Java. La documentation historique
mentionne encore Next.js 14. Aucun déploiement ni écriture de données de production
n’a été effectué.

## Changements livrés

- `apps/console-web/src/app/(fr)/LandingPage.tsx`, les routes `page.tsx` FR/EN et
  `components/marketing/HomeReportPreview.tsx` : la langue des contenus statiques
  est résolue côté serveur. Les formulaires, liens et préférences gardent leurs
  composants client. Les textes, classes de style et ancres sont conservés.
- `components/feedback/FeedbackButton.tsx`, `FeedbackButton.module.scss` et le
  nouveau `FeedbackDialog.tsx` : le dialogue et le formulaire sont importés à
  l’ouverture. Le brouillon, l’abandon explicite, le verrou pendant l’envoi et le
  retour du focus sont conservés. L’annonce de chargement ne déplace pas la navigation.
- `apps/console-web/next.config.ts` : `poweredByHeader: false` et découpage CSS
  Turbopack `graph`, pour éviter que l’accueil télécharge les styles de rapport.
  Cette dernière option est expérimentale et nécessite de surveiller les autres
  pages lors d’une mise à jour de Next.js. Le bundler et les dépendances ne changent pas.
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
| `lighthouse.audit.largest-contentful-paint` | Modifié à vérifier, amélioration non validée | Le contenu principal reste rendu sur le serveur. Le LCP simulé local est moins bon que la référence ; ne pas présenter cette PR comme une correction validée de ce constat. Comparer plusieurs passages en préproduction/prod avec le même profil et le même protocole réseau. |
| `lighthouse.audit.legacy-javascript-insight` | Non confirmé comme code supprimable | La ressource pointée contient les polyfills générés par Next.js. Aucune preuve que la compatibilité visée puisse être abandonnée. Aucun retrait aveugle de polyfills ni changement de navigateurs supportés. Le signal demeure. |
| `lighthouse.audit.render-blocking-insight` | Modifié à vérifier, signal persistant | Le volume CSS diminue, mais les styles nécessaires restent bloquants et plus fragmentés. Aucun chargement asynchrone susceptible de produire un affichage sans styles. Lire les mesures et leur limite ci-dessous. |
| `ssl.certificate.expiry_days` | Intervention externe requise | Lecture TLS publique avec validation de chaîne : certificat valide, Let’s Encrypt YR2, expiration le **26 novembre 2026 à 07:22:27 UTC**, 29 jours restants au contrôle. L’échéance est confirmée, pas une panne de renouvellement. Procédure ci-dessous. |
| `zap.alert.10202` | Non confirmé | Le formulaire public d’audit ne dépend pas des droits d’une session anonyme. Dès qu’un cookie de compte est présent, le BFF exige origine exacte, cookie CSRF et en-tête `X-Argos-CSRF` concordants avant tout appel au backend. La newsletter et la liste Premium ne relaient pas les droits de compte. Les tests de refus/acceptation sont passés ; aucun champ caché sans validation n’a été ajouté. Cela ne constitue pas un test d’intrusion en production. |
| `zap.alert.10037` | Corrigé et vérifié localement | La réponse publique exposait `X-Powered-By: Next.js`. Option désactivée dans `next.config.ts` ; absence contrôlée sur l’accueil et une réponse 404 locale. Vérifier aussi la réponse publique après déploiement. |

## Méthode de comparaison

Référence : commit `42d549d4` de `origin/main`, avant modifications. Le fichier
CSS et les deux fichiers JS visés par le rapport ont été téléchargés en lecture
seule ; leurs chemins et contenus correspondent au build de référence.

Frontend compilé avec `API_BASE=http://127.0.0.1:3018`, puis servi sur
`http://localhost:3020/`. Le backend de revue ne fournit que des fixtures
fictives et refuse les écritures. Les dépendances verrouillées ont été installées
avec `npm ci --no-audit --no-fund`.

Lighthouse **13.5.0**, Microsoft Edge headless, profil mobile par défaut,
ralentissement simulé CPU ×4, RTT 150 ms, débit 1 638,4 kbit/s. Une passe de
référence et une passe finale au repos sont des observations indicatives,
pas une comparaison statistique ni les conditions exactes du serveur public.
Les mesures de temps sont exécutées sans suite de tests concurrente. Le serveur
local utilise HTTP/1.1 ; une comparaison derrière le proxy public reste nécessaire.

Les tailles gzip sont calculées à partir des ressources `src`/`href` JS/CSS
référencées dans le HTML, incluant les ressources de secours émises par Next.
Ce ne sont pas des économies de transfert de production garanties.

| Mesure locale | Référence | Version proposée |
| --- | ---: | ---: |
| CSS référencé, brut | 130 551 octets, 4 fichiers | 46 097 octets, 10 fichiers |
| CSS référencé, gzip calculé | 23 203 octets | 12 829 octets (−44,7 %) |
| JavaScript référencé, brut | 843 775 octets | 802 345 octets |
| JavaScript référencé, gzip calculé | 271 011 octets | 257 005 octets (−5,2 %) |
| Travail du thread principal | 1 231 ms | 1 079 ms |
| Max Potential FID | 160 ms | 119 ms |
| Total Blocking Time | 110 ms | 34,5 ms |
| LCP simulé | 1 719 ms | **3 066 ms : dégradation, à résoudre/valider avant mise en production** |
| LCP observé sans ralentissement réel | 263 ms | 232 ms |
| Économies CSS inutilisé signalées | 18 073 octets | Aucune ressource signalée |
| Économies LCP du diagnostic CSS bloquant | 300 ms | 150 ms, diagnostic persistant |

Le score Lighthouse local passe de 99 à 94 malgré les gains de volume et de
blocage. Le LCP simulé se dégrade ; le LCP observé sans ralentissement n’est pas
une preuve d’amélioration pour les visiteurs. Le découpage augmente le nombre
de feuilles de style : cette PR reste en **brouillon** jusqu’à validation du
compromis en préproduction dans les conditions réseau du site. Les CSS inutilisés
ne suffisent pas, seuls, à juger une optimisation utile.

Vérifications effectivement exécutées sur les sources proposées :

- `npm run lint` : succès.
- `npm test -- --maxWorkers=4` : **148 fichiers, 1 485 tests réussis**, plus les
  trois tests du contrôle éditorial et la validation de structure FR/EN.
- `npm run build` avec le backend de revue local : succès, TypeScript inclus.
- `git diff --check` : succès.
- Lectures HTTP locales sur `/`, `/en` (200) et une URL inconnue (404) : aucune
  bannière `X-Powered-By`, CSP des images limitée à `'self' data:`.
- Revue au navigateur de l’accueil FR/EN, clair/sombre, largeurs 1280, 768,
  390 et 320 px : pas de débordement horizontal observé. Menu mobile, navigation
  de langue, validation d’un formulaire vide, preuve repliable, ouverture du
  dialogue, focus initial, Escape, conservation/reprise/abandon du brouillon et
  retour du focus contrôlés. Les envois réussis, refus anti-bot et refus CSRF sont
  couverts par les tests avec services simulés, sans écriture de production.
- Rapport d’exemple public à données fictives : contrôle de rendu et changement
  du scénario de couverture. Rapport fictif `review-complete-fixture` : rendu FR
  sombre à 1280 px, passage aux constats techniques et ouverture d’un détail,
  navigation vers EN avec conservation de la vue, rendu clair à 390 px sans
  débordement. Le serveur de fixtures doit disposer du même accès loopback que
  Next. Aucun compte réel, export PDF, relancement d’audit ni parcours privé
  complet en production n’est déclaré vérifié.

Preuves locales (non commitées) : `outputs/audit-homepage-before-lighthouse.json`,
`outputs/audit-homepage-final-lighthouse.json`, listes `*-assets.json`, journaux
`audit-homepage-tests.log` et `audit-homepage-build.log`, captures dans
`outputs/ui-review/homepage-audit/`. Aucun test Maven n’est nécessaire pour les
sources Java inchangées.

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
