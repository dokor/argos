# Protection de main

La configuration demandée est versionnée dans
[`main-ruleset.json`](../../.github/main-ruleset.json). Sa présence dans Git ne
prouve pas son activation : le ruleset distant et sa décision sur une PR doivent
être vérifiés séparément.

Le ruleset cible uniquement `refs/heads/main`, impose une PR, les douze checks
CI/E2E issus de GitHub Actions et une branche à jour. Il ne configure aucun
acteur de contournement et bloque suppression et force push. Aucune approbation
d'un second compte n'est imposée au dépôt personnel.

## Vérification contrôlée

La PR de cette modification sert d'abord à constater un check `auth` manquant
sur un changement documentaire, puis un véritable test frontend rouge. Les
révisions, conclusions et décisions GitHub seront consignées ici après les
essais. Les échecs synthétiques seront retirés du contenu final.

Une décision `BLOCKED` sur une PR non brouillon et sans conflit est la décision
de fusion de GitHub. Les essais n'autorisent pas à fusionner une fixture en
échec ni à utiliser un contournement administrateur.

Références : [rulesets](https://docs.github.com/en/rest/repos/rules),
[checks requis](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
