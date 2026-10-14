# Fiche opérateur privée — Clarté

Conserver la fiche remplie hors Git. Ne pas y coller de secrets.

| Élément | Valeur / preuve |
|---|---|
| Origine | https://argos.lelouet.fr |
| Base candidate | argosclarteprod |
| Utilisateur applicatif | argosclarte ; hôte autorisé à confirmer |
| Responsable / date | À renseigner |
| Hôte MariaDB interne / version | Conteneur mariadb-public ; version exacte à relever |
| Réseau et compte DB | mariadb-public, 172.24.0.0/16 ; compte limité à 172.24.0.0/255.255.0.0 |
| Ancienne base et sauvegarde | À relever ; conservée, aucun reset |
| Référence de restauration isolée | À renseigner avant mise en service |
| Révision applicative retenue | 17326498900e34f23a7ae1132cdc0050966d73f5 ; revalider si elle change |
| Images réellement actives / candidates | À relever séparément |
| FREE / PREMIUM | 10 / 1000 par mois UTC |
| SMTP et domaine expéditeur | À renseigner ; délivrabilité non vérifiée |
| OAuth réellement retenus | À décider ; ne pas activer des boutons sans configuration valide |
| Premier ADMIN | Email puis ID exact après vérification ; fiche privée uniquement |
| Décision concernant anciens rapports et données publiques | À décider avant bascule ; base conservée ne signifie pas liens accessibles sur la nouvelle |
| Accès cible / configuration | Exécutés par l'opérateur ; aucun accès serveur donné à Codex |
| Autorisation actuelle | Préparation seulement ; aucun déploiement ni suppression |

## Avancement à dater avec preuve

- [ ] Inventaire de la cible et absence de collision de nom confirmés.
- [ ] Fichiers candidats remplis, accès restreint, secrets stockés dans le coffre.
- [ ] Base vide et utilisateur dédié provisionnés par l'opérateur, droits vérifiés.
- [ ] Copie candidate des Compose relue ; fichiers actifs inchangés.
- [ ] **Ultérieur :** décision de mise en service, migrations, SMTP/OAuth réels.
- [ ] **Ultérieur :** compte vérifié, simulation et promotion ADMIN, reconnexion.
- [ ] **Ultérieur :** recette cible, restauration, charge et accessibilité manuelle.
- [ ] **Ultérieur :** pages publiques FR/EN anonymes, 200 et indexables ; sitemap/robots/canonicals conservés.
