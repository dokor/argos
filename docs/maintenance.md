# Maintenance du code et des dépendances

## Inventaire de référence

Revue du 12 octobre 2026 pour [#476](https://github.com/dokor/argos/issues/476),
sur `main` à `c863572`. Périmètre : sources des quatre applications, manifestes,
lockfiles, points d'entrée, configuration Compose et guides de contribution.
Ce relevé porte sur les usages observables dans le dépôt ; ce n'est pas un audit
exhaustif du backend, de la sécurité ou des consommateurs externes.

Avant suppression, rechercher les noms de paquets, symboles et chemins dans les
sources, tests, scripts et configuration avec `rg`. Compléter la recherche par
la lecture des points d'entrée du framework, bindings Guice/Jersey, générateurs
et dépendances transitives. Une absence d'import seule ne suffit pas.

| Élément | Preuve et décision |
| --- | --- |
| `simple-http-request-builder`, `simple-http-rest-client` | Aucune référence hors manifeste/lockfile frontend. `ArgosApi.ts`, BFF et clients comptes utilisent `fetch`. Retirer les deux dépendances et leur transitif exclusif `simple-logging-system`. Conserver les versions et entrées natives de tous les autres paquets du lockfile. |
| `hasUrlScheme` dans `src/lib/url.ts` | Le seul consommateur est son propre test. Retirer l'export et ce test ; garder `normalizeInputUrl`, la regex partagée et les huit tests de normalisation des entrées. Aucune modification des validations SSRF BFF/Java. |
| `public/{file,globe,next,vercel,window}.svg` | Fichiers du modèle Next.js, sans référence dans le dépôt. Supprimer ces cinq assets. Conserver OG, manifest, logos sociaux et fixtures de démonstration utilisés. |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ARGOS_API_BASE` | Définies uniquement dans le Compose frontend, jamais lues. Retirer ces entrées ; le proxy et SSR utilisent `API_BASE` côté serveur. |
| README backend/frontend et démarrage racine | Instructions Plume/create-next-app, commandes d'installation non reproductibles et configuration locale manquante. Remplacer par les commandes réellement disponibles, variables obligatoires, exemple frontend sans secret et liens vers les contrats existants. |
| Générateur QueryDSL (#515) | Déplacé de `src/main/java` vers `src/querydsl/java`, ajouté aux sources de test uniquement par le profil explicite. Codegen et `javax.inject` deviennent des dépendances de test du profil ; aucun générateur dans le JAR/distribution. Connexion explicite à une base jetable, sortie vide hors `src`, sans lecture de la configuration applicative ni migration. Entités et Q* toujours maintenus manuellement. |

## Éléments conservés et sujets à traiter

| Sujet | Motif de conservation / suivi |
| --- | --- |
| Générateur QueryDSL de développement | Conservé dans le profil `querydsl-code-generation` pour une prévisualisation explicite ; [commandes et limites](../apps/api-backend/README.md#base-de-données). Aucun écrasement automatique des classes maintenues. |
| Authentification admin historique | `apps/console-web/src/proxy.ts`, dashboard, navigation et détails techniques des rapports utilisent encore `argos_admin` / `ADMIN_TOKEN`. Les comptes ont un autre mécanisme d'autorisation. Transition dédiée dans [#516](https://github.com/dokor/argos/issues/516), avec prérequis opérateur et tests d'accès. La migration de convention Next dans #517 conserve cette protection ; les futures modifications du point d'entrée doivent cibler `proxy.ts`. |
| Proxy Next et lockfiles | `turbopack.root` pointe sur le dossier de `next.config.ts` : `apps/console-web` dans le monorepo, `/app` dans le contexte Docker autonome. Le frontend ne dépend pas des packages ADE racine. Les deux lockfiles indépendants sont conservés. La CI construit le checkout et la cible Docker `build`, et refuse les avertissements de racine inférée et de convention middleware dépréciée ([#517](https://github.com/dokor/argos/issues/517)). |
| Dépendances headless | Express est utilisé par Playwright ; Lighthouse, chrome-launcher, Playwright et puppeteer-core sont importés par le service Lighthouse. Le double pilotage du navigateur sert notamment à la politique réseau ; aucune suppression opportuniste. |
| Dépendances backend | Nimbus OAuth/OIDC, Argon2 et Jakarta Mail sont utilisés par les comptes. Guice/Jersey, drivers DB, Flyway et WebJars ont des usages runtime/dynamiques. Aucun retrait sans preuve adaptée. |
| Migrations, QueryDSL généré, compatibilité des rapports | Préserver l'historique SQL, les entités/Q*, les fixtures et les replis pour les anciens rapports. Leur âge n'est pas une preuve de code mort. |
| Scripts racine ADE, fixtures et archives documentaires | Conserver les scripts explicitement lancés et les preuves datées ; ne pas confondre absence d'import et absence d'usage. L'index documentaire distingue déjà les archives des contrats actifs. |

Les trois nouveaux sujets sont rattachés à la
[milestone 16](https://github.com/dokor/argos/milestone/16) et à l'epic
[#474](https://github.com/dokor/argos/issues/474). Ils complètent les tickets
existants : diagnostic backend #128, refactoring #475, couverture composants
#194, contrôle post-déploiement #94 et parallélisme #212. Ces chantiers existants
ne sont pas recréés ni considérés comme réalisés par ce nettoyage.

## Validation d'un nettoyage

### Comparaison QueryDSL (#515, 12 octobre 2026)

Baseline : `4799e7b`, JDK 21.0.11, `mvn dependency:tree package -DskipTests`.
Après isolation : `mvn clean verify dependency:tree` sans profil (686 tests,
aucun échec, un test optionnel ignoré), puis
`mvn -Pquerydsl-code-generation -Dtest=QuerydslGeneratorTest package dependency:tree`
(trois tests du générateur réussis). Comparaison des arbres complets et des noms
de JAR dans `target/dist/api-backend/lib` :

| Artefact | Avant, scope compile / distribué | Sans profil après | Profil après |
| --- | --- | --- | --- |
| `plume-db-querydsl-codegen:5.0.1` | Oui | Absent | Test, non distribué |
| `querydsl-sql-codegen:5.1.0` | Oui | Absent | Test, non distribué |
| `querydsl-codegen:5.1.0` | Oui | Absent | Test, non distribué |
| `codegen-utils:5.1.0` | Oui | Absent | Test, non distribué |
| `ecj:3.26.0` | Oui | Absent | Test, non distribué |
| `javax.inject:1` | Oui, déclaration directe | Absent | Transitif de `querydsl-codegen`, test |

La distribution passe de 109 à 103 JAR, exactement ces six retraits ; activer le
profil ne change pas les 103 JAR. `QuerydslGenerator` est absent du JAR applicatif.
`querydsl-sql`, `querydsl-core`, Guice/Jersey et `jakarta.inject:2.0.1` restent
dans l'arbre runtime. `classgraph:4.8.177` reste requis par
`plume-web-jersey-monitoring` ; il n'est pas supprimé avec le codegen.

Le lancement explicite `test-compile exec:java` a généré une prévisualisation sur
une base H2 locale jetable ; les fichiers générés compilent avec le seul classpath
distribué. La recette MariaDB de CI complète cette vérification : démarrage de
`WebApplication` depuis la distribution, migrations dans un schéma CI neuf,
requête HTTP authentifiée à Jersey, génération hors sources et compilation.
Aucune migration historique, entité/Q* maintenue ou donnée existante n'est modifiée.

### Procédure générale

1. Vérifier les consommateurs sur le SHA de départ et documenter les exceptions.
2. Installer le lockfile final avec `npm ci`, puis exécuter lint, tests et build
   frontend. Vérifier l'audit des dépendances de production demandé par la CI.
3. Si le code ou les dépendances backend changent, exécuter `mvn clean verify` ;
   pour un collecteur modifié, `npm run check` et `npm test`, puis la recette
   headless pertinente. Les prérequis sont dans [l'index](README.md).
4. Contrôler le diff des migrations et données, les liens documentaires et
   `git diff --check`. Une suppression d'assets non référencés ne constitue pas
   une modification de l'interface active.
5. Consigner commandes, résultats et limites réels dans la PR et les artefacts
   du SHA testé. Une validation locale ne vaut pas recette de production.
