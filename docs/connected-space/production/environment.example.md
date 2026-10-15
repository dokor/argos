# Fiche opérateur privée — Clarté

Conserver la fiche remplie hors Git, sans valeur de secret.

| Élément | Valeur / preuve |
|---|---|
| Origine | https://argos.lelouet.fr |
| Base cible / utilisateur | argos_db_prod / argos_user, à confirmer sur l’instance réelle |
| Responsable / fenêtre | À renseigner |
| MariaDB interne / version / droits | À relever |
| Révision et images candidates | SHA de la PR fusionnée et testée, à renseigner |
| Images actives avant bascule | À relever séparément |
| Inventaire tables / moteurs / volume / effets SQL | À relever ; 29 tables Argos InnoDB attendues avant V27 |
| Abandon des données | Total : comptes, rapports publics/privés, historique, quotas, newsletter, feedback, analytics |
| Sauvegarde de secours technique | Référence privée si retenue ; aucune reprise métier requise |
| FREE / PREMIUM | 10 / 1000 par mois UTC |
| SMTP et fournisseurs OAuth | Résultats de recette réelle à renseigner |
| Premier ADMIN | Nouveau compte vérifié puis ID exact ; aucune donnée de compte dans Git |
| Autorisation actuelle | Préparer PR, scripts, tests et documentation ; aucun déploiement |

- [ ] Base exacte et toutes les instances écrivantes inventoriées.
- [ ] Configuration candidate préparée ; secrets/droits/montages vérifiés.
- [ ] CI/MariaDB/E2E verts au SHA retenu ; workflows de déploiement désactivés.
- [ ] Ultérieur : maintenance, anciens écrivains arrêtés, V27 réussie, compteurs contrôlés.
- [ ] Ultérieur : nouveau compte vérifié, bootstrap ADMIN et reconnexion.
- [ ] Ultérieur : smoke tests publics/connectés, SMTP/OAuth, charge et accessibilité.
- [ ] Ultérieur : redémarrage sans nouvel effacement, ouverture et supervision.
