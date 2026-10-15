# Contribuer à Argos

Merci de l'intérêt que vous portez à Argos ! Ce document précise les règles de
contribution, de redistribution et d'exploitation liées à la licence du projet.

## Licence du projet

Argos est distribué sous **Business Source License 1.1** (BSL 1.1), une licence
*source-available* (voir le fichier [`LICENSE`](./LICENSE)). Ce n'est **pas** une
licence open source au sens de l'OSI : le code est public et modifiable, mais
son exploitation commerciale est encadrée.

Points clés :

- **Change Date : 2030-07-03.** Chaque version bascule automatiquement sous
  **Apache License 2.0** à cette date (ou 4 ans après sa première publication,
  au plus tôt).
- **Change License : Apache-2.0.**
- **Additional Use Grant :** l'usage en production est autorisé, sauf pour
  offrir à des tiers un service d'audit de site web concurrent (hébergé, embarqué
  ou managé) substantiellement similaire à Argos.

## Ce qui est autorisé sans autorisation supplémentaire

- Lire, auditer, cloner et modifier le code.
- L'utiliser en environnement non-production (développement, test, évaluation).
- L'utiliser en production dans les limites de l'*Additional Use Grant*.
- Proposer des correctifs et des évolutions via *pull requests*.

## Ce qui nécessite un accord préalable

- Exploiter Argos (ou un dérivé) comme produit ou service commercial d'audit
  de site web proposé à des tiers.
- Toute utilisation sortant du périmètre de l'*Additional Use Grant* avant la
  *Change Date*.

Dans ces cas, contactez le titulaire (voir `LICENSE`) pour une licence
commerciale.

## Règles de contribution

1. **Ouvrez une issue** avant toute contribution significative pour valider le
   besoin et l'approche.
2. **Branche dédiée** : partez de `main` à jour ; les branches Codex utilisent
   `codex/<sujet>`. Préserver les modifications locales étrangères au sujet.
3. **Vérifications adaptées** : installer les dépendances Node avec `npm ci`,
   utiliser Java 21 / Maven 3.9+ et Node.js 24 comme la CI.
   - Backend : `cd apps/api-backend && mvn clean verify` (tests, packaging, couverture).
   - Frontend : `cd apps/console-web && npm run lint && npm test && npm run build`.
   - Collecteur modifié : depuis son dossier, `npm run check && npm test`.
   - Pour un comportement modifié, ajouter un test de régression utile. Pour une
     suppression sans changement fonctionnel, conserver les tests des parcours
     actifs et prouver l'absence de consommateurs avant suppression.
4. **i18n** : toute chaîne visible doit exister dans `fr.json` **et** `en.json`.
5. **Migrations DB** : créez une migration Flyway `V(N+1)` et mettez à jour
   l'entité et la classe `Q*` correspondantes.
6. **Pull request** : décrivez le changement, liez l'issue (`Closes #N`), et
   attendez une review humaine. Aucun merge sans validation du mainteneur.

### Configuration, nettoyage et preuves

Les guides [backend](apps/api-backend/README.md) et
[frontend](apps/console-web/README.md) décrivent la configuration locale. Garder
les secrets hors du dépôt, `API_BASE` côté serveur et tous les appels navigateur
sur `/api/*`. Conserver les contrôles SSRF, de propriété et les contrats FR/EN.

Avant de supprimer du code ou une dépendance, chercher les imports, références
dynamiques, points d'entrée du framework, scripts, tests et usages de génération.
Documenter les éléments conservés ainsi que les sujets de suivi dans
l'[inventaire de maintenance](docs/maintenance.md). Ne jamais supprimer une
migration historique ni réécrire les données pour nettoyer le code.

La PR précise les commandes, leurs résultats réels et les limites de validation.
Les recettes MariaDB, navigateur et services externes ont leurs prérequis dans
l'[index de tests](docs/README.md) ; un test simulé ne prouve pas une recette en
production. Stocker logs et sorties ponctuelles dans `outputs/` ignoré ou dans
les artefacts CI du SHA testé. Ne pas déployer ni fusionner sans demande explicite.

### Propriété intellectuelle des contributions

En soumettant une contribution, vous garantissez en détenir les droits et vous
acceptez qu'elle soit distribuée sous la licence du projet (BSL 1.1, puis
Apache-2.0 à la *Change Date*). Vous conservez le droit d'auteur sur votre
contribution.

## Redistribution

Toute copie ou version modifiée d'Argos, ainsi que tout travail dérivé, reste
soumise à la BSL 1.1 et doit **afficher la licence de façon visible** (conserver
le fichier `LICENSE`). Ces conditions s'appliquent aussi si vous recevez Argos
d'un tiers.

### Relecture des textes visibles

Toute modification de texte public, d’interface ou de rapport suit le
[guide rédactionnel FR/EN](docs/product/editorial-guide.md). L’inventaire des
routes et sources est dans [editorial-inventory.md](docs/product/editorial-inventory.md).
Le contrôle de structure fait partie de `npm run test` ; il ne remplace pas la
relecture humaine avant publication. Consigner dans la PR le relecteur, la date,
les parcours relus et les réserves ; indiquer clairement si cette revue est en attente.
