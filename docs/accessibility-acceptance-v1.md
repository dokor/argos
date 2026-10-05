# Réconciliation de l'épic accessibilité #257

État vérifié le 5 octobre 2026 sur `main`
`16a64484cea4afb52982484f1ba5f2e27d410e59`, avec le complément de cette PR.
La livraison technique permet de présenter des constats et hypothèses ;
la publication de règles réglementaires validées reste **en attente**.
Cette note ne ferme pas l'épic et n'autorise pas une sortie V1.

## Lots livrés

| Lot | PR fusionnée | Commit de fusion | État restant |
|---|---|---|---|
| #260 matrice réglementaire | [#267](https://github.com/dokor/argos/pull/267) | `68e1243f0dccee837977501b8e1102612d73fb81` | Validation juridique/produit et publication des règles |
| #261 constats Lighthouse | [#264](https://github.com/dokor/argos/pull/264) | `adf2f028de62eaa09beea4f158f9bbc2e6fe2474` | Complément score brut et tests transversaux ici |
| #262 qualification et risque | [#265](https://github.com/dokor/argos/pull/265) | `c0288ee2d22732b19174f4101cd1211af983a978` | Risque runtime UNKNOWN / RULES_PENDING |
| #263 rapport FR/EN | [#266](https://github.com/dokor/argos/pull/266) | `86625b6156f53ad048e087138be8e01d05a9c0be` | Wording final à valider avec #260 |

La fusion ne modifie pas `reviewStatus=PROPOSED` ni `Rules.pending()`.
L'épic conserve ces quatre subdivisions ; aucun lot duplicatif n'est créé.

## Critères d'acceptation et preuves

| Critère de #257 | Preuve technique | Limite / décision restante |
|---|---|---|
| Score Lighthouse, constats et risque séparés | `accessibilityEvidence.lighthouseScore`, score de domaine Argos et bloc de qualification ; test avec Lighthouse 93 et domaine Argos 78 | Une bonne note ne vaut pas conformité |
| Constats traçables, gravité, impact, recommandations, mapping | Normalizer, kinds i18n FR/EN, WCAG 2.2 partiel borné | Mapping non exhaustif, pas d'équivalence RGAA |
| Limites automatisation, couverture et plafond | MANUAL / NOT_APPLICABLE / NOT_TESTED / ERROR distincts, COMPLETE/PARTIAL/UNAVAILABLE, plafond 50, compte complet | COMPLETE désigne la collecte des références, pas un audit humain complet |
| Quatre périmètres et cumul | `scopes[]`, fixtures publiques/entreprise/cumul | Les faits VERIFIED des fixtures sont des décisions de périmètre préqualifiées en interne |
| Confiance, signaux, manques, références et version | Snapshot `AccessibilityCompliance` sérialisé | Pas de questionnaire ni endpoint d'admission de faits vérifiés |
| Inconnues préservées, exceptions non déduites | 14 fixtures #260 et tests de qualification | Absence de signal = UNKNOWN ; déclarations insuffisantes pour exclure |
| Barème LOW/MEDIUM/HIGH/CRITICAL/UNKNOWN versionné | Tests de frontières de la proposition et riskReason explicite | **En attente** : barème et règles non approuvés ; runtime UNKNOWN |
| Anti-bot/indisponibilité sans faux verdict favorable | 14 cas × 3 états de collecte, normalizer et tests UI | Le score d'un domaine mesurable peut provenir d'autres checks ; le bloc brut indisponible reste inconnu |
| Sanctions conditionnelles et sourcées | Matrice #260, aucun montant dans le rapport | **En attente** : revue du régime et du wording, aucun calcul d'amende |
| Rapport FR/EN complet et distinct | AccessibilitySection et tests DOM ; deux scores distincts | Wording final à approuver |
| Lecture des anciens rapports sans requalification | Aller-retour JSON interne/public, score brut absent reste null | Aucun recalcul/migration SQL |
| Cas PME, commerce, public, entreprise, cumul, exemption, inconnu | Fixtures #260 exécutées à travers normalisation, qualification, composition et JSON | Pas une preuve d'éligibilité légale des entrées financières brutes |
| Bon score sans conformité, parcours humains signalés | Fixture Lighthouse 93 avec défaut, tests UI et message de contrôle humain | Clavier/focus non mesurés restent à contrôler |

## Complément apporté à la livraison

Le domaine Accessibilité Argos combine des checks HTML et Lighthouse ; sa
note ne doit pas être présentée comme la note brute de Lighthouse.
Le snapshot ajoute un champ optionnel `lighthouseScore` (0–100) extrait
de la catégorie collectée. Les anciens snapshots ne le reconstituent pas.
Une catégorie non numérique, non finie ou hors [0,1] produit un score brut
null et une collecte PARTIAL ; les findings disponibles sont conservés.
Anti-bot, erreur runtime et collecte indisponible ne produisent aucune note
brute favorable.

`AccessibilityAcceptanceTest` traverse les 14 fixtures dans trois états
de collecte, puis sérialise le rapport interne, compose et sérialise le
rapport public. Il vérifie les versions, règles non validées, risque
UNKNOWN, états manuels/inapplicables et exclusion des extraits DOM privés.
Six entrées de score invalides et le cas Lighthouse 93 / Argos 78 complètent
ces 42 scénarios. Les tests DOM vérifient aussi les champs historiques et
les valeurs invalides. Ce sont des tests de contrat sans DB ni navigateur
réel, pas un audit RGAA manuel, un test opérationnel de production ou un
avis juridique.

## Admission finale et lien avec #259

Le responsable produit/juridique désigné doit enregistrer la validation de
la [matrice #260](accessibility-rules-v1.md), des fixtures attendues, du
barème de risque et du wording FR/EN avec auteur, date, version et preuves.
Une version publiée doit être distincte de
`accessibility-compliance-proposal-v1`. Le mécanisme futur d'admission de
faits vérifiés et d'activation doit être décrit avant de changer le runtime.
Aucun de ces éléments n'est déduit d'une fusion GitHub.

Les conditions de sortie demeurent dans
[#259](https://github.com/dokor/argos/issues/259) et la
[note NO-GO V1](release/v1-readiness-2026-10-05.md). Les preuves techniques
ci-dessus complètent son volet accessibilité ; elles ne remplacent pas les
validations réglementaires, de sécurité et d'exploitation restantes.

## Revue ADE 1.2.1

Tech Lead et QA : chaîne de contrat, provenance, distinction entre tests et
production. Backend et Frontend : compatibilité additive et scores séparés.
Security : aucun DOM privé ajouté, aucune collecte ou route supplémentaire.
Perspective legal-compliance : règles et approbation explicitement pendantes,
sans revendication de validation humaine ou juridique.
