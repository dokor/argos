# Recette Premium CI — #467

[English](acceptance.en.md). État : **NO_GO**. Ce dossier ne vaut ni recette humaine,
ni autorisation de fusion, déploiement ou activation. Aucun environnement de recette
externe n'est disponible à ce stade (décision du 19 octobre 2026).

## Ce que démontre la CI

La branche candidate doit exécuter le workflow **CI** complet par `workflow_dispatch`
(les PR empilées ne déclenchent pas ce workflow réservé à `main`). Conserver le SHA
exact, l'URL du run, ses résultats et les artefacts ; un run d'un parent est seulement
une référence, jamais la preuve d'une modification ultérieure.

`PremiumCiJourneyIT` relie sur MariaDB 11.4 isolée : compte actif FREE et session
réelle → webhook HMAC dupliqué → relecture de facturation → droit Premium borné →
domaine à vérifier → clé → paire de mesures réservée atomiquement → publication →
verdict confirmé → rotation → remboursement ou expiration du droit. Il vérifie
absence de double débit, conservation des lectures et refus des nouvelles admissions.
La redirection navigateur et le webhook seuls n'accordent aucun droit.

Dans ce parcours, **Stripe, la preuve HTTPS/DNS et les mesures sont simulés**.
Le pipeline de collecte réel contrôlé est testé séparément par `ControlledAuditE2eIT` ;
le client portable et ses publishers tournent séparément contre des fixtures TLS.
Leur réunion ne constitue pas une exécution complète chez les fournisseurs.

| Critère #467 | Preuves automatisées à examiner au SHA candidat | Validation restante |
| --- | --- | --- |
| Client neuf et opt-out | `PremiumCiJourneyIT`, `portable-client-network.test.mjs`, modèles épinglés | Exécutions GitHub Actions et GitLab CI réelles, zéro mutation en opt-out |
| Autorisations Java/BFF | `CiEntitlementIT`, `CiTargetsIT`, `CiKeysIT`, `CiAdmissionIT`, `ci-management-proxy.test.ts`, `ci-machine-proxy.test.ts` | Matrice complète dans la topologie déployée, aucune route de contournement |
| Courses et coût | `CiQuotaIT`, `CiAdmissionIT`, `PremiumCiJourneyIT`, `AuditPublicationIT` | Reprise entre vrais runners et journal durable, pas de nouveau débit |
| Réseau et cleanup | Deux jobs natifs AMD64/ARM64, `ControlledAuditE2eIT`, `audit-security.test.mjs` | Pare-feu UID, IPv4/IPv6, sandbox et cleanup sur l'hôte cible |
| Confidentialité | `CiAdmissionIT`, `ReportRetentionIT`, `ci-boundaries.test.mjs`, tests de projection | Traefik/APM, traces et artefacts des fournisseurs, suppression des copies |
| Issues optionnelles | `publication-sync.test.mjs`, `github-publication.test.mjs`, `gitlab-publication-network.test.mjs` | Permissions réelles, visibilité, pagination, CAS/bail et restauration Azure |
| Facturation | `BillingIT`, `PremiumCiJourneyIT`, contrats et UI Billing | Sandbox Stripe réelle mensuelle/annuelle, Tax, portail, événements et impayés |
| Exploitation | Tests de capacité/refus, rétention, erreurs stables et interrupteurs | Mesure de charge sur cible, branchement et exercice des alertes |
| Docs et UX FR/EN | `public-docs.test.mjs`, `DeveloperDocs.dom.test.tsx`, sept groupes de revue visuelle | Lecture par développeur neuf, navigation et résolution d'erreurs sans assistance |

Pour chaque matrice d'accès, couvrir anonyme, non vérifié, FREE, Premium propriétaire,
autre compte, autre intégration, lecture seule, clé expirée/révoquée et compte archivé.
Tester Java direct et BFF, méthodes, versions inconnues, paramètres de chemin et
redirections ; aucune réponse ne doit révéler l'existence d'une ressource étrangère.
Les tests existants sont des preuves partielles : ne pas cocher une ligne entière
uniquement parce qu'un fichier de test de cette ligne passe.

## Exécution et rapport contrôlé

Depuis la racine, sans fournisseur ni secret externe :

```sh
python3 -B scripts/ci/test_premium_acceptance.py
cd apps/api-backend
mvn --batch-mode test
```

Les tests d'intégration ne passent pas silencieusement pour acquis en local : il faut
le schéma **jetable** `argos_credentials_test` sur MariaDB loopback et les variables
`ARGOS_TEST_CREDENTIALS_URL/USER/PASSWORD` du job CI. Le fixture le vide et rejoue
Flyway avant chaque test. Ne jamais lui donner une base contenant des données utiles.
La liste explicite du job CI inclut `PremiumCiJourneyIT` et tous les tests existants.

Après `mvn -P mariadb-integration ... verify`, le job collecte onze suites JUnit :
droits fermés par défaut CI/Billing, parcours joint, facturation, droits, domaines,
clés, quotas, admission/verdict privé, atomicité de publication et rétention.

```sh
# Appelé dans un checkout CI propre au GITHUB_SHA exact.
python3 -B scripts/ci/premium_acceptance.py --output outputs/premium-ci-acceptance.json
# Diagnostic local, toujours INCOMPLETE et NO_GO, même avec d'anciens rapports verts.
python3 -B scripts/ci/premium_acceptance.py --preview --output outputs/premium-ci-local.json
# Barrière explicite : échoue tant que la recette réelle et commerciale manque.
python3 -B scripts/ci/premium_acceptance.py --check-launch --output outputs/premium-ci-gate.json
```

Le rapport contient seulement SHA, statuts, nombres de tests, empreintes des fichiers
et identifiants fixes de blocage. Aucun nom de test, propriété JVM, corps, URL privée
ou erreur brute n'est copié. Rapport absent, XML ambigu/DTD/entité, trop volumineux,
suite étrangère, test ignoré, vide ou en échec ⇒ preuve invalide. Le checkout doit être
propre et lié au run GitHub courant ; un aperçu local ne peut devenir une preuve CI.
L'artefact synthétique est conservé 14 jours ; ce délai ne s'applique pas aux données
client (artefacts privés ≤7 jours, diagnostics ≤24 h, rapports serveur ≤30 jours).

`controlledStatus=PASS` valide uniquement ces onze suites. Les autres jobs du workflow,
le scan de secrets et la revue visuelle restent à examiner séparément. `launchStatus`
reste **NO_GO** : aucun JSON déclaratif ne peut lever les blocages hébergés/commerciaux.
Ce collecteur n'autorise pas le lancement ; enregistrer les vraies preuves dans #467,
puis faire évoluer le dossier de recette dans une PR examinée avant décision humaine.

## Recette réelle, quand les ressources seront disponibles

Utiliser deux comptes Argos, un domaine HTTPS contrôlé, une sandbox Stripe, un dépôt
GitHub et un projet GitLab.com dédiés, et un conteneur Azure **privé** pour le journal.
Configurer les secrets dans les emplacements protégés prévus par les modèles ; noter
seulement leurs références dans le dossier. Lire les runbooks liés avant chaque essai.

1. Partir d'un compte neuf ; souscrire en sandbox, vérifier facture EUR HT avec TTC
   réel selon la fiscalité, mensuel et annuel. Abandon/retour Checkout ne donne aucun
   droit. Rejouer webhook signé, doublon, retard, désordre, timeout, renouvellement,
   impayé, récupération, annulation/fin, remboursement, litige et isolation intercomptes.
2. Vérifier le domaine et sa révocation/renouvellement, créer une clé limitée à ce
   domaine et aux scopes utiles. Doctor ne résout ni ne contacte la cible et ne réserve
   rien. Vérifier absence de clé dans UI, presse-papiers involontaire et diagnostics.
3. Exécuter les deux modèles épinglés sur branche/environnement protégé, puis opt-out,
   aperçu et opt-in explicite d'issues. En dépôt public : `publicIssue` seul. Tester
   permission insuffisante, changement de visibilité, fork/PR/MR hostile et hash/provenance
   altérés ; aucun credential ne doit être fourni au code non fiable.
4. Rejouer même intention après perte de réponse, rotation, interruption et panne de
   publisher. Prouver un seul débit par mesure publiée, aucun nouvel audit, déduplication,
   pagination complète, refus fermé sur état ambigu et respect des notes/fermetures/
   ignorances humaines. Exercer CAS, bail, fencing, sauvegarde/restauration du journal
   entre runners réels. Azure et ses permissions ne sont pas remplacés par GITHUB_TOKEN.
5. Rechercher un marqueur synthétique dans logs/annotations/artefacts/issues/APM,
   y compris erreurs et verbose ; valider suppression et plafonds de rétention.
   Ne pas publier de dump ni de preuve contenant des secrets pour démontrer une fuite.
6. Exécuter les cas SSRF du [modèle réseau](network-threat-model-v1.md) sur la cible
   et démontrer non-contact interne, TLS strict, sandbox et absence de Chrome résiduel
   après timeout/déconnexion. Faire accepter la délégation SSL Labs/Observatory.
7. Faire suivre les docs FR/EN par un développeur neuf : compte, domaine, clé,
   exécution, diagnostic puis reprise. Évaluer les maquettes implémentées sur mobile,
   desktop, thèmes et clavier ; conserver une preuve expurgée et son SHA.

## Exploitation, capacité et assistance

Avant le pilote, brancher les signaux suivants sur une collecte interne authentifiée,
sans URL, email, owner, clé ou identifiant de fournisseur dans les labels. Le monitoring
JVM/Grizzly et l'état des collecteurs existent ; les alertes Premium et la mesure sur
l'hôte de production **ne sont pas attestées** par ce lot.

| Signal agrégé | Alerte et réponse à exercer |
| --- | --- |
| Âge de la plus ancienne admission en attente, durée des audits, nombre actifs/file | Attente dépassant le budget client ou file sans progression : suspendre les nouvelles admissions, vérifier workers/collecteurs |
| Refus capacité et quota par code stable, taux de 5xx et de contrôles impossibles | Hausse par rapport au pilote : corréler requestId privé, contrôler saturation, ne pas demander un nouveau POST |
| Refus d'authentification et limiteurs | Pic soutenu : vérifier abus/rotation, conserver des réponses indiscernables |
| Ancienneté de la dernière réconciliation, échecs et droits Stripe expirés/divergents | Approche de la fenêtre de fraîcheur de 15 min : incident Argos, vérifier lecture Stripe/webhook, aucune attribution manuelle compensatoire |
| Bail/journal et publications incertaines, erreurs de purge | Arrêter les mutations d'issues, restaurer/reconcilier l'état ; ne pas recréer d'audit ni prolonger la conservation |

Mesurer sur la cible au repos puis avec concurrence croissante bornée : CPU/RAM,
durées médiane/p95, attente, débit, refus et récupération après arrêt d'un worker.
Inclure deux mesures par admission, Chromium et la charge anonyme existante. Établir
seuils, fenêtre d'alerte, capacité technique et responsable d'astreinte à partir des
mesures ; ne pas extrapoler depuis le laptop ou les runners GitHub. Les limites
commerciales restent 30 analyses/mois/clé, 3 clés, domaines vérifiés illimités,
1 audit simultané, durée de clé 1 an ; elles ne certifient pas la capacité de l'hôte.

Le support demande uniquement code, requestId, étape, version du client et référence
du run expurgée. Réponses et reprise : [erreurs](errors.md), [facturation](billing.md).
Une panne Argos reste un incident opérateur ; ne jamais demander de désactiver TLS,
SSRF, sandbox ou masquage des secrets. Limiter l'accès et la rétention des diagnostics.

## Ouverture progressive et retour arrière

1. **Aujourd'hui : NO_GO.** Garder les six drapeaux `premium-ci.enabled`,
   `billing.enabled`, `billing.payments-enabled`, `billing.prices-approved`,
   `billing.launch-approved`, `billing.tax-ready` à `false`. Aucun prix ni TVA inventé.
2. Décider prix EUR mensuel/annuel, réduction annuelle, fiscalité HT/TTC et politique
   de grâce/crédit/remboursement/litige/fermeture. La fermeture attend actuellement la
   fin effective de l'abonnement : accepter ou modifier ce comportement avant vente.
3. Ressources de test autorisées, recette réelle complète, métriques/alertes exercées,
   revue sécurité et critères P0 tous validés au SHA candidat : décision humaine dans
   #467 et revue du [contrôle de release général](../../scripts/check-release-evidence.mjs) si applicable.
4. Pilote autorisé séparément, faible volume et suivi des signaux ; élargissement
   uniquement après résultats observés et décision explicite. Aucune étape de ce lot
   ne modifie automatiquement une configuration ni ne provisionne Stripe.
5. Incident : retirer les **nouvelles** admissions CI et ventes (`premium-ci.enabled=false`,
   `billing.payments-enabled=false`), arrêter les publishers et conserver intentions,
   quotas et journal. Ne pas réadmettre/rejouer un POST ambigu. Le coupe-circuit CI
   global coupe aussi l'authentification machine : prévoir l'impact sur les lectures
   et reprendre les runs admis après diagnostic. Ne pas couper `billing.enabled`
   aveuglément une fois des clients facturés : préserver rapprochement, factures,
   portail et annulations ; voir [continuité Billing](billing.md).

Références : [clés](keys.md), [admission](admission.md), [quotas](quotas.md),
[exports privés](private-exports.md), [verdict](verdicts.md),
[synchronisation](issue-synchronization.md), [GitHub](github-publication.md),
[GitLab](gitlab-publication.md), [docs publiques](public-documentation.md).
