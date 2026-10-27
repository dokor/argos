# Fraîcheur des analyses

Chaque nouvel audit relance les collecteurs sélectionnés. Les analyses complètes
et les relances ciblées recalculent aussi la détection des technologies à partir
du HTML et des en-têtes HTTP collectés pour ce run. Le cache de signatures de
24 heures n'est plus lu ni alimenté. Les anciennes lignes de
`ARG_DOMAIN_ANALYSIS` sont ignorées, sans migration destructive ; le DTO conserve
`stackCache` pour permettre la lecture des rapports historiques. Les nouveaux
rapports ne portent pas ce cache et leur `reusedCheckKeys` est vide.

Le contrat de mesure passe à `analysis-measurements-v7` : les comparaisons avec
les anciens collecteurs sont signalées comme non comparables, sans modifier les
rapports historiques ni les poids du score.

L'enrichissement Ahrefs, lorsqu'il est configuré, est demandé pour chaque nouveau
rapport, sans cache partagé entre rapports. Une indisponibilité reste sans effet
sur le score.

SSL Labs demande `startNew=on` au premier appel uniquement, sans `fromCache`.
Les sondages suivants suivent l'analyse sans la redémarrer. `publish=off`, la
politique d'activation des scanners externes, les protections SSRF et les délais
restent applicables. Un quota, une erreur ou un dépassement de délai produit un
contrôle indisponible, sans revenir à un ancien résultat. SSL Labs peut retourner
une analyse déjà en cours pour le même hôte : c'est une limite du fournisseur.
Voir le [contrat SSL Labs v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md#invoke-assessment-and-check-progress).

Les pages d'une analyse de domaine suivent actuellement cette même règle : aucun
cache Argos partagé n'est conservé. Une optimisation future pourra mutualiser des
mesures communes pendant un même lot, si le gain est mesuré et sans réutilisation
entre deux lots ou avec un audit individuel. Les éléments propres à une page
doivent toujours être mesurés sur cette page.

Cette règle concerne les mesures d'Argos. Elle ne vide pas les caches du site ou
de son CDN, et les rapports déjà publiés restent des observations historiques.
