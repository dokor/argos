# Dossier go/no-go V1 — #259

Décision du mainteneur du **5 octobre 2026 : clôture de coordination avec
validations différées**. L'évaluation technique du snapshot reste NO_GO ; aucun
GO technique, contrôle Raspberry ou approbation réglementaire n'est attesté.
Les corrections des **PR #282–#289** sont vérifiées ensemble dans
[#290](https://github.com/dokor/argos/pull/290). Les PR #282 à #290 sont désormais
toutes fusionnées sur `main`.
Aucun déploiement, renouvellement de secret, enforcement GitHub ou GO n'est exécuté.

Actualisation après fusions : `main` observé à
`6ce6c73e04b52df816593b79116f57b10b222f61`. La résolution de #285 conserve les
quatre classes IT (migration, publication, claims, newsletter). Les nouveaux
checks main sont encore en attente d'exécution lors de cette décision ; aucun
succès sur ce SHA n'est revendiqué. Le code combiné précédent a ses preuves ci-dessous.
Les SHA/preuves ci-dessous et les états OPEN du JSON restent le snapshot historique
antérieur aux fusions. La présente PR ajoute la [traçabilité des images et le
collecteur de révision](runtime-provenance.md), testés sur fixtures uniquement.

## Décision de clôture et validations différées

Le mainteneur a indiqué dans la conversation Codex : « on peut quand meme
concidéré la 259 finalisé sans validation. Au pire on corrigera par la suite ».
Cette instruction remplace la condition de clôture initiale du ticket de coordination.
La décision et cette citation sont consignées dans [#259](https://github.com/dokor/argos/issues/259).

Les validations non faites sont **différées**, pas VERIFIED et pas approuvées :
rotation/révocation #219, règles #260 et parent #257, seuils produit/revue du score,
risque développeur braces, revue du backend #128, enforcement main, contrôles
Guice/Traefik/tiers réels, restauration pré-migration/ancien binaire, SHA réellement
déployé, santé/ressources Raspberry et CI sur le main final. Le risque résiduel est
celui de publier avant détection d'une régression, d'un problème de sécurité,
de conformité ou d'exploitation ; aucun impact ni probabilité n'est quantifié.
La clôture ne fournit pas de preuve de révocation ou d'avis juridique et ne ferme
pas ces tickets distincts. Elle n'autorise pas un déploiement de production.

Le validateur automatique conserve ses critères techniques : sa sortie NO_GO
signale les preuves absentes, même si le ticket de coordination est clos sur
décision humaine. Le JSON conserve les gates non vérifiés et ajoute la décision
séparée `coordinationDecision`. Aucun faux passage au vert n'est créé.

## Révisions et preuves

- Main inspecté : `f72c1e458a63c5271fd7d3ceda31f2dafcd7dd4c`, incluant les
  PR #279/#280/#281 pour #218/#226/#228, désormais fusionnées.
- Head combiné : `67dfb7a636b7d7d6bd68825a9695c098b1d62b2c`.
- **Révision exécutée par Actions** : `5ecdb81b477d87f61354d34306642ebca8cbb37c`,
  fusion synthétique de #290 sur `643362383dcedab78752270b7511452fc1ea13dc` (#288).
  Les logs checkout le consignent ; `git diff --quiet` entre merge et head retourne
  0 : arbres suivis identiques. **S** désigne cette révision exécutée ci-dessous.
  Les runs GitHub déclarent le head ; les artefacts déclarent le merge.
- Le snapshot fige le **code avant actualisation documentaire**. Aucun SHA/tag
  de release approuvé ni SHA déployé n'est désigné. Après fusion, choisir le SHA
  final de main et renouveler les preuves affectées. Configuration/image/migration
  modifiée exige aussi réévaluation.

| Vérification sur S | Preuve CI | Résultat |
|---|---|---|
| Quatre apps | [CI 37352222387](https://github.com/dokor/argos/actions/runs/37352222387) | PASS : 428 tests Java, 149 frontend, lint/build Next ; 10 runtime, 9 Lighthouse ; validateur de dossier |
| Migrations/publication/claims/newsletter | [MariaDB credentials](https://github.com/dokor/argos/actions/runs/37352222274) | PASS : 15 IT réellement exécutés par version (10.11 et 11.4), 12 concurrents sur un claim |
| Progression concurrente | [MariaDB progress](https://github.com/dokor/argos/actions/runs/37352222279) | PASS sur MariaDB 10.11 et 11.4 |
| Navigateur et restauration | [Controlled audit E2E](https://github.com/dokor/argos/actions/runs/37352222332/job/111905620795) | PASS : huit parcours Q→R→C, deux workers, un claim/rapport par run ; restore fixture |
| Secrets | [Secret scan](https://github.com/dokor/argos/actions/runs/37352222203/job/111905620148) | PASS : arbre courant, nouveaux commits et probe négative ; rotation non attestée |
| Dépendances npm de production | [Production dependency audit](https://github.com/dokor/argos/actions/runs/37352222382) | PASS : zéro vulnérabilité npm de production dans les trois apps JS |

Les **13 liens de jobs exacts**, SHA des PR et résultats expurgés sont conservés
dans le [snapshot JSON](v1-evidence-2026-10-05.json). Les artefacts CI ont une
rétention de 14 jours : sauvegarder les preuves expurgées ou les rejouer avant
expiration. Aucun dump, secret ou lien privé de production ne doit être publié.

## Matrice actualisée

Tous les résultats ci-dessous concernent **S**. CI_VERIFIED concerne le périmètre
testé, pas une revue humaine ou une validation d'exploitation. Les responsables
sont des rôles proposés ; aucune acceptation nominative ou exclusion n'est acquise.

| Exigence | Issue / PR | SHA / preuve | Résultat | Responsable | Décision / risque restant |
|---|---|---|---|---|---|
| Accès privés | #218 / [#279](https://github.com/dokor/argos/pull/279) fusionnée | S / HTTP + E2E | CI_VERIFIED | Security, exploitant | Vérifier cookie/Bearer et refus sur déploiement réel |
| Secrets | #219 / [#282](https://github.com/dokor/argos/pull/282) | S / scan | CODE_VERIFIED | Security, exploitant | Rotation/révocation et décision sur historique attendues ; #219 reste partielle |
| Budget d'audit | #223 / [#284](https://github.com/dokor/argos/pull/284) | S / Java, Node, E2E timeout | CI_VERIFIED | Backend, DevOps | Collecte 115 s + réserve publication 5 s ; attente scheduler séparée, DB/RAM Pi à mesurer |
| Tokens hachés | #226 / [#280](https://github.com/dokor/argos/pull/280) fusionnée | S / migration/lecture MariaDB | CI_VERIFIED | Security, Backend | Revue sécurité ; V7 irréversible par simple rollback d'image |
| Écritures publiques | #227 / [#285](https://github.com/dokor/argos/pull/285) | S / HTTP quotas + newsletter concurrente | CI_VERIFIED | Security, exploitant | Config Traefik/proxies de confiance ; quotas par instance, reset au redémarrage |
| Publication atomique | #228 / [#281](https://github.com/dokor/argos/pull/281) fusionnée | S / AuditPublicationIT | CI_VERIFIED | Backend, QA | Vérifier déploiement ; ancien run orphelin réconcilié FAILED |
| Claims/contraintes DAO | #224 / [#283](https://github.com/dokor/argos/pull/283) | S / AuditClaimIT, deux MariaDB | CI_VERIFIED | Backend, QA | Fixture isolée, pas mesure de production |
| Comparabilité historique | #44 / [#287](https://github.com/dokor/argos/pull/287) | S / Java/frontend | CI_VERIFIED | Produit, Backend | Revue produit ; anciens scores jamais recomposés avec la policy active |
| Couverture/confiance | #48 / [#286](https://github.com/dokor/argos/pull/286) | S / catalogue, E2E dégradé | CI_VERIFIED | Produit, QA | Seuil 80 % par domaine à accepter ; scoring version 11 |
| Global/priorités | #249/#250 / #254/#270/#271 fusionnées | S / score/priorités | CI_VERIFIED | Produit, QA | Pas de doublon d'implémentation ; calibration produit distincte |
| Audit technique | #128 / #238 fermée sans fusion ; récupéré dans #290 | [Archive sourcée](../audits/2026-07-backend-audit.md) | DOCUMENT_RECOVERED | Mainteneur, Tech Lead | Constats de juillet historiques, revue actuelle attendue |
| Accessibilité | #257/#260–#263 / #264–#267/#272 fusionnées | S / acceptation technique | TECHNICAL_PARTIAL | Produit/juridique, QA | #260 reste PROPOSED/RULES_PENDING, sans approbation réglementaire |
| CI quatre apps | #258 / #268 fusionnée | S / quatre jobs verts | CI_VERIFIED | DevOps, QA | Choisir/rejouer SHA final après fusion |
| Required checks | #258 | API main : 404 protection, règles [] | BLOCKED | Admin dépôt | Enforcement absent ; contextes proposés ci-dessous |
| HTTP/HTML/runtime/Lighthouse | #151–#154 / #161/#162/#160/#164 fusionnées | S / unitaires + Chromium | CI_VERIFIED | Backend, QA | amd64 ; ARM64 et ressources non démontrés |
| SSL/Observatory/ZAP/Tech | #155–#158 / #163/#165/#166/#159 fusionnées | S / analyseurs réels, JSON contrôlé, DAO Tech | FIXTURE_VERIFIED | Security, Backend | Disponibilité upstreams live et AI hors suite |
| Parcours/concurrence | #64 / [#288](https://github.com/dokor/argos/pull/288) | S / E2E, MariaDB | CI_VERIFIED | QA, Backend | Injection directe ; Guice, Traefik et Pi hors preuve |
| Dépendances | #259 / [#289](https://github.com/dokor/argos/pull/289) | S / audit npm + tests | PRODUCTION_SCAN_PASS | Security, mainteneur | Advisory braces développeur sans correctif : acceptation nominative attendue ; pas scan OS |
| Backup/restore | #259 / #288 | S / controlled-restore.json PASS | FIXTURE_VERIFIED | DevOps, exploitant | Restore pré-migration et ancien binaire sur clone représentatif à prouver |
| Raspberry post-déploiement | #259 | Aucun déploiement effectué | UNVERIFIED | Exploitant | SHA/images/config, santé, audit, CPU/RAM/OOM manquants |
| Décision de coordination | #259 | Instruction du mainteneur, 5 octobre 2026 | CLOSED_WITH_DEFERRED_VALIDATION | Mainteneur | Clôture autorisée, preuves techniques toujours manquantes |

## Parcours contrôlé et limites

La [suite #64](../testing/controlled-e2e.md) démarre Next en build de production,
Jersey, MariaDB 11.4, deux workers et Chromium. Le navigateur soumet le formulaire,
observe QUEUED, RUNNING et le rapport COMPLETED. Huit runs ont chacun une tentative
de claim et un rapport ; les lectures privées anonymes sont refusées. Les courses
de claims/publication et migrations sont aussi testées sur MariaDB 10.11/11.4.

| Fixture | Couverture pondérée | Score provisoire | Parcours |
|---|---:|---|---|
| Saine, erreurs, redirection | 98,17 % | non | QUEUED → RUNNING → COMPLETED |
| Lighthouse partiel | 87,21 % | oui, domaine insuffisant | idem |
| Lighthouse vide | 77,17 % | oui | idem |
| Runtime/Lighthouse indisponibles | 61,19 % | oui | idem |
| Anti-bot | 17,94 % | oui | idem |
| Timeout HTTP | 16,59 % | oui | idem |

Ces chiffres décrivent les fixtures, pas une calibration de production. Les
mesures indépendantes sont préservées ; panne HTTP/anti-bot ne deviennent pas
des défauts de contenu. Couverture et qualité sont distinctes, sans verdict de
conformité dérivé. SSL/Observatory/ZAP utilisent des JSON contrôlés, AI pass-through,
origine documentaire remappée vers loopback dans le transport de test uniquement.
Pas d'exception SSRF de production. La suite ne prouve ni Guice de production,
ni Traefik, ni disponibilité live des tiers, ni ARM64.

## Sécurité et dépendances

Le [relevé détaillé](../security/dependency-remediation-2026-10-05.md) décrit les
upgrades Next 16.3.8, Vitest 4.1.11, Lighthouse 13.5.0, Playwright 1.63.0 et
Node 24.21.0. Images headless alignées sur `v1.63.0-noble`. Les trois arbres npm
de production n'ont plus de vulnérabilité déclarée au scan. Le frontend conserve
cinq entrées high, propagation d'un seul advisory braces dans ESLint : outil retiré
du runtime, motifs du dépôt en lint/build. Cette analyse d'exposition ne vaut pas
acceptation ; consigner décideur, date, justification et risque avant sortie.

Le [lot secrets](../security/secret-remediation.md) retire les littéraux, valide
la config au démarrage et ajoute Gitleaks. Il n'invalide pas les credentials
anciennement publiés. Attester renouvellement/révocation et décision sur historique
sans communiquer de valeurs. L'[archive #128](../audits/2026-07-backend-audit.md)
restaure le livrable de #238 sans nouvelle roadmap ni validation rétrospective.

## Required checks à proposer à l'administrateur

Lectures authentifiées du 5 octobre : `branches/main/protection` = 404 Branch not
protected ; `rules/branches/main` = []. Après fusion de tous les workflows,
proposer les **13 contextes exacts de ciChecks dans le JSON**, PR obligatoire et
branche à jour. Vérifier l'application avec une PR témoin et refus d'un check
rouge/absent. Ne pas activer un contexte absent d'une branche encore à revoir.
Ce dossier n'applique aucun réglage GitHub et n'atteste aucun administrateur.

## Migrations, sauvegarde et retour arrière

V7 remplace les tokens en clair par SHA-256, préserve les liens migrables et
réconcilie certains runs sans credential en FAILED. V8 passe les anciens COMPLETED
sans rapport en FAILED. Les IT prouvent lecture/expiration, rollback transactionnel,
retry et fencing. L'E2E restaure le **schéma courant** sur une autre DB et compare
comptes/digest d'IDs, run IDs, hashes et JSON figés : PASS.

Avant déploiement, l'exploitant doit exécuter sur clones autorisés et consigner :

1. Ancien SHA, quatre images par digest, config expurgée, MariaDB, état/checksums
   Flyway et nouveau candidat. Geler scheduler et ingress d'écriture pour la
   sauvegarde de référence et attendre les runs actifs.
2. Backup cohérent (`mariadb-dump --single-transaction --hex-blob`, tables
   transactionnelles, pas de DDL concurrent) plus configs compatibles. Stockage
   privé chiffré, accès/restauration contrôlés ; aucun dump de production en CI.
3. Restaurer vers une DB/stack isolées, vérifier Flyway, comptes, rapports/liens
   privés, expiration et refus anonymes. Démarrer l'ancien binaire sur ce clone
   pré-migration et prouver un audit de contrôle, preuves expurgées.
4. Appliquer V7/V8 sur un second clone avec le nouveau binaire et rejouer audit,
   liens migrés, réconciliation des statuts et absence d'orphelins ; relever durée.
5. Après V7, **ne pas lancer l'ancien binaire sur le schéma haché** : tokens non
   reconstructibles. Restaurer backup pré-migration et anciennes images/configs,
   ou valider une correction en avant. Réconcilier les écritures depuis le backup,
   fixer RPO/RTO et point de gel ; aucune perte implicite acceptée.
6. Consigner opérateur/date, SHA/digests, résultats, RPO/RTO et anomalies. Réactiver
   les écritures après santé/audit acceptés. Le restore fixture ne remplit pas ce gate.

## Acceptation Raspberry et décision

Les workflows deploy réagissent déjà à main et ne séquencent pas tous les services
derrière la CI. Avant fusion, l'exploitant doit maîtriser ces déclencheurs et la
fenêtre de migration ; leur présence ne vaut pas autorisation de production.
Après déploiement autorisé seulement : relever révision **effectivement active**,
digest/config/architecture des quatre services, versions Node/Java/Chromium,
santé et audit contrôlé complet/dégradé, tiers, attente scheduler séparée de
l'exécution, pics CPU/RAM/DB, OOM et nettoyage navigateurs. Une image ARM64
disponible ne prouve pas son fonctionnement sur Pi. Fixer les seuils avec matériel
et charge avant acceptation. Le [runbook](../../infra/RUNBOOK.md) aide au diagnostic.

| Champ de décision #259 | Valeur actuelle |
|---|---|
| Coordination | Clôture demandée avec validations différées ; #282–#290 fusionnées |
| Évaluation technique | NO_GO du snapshot, validations humaines/opérationnelles manquantes |
| Décideur / date clôture | mainteneur dans la conversation Codex / 5 octobre 2026 |
| GO technique ou réglementaire | non attesté |
| SHA/tag release / environnement / SHA déployé | non désignés / inconnu / inconnu |
| Validations différées | liste ci-dessus ; aucun gate déclaré VERIFIED ou EXCLUDED artificiellement |
| Preuves automatiques | S : 13 jobs verts, huit E2E, transactions MariaDB, restore fixture |
| Clôture | décision explicite du mainteneur de finaliser sans attendre les validations |

## Contrôle du dossier

```sh
node --test scripts/check-release-evidence.test.mjs
node scripts/check-release-evidence.mjs docs/release/v1-evidence-2026-10-05.json --sha 5ecdb81b477d87f61354d34306642ebca8cbb37c
```

Le validateur exige les **13 checks**. Le second appel donne **NO_GO, exit 1**,
attendu : les preuves de code/fixture ne sont pas promues en REVIEW/OPERATIONS.
Seuls les gates CODE #249/#250 sont VERIFIED. Un dossier complet donne
READY_FOR_HUMAN_REVIEW, jamais GO. Une preuve VERIFIED exige kind approprié,
SHA, URL, auteur/date ; EXCLUDED exige décision humaine datée, SHA, justification
et risque résiduel. Le mainteneur doit vérifier identité et contenu des liens.
Pour une validation technique ultérieure, créer un nouveau snapshot SHA/environnement
réel et renouveler les preuves, conserver cette provenance. La clôture de coordination
est la décision humaine consignée séparément ; elle ne change pas ces résultats.
