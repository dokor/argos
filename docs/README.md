# Documentation Argos

Ce dossier conserve les contrats, décisions et procédures utiles pour modifier ou
exploiter Argos. Le [README du dépôt](../README.md) sert au démarrage ; le
[runbook](../infra/RUNBOOK.md) décrit l'exploitation. Le code, les migrations et les
workflows restent les références pour les valeurs configurées.

## Trouver une référence

| Besoin | Documents |
| --- | --- |
| Comprendre le moteur | [Progression et concurrence](analysis/progress.md), [budget de traitement](analysis/deadline.md), [helpers](analysis/helpers.md) |
| Exploiter les collecteurs | [ZAP / SSL Labs](analysis/zap-ssl-operations.md), [agrégation SSL](analysis/ssl-endpoints.md) |
| Expliquer le score | [Composition par domaine](scoring/domain-calibration.md), [seuils runtime](scoring/runtime-thresholds.md), [couverture](scoring/measurement-coverage.md), [priorités](scoring/priorities.md), [comparaison](scoring/audit-comparison.md), [méthode publique](scoring/public-methodology.md) |
| Faire évoluer le rapport | [Modèle de lecture](report/read-model.md), [contenu et navigation](report/content-navigation.md), [PDF](report/pdf.md), [démonstration](report/demo.md), [rétention](report/retention.md) |
| Comptes et administration | [Authentification](accounts/contract.md), [configuration](accounts/operations.md), [exemple HOCON](accounts/application.example.conf), [sites](accounts/sites-contract.md), [historique](accounts/history.md), [consommation](accounts/usage-contract.md), [administration](accounts/administration-contract.md) |
| Retours utilisateurs | [Contrat du support privé](feedback/contract.md), [protocole agences](product/agency-feedback-protocol.md) |
| Sécurité | [Accès aux audits](security/audit-access.md), [credentials des rapports](security/report-credentials.md), [publication atomique](security/audit-publication.md), [limites publiques](security/public-write-limits.md), [secrets et historique](security/secret-remediation.md), [chaîne d’audit](security/audit-chain-488.md), [recette Raspberry](security/raspberry-audit-validation.md) |
| Accessibilité | [Contrat technique](accessibility/contract.md), [matrice proposée](accessibility/rules-v1.md), [registre de revue](accessibility/review-v1.json), [acceptation et validations restantes](accessibility/acceptance.md) |
| Produit et confidentialité | [Contenus et promesses](product/public-content.md), [analytics](product/product-analytics.md), [inventaire de confidentialité](product/privacy-inventory.md), [provenance éditoriale](product/editorial-provenance.md) |
| SEO et langues | [Intentions des pages](seo/public-page-intents.md), [pages d'acquisition](seo/acquisition-page-contract.md), [guides anglais](seo/english-public-guides.md), [liens de correction](seo/correction-guide-links.md), [suivi checklist](seo/checklist-audit-site-web.md), [non-indexation des rapports](seo/report-indexing-decision.md) |
| Interface | [Conventions publiques](ux/public-design.md), [espacements](ux/spacing.md), [méthode de design et sources des skills](ux/design-skills.md), [évaluation des skills](testing/design-skills.md) |
| Performance du service | [Pools HTTP/DB](performance/resource-pools.md), [projections de listes](performance/listing-projections.md) |
| Vérifier une modification | [CI et diagnostic](testing/ci.md), [MariaDB](testing/mariadb.md), [E2E contrôlé](testing/controlled-e2e.md), [comptes et retours](testing/accounts.md), [rapport web/PDF](testing/report.md), [header public](testing/public-header.md) |
| Nettoyer le code et les dépendances | [Inventaire, éléments conservés et suivis](maintenance.md) |
| Préparer une release | [Révision des images](release/runtime-provenance.md), [dossier V1 daté](release/v1-readiness-2026-10-05.md), [preuves du snapshot V1](release/v1-evidence-2026-10-05.json) |

## Historique et décisions en attente

Les [constats backend de juillet](archive/backend-audit-2026-07.md) et le
[relevé de dépendances du 5 octobre](archive/dependency-remediation-2026-10-05.md)
sont conservés pour la provenance du dossier V1. Ils ne décrivent pas l'état
actuel du code ou des vulnérabilités. Le dossier V1 reste lui aussi un snapshot :
une clôture de ticket ne transforme pas ses validations différées en preuves.
Les règles d'accessibilité proposées et les prérequis d'exploitation conservent
leurs limites dans les documents concernés.

Les comptes rendus ponctuels, anciennes captures et matrices de rendu supprimés
restent consultables dans [la version avant nettoyage](https://github.com/dokor/argos/tree/cfeebe0/docs)
et dans les PR d'origine. Pour retrouver un fichier supprimé ou déplacé :

```sh
git log --all -- docs/ancien-chemin.md
git show cfeebe0:docs/ancien-chemin.md
```

## Entretenir ce dossier

- Mettre à jour la référence existante avec le changement de comportement ; créer
  un document seulement pour un sujet distinct et l'ajouter au tableau ci-dessus.
- Nommer les documents par sujet. Réserver dates et versions aux décisions ou
  contrats réellement figés, sans créer un compte rendu par issue ou PR.
- Conserver ici le contrat, ses limites et la commande de reproduction. Les
  résultats d'une exécution, captures, PDF et logs vont dans `outputs/` ignoré
  ou dans les artefacts CI associés au SHA ; la PR porte le bilan de validation.
- Garder un snapshot versionné uniquement s'il porte une décision ou une preuve
  encore nécessaire, avec date, périmètre et statut explicites. Le registre
  d'accessibilité et le JSON V1 sont des entrées de tests, pas des sorties à effacer.
- Vérifier les liens entrants lors d'un déplacement, y compris ceux des scripts,
  tests et du runbook. Ne pas recopier les titres SEO, versions de dépendances ou
  nombres de tests quand le code ou la CI fournit déjà la source.
