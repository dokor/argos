# Espace connecté Clarté — dossier d’intégration

Version 1.0 · 13 octobre 2026 · **Spécification cible, pas fonctionnalité livrée**.

Suivi : [epic #550](https://github.com/dokor/argos/issues/550) — dix nouveaux
lots et quatre tickets existants reliés dans le [plan](delivery-plan.md).

La version retenue est « Clarté — synthèse des domaines ». L’objectif est de
livrer sa composition et ses parcours avec de vraies données, des règles
uniques et des preuves de recette. Le persona est une personne technique
qui gère un ou plusieurs sites. La gestion de clients/équipes reste hors lot.

## Décision de refonte

L’utilisateur autorise un nouveau départ pour l’espace connecté : aucune
double interface, conservation de ses anciennes routes ou compatibilité de
son ancien schéma n’est exigée. Réutiliser les composants métier éprouvés
reste souhaitable. Le moteur d’audit, ses protections et le site public ne
sont pas à réécrire par défaut.

Ce dossier ne déclenche ni suppression de données, ni migration, ni déploiement.
La préparation d’une base neuve et le périmètre des données abandonnées sont
décrits dans [architecture.md](architecture.md). Concevoir une rupture de
compatibilité n’est pas une commande de remise à zéro de la production.

## Parcours de lecture

| Document | Utilisation |
|---|---|
| [Décisions et écarts](decisions.md) | Arbitrages entre maquette, ancien produit et cible |
| [Inventaire de l’existant](existing-system.md) | Réutiliser, remplacer ou construire |
| [Écrans et parcours](screens.md) | Routes, états, actions et droits |
| [Référence visuelle](visual-spec.md) | Tokens, géométrie, responsive et captures |
| [Règles fonctionnelles](functional-spec.md) | KPI, regroupements, tri, quotas et états |
| [Architecture et modèle](architecture.md) | Données, exécution, sécurité et reprise |
| [Contrats API](api-contract.md) | Requêtes, réponses, erreurs et idempotence |
| [Fondations F01](foundation-f01.md) | Contrat exécutable, schéma livré, inventaire et validation sur base neuve |
| [Cadre et composants F02](shell-f02.md) | Navigation, états, aperçu canonique, preuves et écarts visuels |
| [Consommation et quotas F05](usage-f05.md) | Disponible serveur, journal privé et primitives transactionnelles |
| [Découverte de domaine F06](discovery-f06.md) | Crawler privé borné, transport, snapshots, annulation et reprise |
| [Administration F11](administration-f11.md) | Comptes, offres, quotas, suspension et journal administratif |
| [Vue d’ensemble F10](overview-f10.md) | KPI, inventaire des dernières tentatives et preuve de cohérence |
| [Interface domaine F09](interface-f09.md) | Parcours raccordé, filtres, confirmation des crédits et preuves navigateur |
| [Synthèses serveur F08](summary-f08.md) | Agrégats privés, preuves évaluées, pages prioritaires et historique |
| [Analyses par lots F07](batch-f07.md) | Admission atomique, progression, reprise et annulation privées |
| [Compte personnel F04](account-f04.md) | Profil, sécurité, connexions, contrats conservés et preuves |
| [Recette et livraison](acceptance.md) | Matrice de tests et conditions de clôture |
| [Plan de réalisation](delivery-plan.md) | Issues, dépendances et séquence des PR |
| [Jeu de données canonique](fixtures/connected-space.json) | Valeurs attendues pour les calculs et les écrans |
| [Référence interactive](reference/README.md) | Maquette figée, aperçu autonome et captures |

## Ordre d’autorité

1. Décisions utilisateur consignées dans `decisions.md`.
2. Contrats fonctionnels et techniques de ce dossier.
3. Maquette retenue et captures, pour la composition et les parcours.
4. Anciennes documentations, pour les mécanismes conservés explicitement.

La maquette contient des valeurs fictives, des dates fixes, un profil de
mesure illustratif et des simulations. Ne pas copier son JavaScript dans
Next.js. Ne pas transformer un chiffre de démonstration en règle commerciale
ou une preuve inventée en résultat réel. Les écarts connus sont consignés.

## Définition de terminé

Chaque lot est livré par une PR dédiée avec les preuves adaptées et les
identifiants d’exigences concernés. La clôture fonctionnelle attend son
intégration et sa recette. Cette PR de dossier ne clôture aucune fonctionnalité.
Fusion et déploiement restent distincts et nécessitent une demande utilisateur.

Vérifier ce dossier : `python docs/connected-space/validate.py`.
Reconstruire l’aperçu : `python docs/connected-space/reference/build-preview.py`.
Les deux commandes n’ont besoin que de Python standard. Les captures navigateur
nécessitent le Playwright existant du projet ; voir le guide de référence.
