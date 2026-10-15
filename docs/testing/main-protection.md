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

Le [ruleset 25165356](https://github.com/dokor/argos/rules/25165356) est actif
depuis le 15 octobre 2026. Son [relevé distant](evidence/main-protection-2026-10-15/ruleset.json)
est distinct du fichier de configuration souhaité.

La [PR #631](https://github.com/dokor/argos/pull/631), non brouillon et sans
conflit, sert aux deux essais négatifs :

| Cas | Révision de la PR | Décision GitHub | Preuve |
|---|---|---|---|
| `auth` absent, autres checks requis satisfaits | `c71cd220a06e44374c64035e1e0cb1d0180c4f4d` | `BLOCKED` | [Relevé](evidence/main-protection-2026-10-15/missing-check.json) |
| Un test Vitest volontairement rouge, autres checks requis réussis | `c6aabe33922d6db1c67c36602f430b7a3fe5e9f2` | `BLOCKED` | [Relevé](evidence/main-protection-2026-10-15/red-check.json) |

Le test rouge est le seul échec de sa suite : 856 tests réussis, un échec
`MAIN_PROTECTION_NEGATIVE_PROBE`. Il est retiré du contenu final de la PR.
La dernière révision de la PR fournit le contrôle positif, avec ses résultats
CI et sa décision de fusion disponibles sur GitHub.

Le check `auth` se déclenche désormais sur chaque PR et chaque push de `main`,
sans filtre de chemins. Il est aussi exigé par le vérificateur de preuves de
release. Les autres jobs conservent leurs filtres internes : GitHub accepte un
job explicitement `SKIPPED` ; ce statut diffère d'un check absent. Le dossier
de release exige, lui, une vraie réussite de chaque check au SHA candidat.

Une décision `BLOCKED` sur une PR non brouillon et sans conflit est la décision
de fusion de GitHub. Elle a été relevée en lecture seule : aucune mutation de
fusion n'a été tentée, aucune fixture en échec n'a été fusionnée et aucun
contournement administrateur n'a été utilisé.

Références : [rulesets](https://docs.github.com/en/rest/repos/rules),
[checks requis](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
