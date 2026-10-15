# Refonte Clarté de l’espace connecté

Livrer l’espace connecté au plus près de la maquette Clarté validée : dashboard
technique, analyse URL, domaines persistés et synthèses, compte personnel,
quotas et administration. Le module domaine est dans le périmètre livré ;
API/CI restent Bientôt. Gestion multi-clients/équipes/paiement hors périmètre.

Décision utilisateur : repartir sur des bases propres, sans compatibilité de
l’ancien espace connecté, double écriture ou double interface. Réutiliser le
moteur d’audit, les primitives de compte et les protections existantes.

[Dossier versionné et référence visuelle](https://github.com/dokor/argos/tree/codex/clarte-integration-spec/docs/connected-space).
Contrats, décisions, écrans, fixture commune, critères de recette et fiches de
lots se trouvent dans ce dossier. Les données de maquette sont fictives.

## Conditions de réussite

- [ ] Parcours domaine liste → tunnel → synthèse persistée → problème → pages → rapport exact.
- [ ] Dashboard cohérent avec listes/runs, couverture honnête, preuves réellement collectées.
- [ ] Compte et quotas atomiques, autorisations et administration testées côté serveur.
- [ ] Clarté fidèle, footer, responsive 320–1440, clair/sombre et FR/EN, clavier utilisable.
- [ ] Recette intégrée et initialisation propre documentées ; ancien espace retiré.

Chaque lot est livré en PR avec critères/preuves ; cette préparation documentaire
ne vaut pas livraison fonctionnelle. Fusion, déploiement ou remise à zéro de
production nécessitent des actions distinctes. Pas de fermeture automatique
de cette epic par la PR du dossier.

## Lots

Le registre `docs/connected-space/issues.json` fixe les dépendances détaillées.

<!-- github-work-items -->
- [ ] #551 — F01 — Fixer les contrats typés et le modèle connecté propre
- [ ] #552 — F02 — Construire le shell et les composants Clarté
- [ ] #553 — F03 — Intégrer analyse URL et diagnostic technique privé
- [ ] #554 — F04 — Intégrer compte personnel, sécurité et connexions
- [ ] #555 — F05 — Unifier quotas personnels et réservations atomiques
- [ ] #10 — F06 — Découverte bornée de domaine pour Clarté
- [ ] #12 — F07 — Orchestrer les lots de pages avec reprise durable
- [ ] #556 — F08 — Produire les synthèses serveur des domaines
- [ ] #557 — F09 — Intégrer domaines, tunnel et détail de chaque page
- [ ] #558 — F10 — Brancher dashboard et inventaire sur des KPI cohérents
- [ ] #559 — F11 — Refaire administration des comptes et quotas
- [ ] #516 — F12 — Retirer l’ancien espace connecté sans coexistence
- [ ] #560 — F13 — Recetter Clarté de bout en bout et préparer la mise en service
- [ ] #538 — F14 — Collecter les preuves réelles nécessaires au diagnostic Clarté
