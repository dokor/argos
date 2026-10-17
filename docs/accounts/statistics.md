# Statistiques métier de l’administration (#657)

La vue `/account/admin/analytics/overview` (et sa version `/en/…`) utilise
`GET /api/account/admin/statistics?period=all|7|30|90`. Les autres onglets
Mesure produit et Trafic conservent leurs métriques événementielles et leur consentement.

## Périmètre et périodes

Les comptes comprennent les lignes conservées de `ARG_ACCOUNT_USER`, y compris
les comptes archivés. Une période glissante UTC sélectionne leur `created_at`.
Les URL comprennent les `ARG_AUDIT` ayant au moins un run, anonymes et connectés
confondus. La période sélectionne la **première création de run** de chaque URL,
et non les relances. Une URL enregistrée ou découverte sans run reste exclue.

Les états et identités liés sont un **stock courant de la cohorte sélectionnée**,
pas des changements sur la période ni une reconstitution à une date passée.
Les requêtes partagent la transaction de session ; `generatedAt` borne les dates
de création retenues. L’actualisation est manuelle, sans cache de données privées.
Une erreur de requête échoue pour l’ensemble de la réponse : aucun zéro artificiel.

## Comptes et limites historiques

- Créés : nombre de comptes distincts, sans exclure les archives.
- Validation connue : `ACTIVE`, ou `SUSPENDED` avec `suspended_from=ACTIVE`.
  C’est le critère réel d’accès vérifié d’Argos, pas une inférence sur l’email social.
- Validation inconnue : archives (l’état précédent n’est pas retenu de façon
  fiable), ou suspension sans état antérieur. Ce nombre accompagne la validation.
- Suspendus / archivés : états métier actuels `SUSPENDED` / `ARCHIVED`.
  La validation peut recouper la suspension.
- Google / GitHub / LinkedIn : `COUNT(DISTINCT user_id)` par fournisseur parmi
  les identités **non désactivées**. Plusieurs identités du même fournisseur
  ne doublent pas un compte ; plusieurs fournisseurs peuvent compter le même
  compte. L’archivage désactive les identités. Aucune source d’inscription n’est
  déduite de ces liens, car elle n’est pas historisée.

L’historique est celui des données encore conservées. Le reset applicatif V27
et d’éventuelles suppressions ne peuvent pas être reconstruits. Aucun changement
du workflow de compte ou d’audit n’a été introduit pour combler ces limites.

## URL, exécution et domaines

`ARG_AUDIT.id` est l’identité persistée unique d’une URL normalisée, partagée
entre propriétaires et relances (`AuditDao.findOrCreate`, index unique existant).
On ne normalise pas à nouveau les anciennes URL pour les statistiques.
`UrlNormalizer` met schéma et hôte en minuscules, retire port par défaut et
fragment, normalise le chemin, retire le slash racine et conserve la query.
Les différentes pages d’un lot de domaine gardent chacune leur identité d’audit.

Le dernier run est choisi par `(created_at DESC, id DESC)`, indépendamment du
dernier rapport disponible. Les buckets sont `QUEUED`, `RUNNING`, `COMPLETED`,
`FAILED`, `CANCELED` et inconnu (tout autre statut). Leur somme égale le total
des URL. Une exécution terminée avec collecte partielle reste terminée :
aucune lecture de JSON de rapport ni conversion de couverture en échec.

Un domaine est le `ARG_DOMAIN` (nom d’hôte exact) rattaché à ces mêmes URL.
`www.example.com`, `example.com` et `shop.example.com` sont distincts, tandis
que les schémas HTTP/HTTPS d’un même hôte partagent son domaine. Les domaines
sans URL analysée dans la sélection sont exclus. Moyenne = URL uniques de la
sélection / domaines distincts de cette sélection ; zéro si le dénominateur est nul.

## Accès, volume et vérification

L’annotation `@AccountAccess("admin")` protège la route Java et le service
revérifie la session et le rôle ADMIN courant dans sa transaction. Le BFF
autorise uniquement GET et les périodes énumérées. La réponse est privée,
`no-store` et limitée aux agrégats et métadonnées de période ; aucune URL,
identité personnelle ni credential de rapport n’est transmis.

Trois requêtes SQL agrégées retournent un volume constant. V37 ajoute l’index
`(audit_id,created_at,id)` pour les sondes première/dernière tentative, et
`created_at` sur les comptes. La requête des URL parcourt les identités, pas
les résultats ou rapports volumineux ; chaque statement est borné à 15 secondes.
Les performances sur le volume de production restent à mesurer avant d’envisager
un cache ou une table de synthèse.

Tests : `AdminStatisticsIT` (MariaDB 11.4, mêmes migrations que la production),
`AccountLifecycleIT.statisticsHttpRequiresCurrentAdministratorAndOnlyExposesAggregates`,
`AccountAdminAccessTest`, `StatisticsOverview.dom.test.tsx` et `admin-request.test.ts`.
