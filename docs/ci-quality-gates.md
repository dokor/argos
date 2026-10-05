# CI des quatre applications — #258

Le workflow [.github/workflows/ci.yml](../.github/workflows/ci.yml) tourne sur chaque
PR et push sur main, sans filtre de chemins. Les jobs sont indépendants et leurs
noms de check sont stables :

| Job | Check à rendre obligatoire | Contrôles |
|---|---|---|
| api-backend-tests | API backend tests | Java 21, Maven tests |
| frontend | Frontend checks | npm ci, lint, Vitest, build Next.js/TypeScript |
| lighthouse | Lighthouse checks | npm ci, syntaxe server/app, contrats HTTP et concurrence |
| playwright | Playwright checks | npm ci, syntaxe server/app/domain, contrats HTTP et domaines |

Node **24.13.0** est fixé pour les trois jobs JS. Lockfiles séparés et cache npm
propre à chaque application. Contraintes vérifiées dans les lockfiles : Lighthouse
13.0.3 ≥ 22.19, Playwright 1.58.2 ≥ 18, Next 16.2.6 ≥ 20.9, Sass 1.101 ≥ 20.19.
Les services déclarent ≥ 22.19 comme socle commun ; les Dockerfiles embarquent les
nouveaux modules app.mjs. Aucun navigateur n'est lancé par les tests de contrat.

Les factories injectent le collecteur/navigateur : health et erreurs de validation
ne collectent rien. Les cas succès/partiel/échec ne fabriquent aucun score.
Lighthouse lit tout le JSON (pas seulement le premier chunk), borne à 64 Kio,
retourne 400/413 pour entrées invalides et 500 générique pour erreur/absence de LHR.
Playwright conserve le contrat de métriques et la navigation dégradée, corrige
l'appel hostOf absent et libère le navigateur même en cas d'échec de création du
contexte. Les erreurs du parser JSON ne publient pas de stack/contenu de requête.

Ces validations de format URL ne remplacent pas la validation SSRF BFF/backend
ni la validation des redirections/réseau. Les services restent internes. La CI ne
certifie ni le navigateur dans l'image ARM64, ni les performances Raspberry.

## Sécurité du workflow

Runner GitHub hébergé ubuntu-latest ; aucun accès au runner Raspberry ni secret
de production. Déclencheur pull_request, jamais pull_request_target. Permissions
contents:read uniquement ; checkout sans credentials persistées. Les PR de fork
restent soumises à la politique GitHub d'autorisation des contributeurs externes.
Pas de continue-on-error : un échec positif arrête son job. Les déploiements restent
dans les workflows existants, distincts de la décision de release.

Sources : [permissions et syntaxe](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[cache](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching),
[setup-node](https://github.com/actions/setup-node/blob/main/README.md),
[node:test](https://nodejs.org/download/release/v24.0.2/docs/api/test.html).

## Validation négative reproductible

Chaque job JS exécute après ses contrôles positifs :

```sh
node ../../scripts/verify-ci-failures.mjs frontend
# ou lighthouse / playwright depuis le dossier de l'application
```

Le script crée une fixture au nom réservé, exécute exactement npm run test,
exige un exit non nul **et** le marqueur CI_NEGATIVE_PROBE, puis retire seulement
sa fixture dans finally. Il refuse d'écraser un fichier existant. Le script échoue
si la régression passe, si le process expire ou si la commande n'a pas démarré.
L'échec injecté est attendu et vérifié ; il n'est jamais ignoré pour les vrais tests.

Pour tout rejouer depuis la racine après installation des dépendances :

```sh
node scripts/verify-ci-failures.mjs frontend lighthouse playwright
```

Les preuves locales et les logs des trois steps GitHub doivent être distingués.
La mutation prouve le chemin d'échec de la commande test ; elle ne teste pas
toutes les erreurs possibles de build, de navigateur ou d'infrastructure.

## Protections de main : action mainteneur requise

Le 5 octobre 2026, GET /repos/dokor/argos/branches/main/protection via le
connecteur GitHub a répondu **403 Resource not accessible by integration**.
Il n'a pas de droit Administration ; la protection réelle n'est donc ni lue ni
modifiée. Une CI verte ne démontre pas que la fusion est bloquée par ses checks.

Après apparition des checks de cette PR, @dokor doit, dans Settings →
Rules → Rulesets (ou Branches → protection main) :

1. Sélectionner main, activer le ruleset et exiger une PR avant fusion.
2. Activer les required status checks, ajouter les **quatre noms exacts** ci-dessus
   et sélectionner GitHub Actions comme source.
3. Exiger la mise à jour avec la branche cible si c'est la politique retenue ;
   vérifier les droits de contournement/admin selon la politique du dépôt.
4. Vérifier sur une PR contrôlée qu'un de ces checks échoué interdit réellement
   la fusion et conserver la capture/lien dans #258.
5. Confirmer les quatre noms et le résultat de vérification dans #258 avant GO V1.

[Documentation GitHub sur les branches protégées](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
Aucune preuve d'enforcement n'est inférée du fichier YAML.
