# Archives documentaires

Ces documents conservent des constats et validations à une date et sur une
révision données. Leurs nombres de tests, états de tickets et mesures ne décrivent
pas automatiquement le code courant. Les réserves et validations différées
restent dans chaque compte rendu ; leur archivage ne les clôture pas.

Pour modifier ou exploiter Argos, partir de [l'index courant](../README.md).

## Authentification et comptes

| Date | Compte rendu | Référence maintenue |
| --- | --- | --- |
| 12 octobre 2026 | [Pages publiques Google OAuth, #512](accounts/google-public-policies-2026-10-12.md) | [Configuration et recette](../accounts/operations.md) |
| 13 octobre 2026 | [Diagnostic du callback LinkedIn, #548](accounts/linkedin-callback-2026-10-13.md) | [Configuration et recette](../accounts/operations.md) |
| 15 octobre 2026 | [Connexion, validation et reprise, #599–#601](accounts/auth-ux-599-601-2026-10-15.md) | [Parcours d'authentification](../accounts/authentication-ux.md) |
| 15 octobre 2026 | [Saisie, récupération et présentation, #602–#604](accounts/auth-ux-602-604-2026-10-15.md) | [Parcours d'authentification](../accounts/authentication-ux.md) |
| 15 octobre 2026 | [Inscription, langue et titres, #605–#607](accounts/auth-ux-605-607-2026-10-15.md) | [Parcours d'authentification](../accounts/authentication-ux.md) |

Les deux captures du lot #602–#604 accompagnent son compte rendu dans
`accounts/evidence/auth-602-604/`. Elles sont conservées comme preuves de cette
revue, sans servir de référence visuelle actuelle.

## Éditorial, audits et release

| Date | Document | Référence maintenue |
| --- | --- | --- |
| Juillet 2026, récupéré le 5 octobre | [Audit backend](backend-audit-2026-07.md) | [Maintenance](../maintenance.md) et [sécurité](../security/audit-chain-488.md) |
| 5 octobre 2026 | [Relevé de dépendances](dependency-remediation-2026-10-05.md) | [CI](../testing/ci.md) |
| 5 octobre 2026 | [Dossier V1 et validations différées](v1-readiness-2026-10-05.md) | [Révision des images](../release/runtime-provenance.md) et [runbook](../../infra/RUNBOOK.md) |
| 12 octobre 2026 | [Revue éditoriale, #478–#480](editorial-coherence-2026-10-12.md) | [Guide FR/EN](../product/editorial-guide.md) et [inventaire](../product/editorial-inventory.md) |

Le [JSON V1](../release/v1-evidence-2026-10-05.json) reste à son chemin d'origine :
la suite `scripts/check-release-evidence.test.mjs` l'utilise comme fixture historique
pour vérifier qu'un dossier incomplet reste NO_GO.

## Conservation

- Archiver un bilan daté en conservant ses résultats, limites, date et périmètre.
  Relier l'archive à sa référence maintenue et corriger les liens entrants.
- Garder hors des archives les contrats, runbooks, fixtures de tests et références
  figées encore consommées par les outils. Le dossier Clarté contient notamment
  une fixture partagée Java/Next et une référence visuelle avec empreintes.
- Placer les nouvelles sorties d'exécution dans `outputs/` ignoré ou dans les
  artefacts CI. Une preuve figée nécessaire à une décision peut rester versionnée,
  avec son contexte et ses liens.
- Pour les documents retirés lors du premier nettoyage, consulter
  [la version antérieure](https://github.com/dokor/argos/tree/cfeebe0/docs) et
  `git log --all -- docs/ancien-chemin.md`.
