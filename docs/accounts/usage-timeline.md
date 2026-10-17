# Historique graphique des crédits — #664

La section « Historique de consommation » de `/account/usage` complète le quota
courant et le journal paginé. Elle n’utilise aucune donnée de visites ou de
mesure produit et ne dépend pas d’un consentement analytics.

## Identités et comptabilité

- Source unique : `ARG_USAGE_RUN`, `state='COUNTED'`. Chaque ligne vaut un crédit.
  La clé primaire est le run : lots, modules, retries et lectures ne multiplient
  pas les débits. Les rapports partiels publiés comptent ; les réservations,
  libérations, échecs sans rapport et découvertes ne comptent pas.
- Date : `counted_at`, instant de publication, converti dans `usage.timezone`
  comme les périodes mensuelles du quota. JDBC, JVM et MariaDB restent configurés
  en UTC. Les limites de tranches sont calculées avec `java.time` : aucune table
  de fuseaux MariaDB ni durée arbitraire de 24 heures n’est nécessaire.
- Site / domaine : le modèle `ARG_ACCOUNT_SITE` rattache un propriétaire à un
  `ARG_DOMAIN` unique. La dimension analytique est donc l’hôte exact du domaine,
  avec le libellé commun « Site / domaine ». Aucun regroupement eTLD+1 : apex,
  `www` et autres sous-domaines restent distincts. Les débits restent visibles
  même si le site n’est plus suivi.
- URL : `ARG_AUDIT.id`, identité persistée de `normalized_url`, sans nouvelle
  normalisation ni fusion des chemins/paramètres. Une même cible peut avoir
  plusieurs runs débités. Les identifiants sont des chaînes décimales exactes.
- Rattachement anonyme : le débit existant du rattachement, à la publication
  d’origine, apparaît une seule fois. Aucun backfill supplémentaire. Une
  correction réelle du registre se reflète à la prochaine lecture ; l’écran
  ne déduit aucun remboursement d’une suppression/expiration de rapport.

Les LEFT JOIN sont uniquement des recherches d’identité 1:1 ; ils ne joignent
ni rapports, ni lots, ni URLs suivies. Une cible historique introuvable est
explicitement « indisponible » et reste incluse dans les totaux du propriétaire.

## Couverture

La remise à zéro mensuelle ne supprime pas le registre. L’historique restitué
peut donc couvrir plusieurs mois/années. Cependant V14 n’a pu reprendre que les
rapports encore présents et V27 a volontairement effacé les données Clarté.
`coverageFrom` est l’instant Flyway de la dernière de ces migrations réussies.
Avant cet instant, une tranche est marquée partielle ; une valeur absente est
un tiret et non un zéro confirmé. Les débits historiques réellement conservés
sont toujours affichés. Une date de migration inconnue rend toute la couverture
incertaine. `undatedCredits` signale les débits sans `counted_at`, impossibles
à placer dans le temps ; ils sont exclus des totaux datés, sans date inventée.
Un rattachement tardif peut enrichir une période passée.

## API personnelle

`GET /api/account/usage/timeline` via le BFF same-origin, session active vérifiée,
`Cache-Control: private, no-store`. Aucun propriétaire n’est accepté en entrée.

| Paramètre | Contrat |
|---|---|
| `granularity` | `DAY`, `MONTH`, `YEAR` ; défaut `DAY` |
| `dimension` | `GLOBAL`, `DOMAIN`, `URL` ; défaut `GLOBAL` |
| `from`, `until` | Dates ISO, début inclus / fin exclue ; obligatoires |
| `filter` | Répétable, au plus 20 identifiants distincts de la dimension, ou `unknown` |
| `q` | Recherche de cibles, au plus 200 caractères ; ne filtre pas le graphique |

Dates >= 1970, fin au plus à la prochaine frontière courante du fuseau des quotas.
Limites : 366 jours, 60 mois, 20 années. Mois au premier du mois, années au premier
janvier. Paramètres inconnus, doublons scalaires, sélections invalides et plages
non alignées sont refusés par le BFF et le backend. `GLOBAL` n’accepte aucun filtre.

La réponse contient le fuseau, la date de lecture, la couverture, le total,
les tranches `{from,until,total,values}`, les séries `{key,label,total}`, et au
plus 20 options de sélection avec `moreOptions`. Les cinq cibles principales
sont déterminées sur la période et la sélection ; le reste devient `other`.
La somme des séries, des tranches et du total est identique. La recherche porte
sur les options de la période du seul propriétaire, même avec un filtre forgé.
Les tokens, emails, données de rapport et identifiants de lots ne sont pas lus.

Au plus cinq requêtes SQL, indépendamment du nombre de runs : couverture,
débits non datés, options (sauf global), Top 5 et agrégation des tranches. Au
plus 6 séries × 366 tranches retournées. Chaque requête d’agrégation a un timeout
de 10 secondes. V36 ajoute `(user_id,state,counted_at)` pour les lectures de plage.
Les requêtes paramétrées excluent les réservations des lectures historiques.
Le registre complet ne transite jamais dans le navigateur.

## Vérification

`UsageTimelineServiceTest` couvre les bornes et rejets. `UsageTimelineIT` teste
les agrégats sur MariaDB, Top 5/Autres, cardinalité, recherche, propriétaires,
frontières calendaires, changements d’heure et utilisation de l’index de plage.
`AccountLifecycleIT` teste le véritable contrôle HTTP/session, la confidentialité
et l’absence de renouvellement d’activité. Les suites existantes `UsageIT` et
`AccountLifecycleIT` couvrent l’unicité de publication, les lots et rattachements.

```powershell
mvn test
mvn -P mariadb-integration -Dit.test=UsageTimelineIT,UsageIT,AccountLifecycleIT verify
```

Frontend : validation BFF, changements d’échelle, sélection multiple, recherche,
focus des barres, tableau, vide, erreur/retry, abandon des réponses obsolètes.
`scripts/e2e/usage-timeline.mjs` utilise exclusivement des réponses fictives en
loopback pour la recette 320/390/768/1440 px, FR/EN, clair/sombre. Les captures
sont enregistrées dans `outputs/ui-review/usage-timeline/`.
