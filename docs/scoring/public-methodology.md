# Maintenir la méthode publique du score

Les routes `/methodologie-score` et `/en/scoring-method` décrivent
DefaultScorePolicy et ScoreService. À la consolidation du 12 octobre 2026,
le barème est V12 et la couverture weighted-coverage-v3. Les rapports historiques
gardent leurs propres versions et empreintes ; ne pas les recalculer.

## Sources et mise à jour

Lors d'un changement de policy, de poids, de ScoreService ou de
MeasurementCoverageService :

1. Mettre à jour les explications FR dans
   [la page méthode](../../apps/console-web/src/app/(fr)/methodologie-score/page.tsx)
   et sa [traduction EN](../../apps/console-web/src/app/en/scoring-method/page.tsx).
2. Recalculer l'exemple avec le catalogue actif ; vérifier indisponibilité d'un
   module/domaine, règles continues et redistribution des coefficients.
3. Vérifier les liens réciproques avec `/exemple-rapport` et
   `/en/example-report`, les ancres `#resume` et `#calcul`, puis les métadonnées
   et le HTML pré-rendu dans les deux langues. Relancer tests et build frontend.
4. Mettre à jour les dates éditoriales seulement pour une révision substantielle,
   selon la [provenance éditoriale](../product/editorial-provenance.md).

## Exemple réduit de référence

Le tableau utilise runtime.console.errors (5), runtime.js.errors (6),
http.security.hsts (8), http.security.csp (10), html.title (4),
html.meta.description.present (3), html.images.alt_coverage (4) et html.lang (2).
PASS = poids, WARN = moitié, FAIL = zéro pour ces contrôles discrets.

```js
Math.round(((8 / 11) + (8 / 18) + (5.5 / 7) + (6 / 6)) * 25) // 74
```

Lighthouse indisponible ne contribue pas aux dénominateurs ; les quatre domaines
restent mesurables. Cette simulation réduite n'est pas une couverture complète du
catalogue. Voir la [composition](domain-calibration.md) et la
[couverture](measurement-coverage.md). Les hypothèses SEO doivent être confrontées
aux requêtes réelles ; aucun volume de recherche n'est déduit de cet exemple.
