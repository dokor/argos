# Fiche opérateur privée — Clarté

Conserver la fiche remplie hors Git. Ne pas y coller de secrets.

| Élément | Valeur / preuve |
|---|---|
| Origine | https://argos.lelouet.fr |
| Base conservée | argos_db_prod |
| Utilisateur applicatif conservé | argos_user ; grants à vérifier, secret inchangé |
| Responsable / date | À renseigner |
| Hôte MariaDB interne / version | Conteneur mariadb-public ; version exacte à relever |
| Réseau et compte DB | mariadb-public, 172.24.0.0/16 ; MariaDB et API raccordés ; aucun nouveau compte créé |
| Sauvegarde avant maintenance | À relever ; automatique avant DELETE, restauration isolée à vérifier |
| Référence de restauration isolée | À renseigner avant mise en service |
| Révision applicative retenue | 17326498900e34f23a7ae1132cdc0050966d73f5 ; revalider si elle change |
| Images réellement actives / candidates | À relever séparément |
| FREE / PREMIUM | 10 / 1000 par mois UTC |
| SMTP et domaine expéditeur | À renseigner ; délivrabilité non vérifiée |
| OAuth réellement retenus | À décider ; ne pas activer des boutons sans configuration valide |
| Premier ADMIN | Email puis ID exact après vérification ; fiche privée uniquement |
| Décision concernant anciens rapports et données publiques | Conserver les rapports, relations et credentials ; pas de bascule vers une base vide |
| Accès cible / configuration | Exécutés par l'opérateur ; aucun accès serveur donné à Codex |
| Autorisation actuelle | Préparation et maintenance ciblée des données périmées ; exécution opérateur après simulation |

## Avancement à dater avec preuve

- [ ] Inventaire de la base existante et historique Flyway confirmés.
- [ ] Fichiers candidats remplis, accès restreint, secrets stockés dans le coffre.
- [ ] Simulation de maintenance relue ; sauvegarde et nettoyage ciblé opérateur consignés.
- [ ] Copie candidate des Compose relue ; fichiers actifs inchangés.
- [ ] **Ultérieur :** décision de mise en service, migrations, SMTP/OAuth réels.
- [ ] **Ultérieur :** compte vérifié, simulation et promotion ADMIN, reconnexion.
- [ ] **Ultérieur :** recette cible, restauration, charge et accessibilité manuelle.
- [ ] **Ultérieur :** pages publiques FR/EN anonymes, 200 et indexables ; sitemap/robots/canonicals conservés.
