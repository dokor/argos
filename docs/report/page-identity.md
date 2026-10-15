# Identité de la page dans le rapport (#581)

`url` et `pageIdentity.requested` portent désormais une adresse d’affichage qui conserve le chemin. `pageIdentity.destination` vient exclusivement du `finalUrl` du collecteur HTTP, lorsqu’il existe. `redirected` compare les identités techniques avant assainissement ; deux adresses affichées identiques peuvent donc masquer une redirection portant sur des paramètres. Les paramètres, fragments et informations utilisateur ne sont jamais publiés. Les segments de jeton connus, opaques longs et caractères de contrôle sont masqués. Les logs et les preuves générales conservent leur politique origine seule.

Le composant partagé `ReportPageScope` présente cette information en FR/EN dans le hero, la méthode et les deux exports. Une adresse masquée ne sert pas à une relance automatique : le bouton est désactivé avec une explication. Le contexte privé existant permet de retrouver la page d’origine. Les rapports historiques récupèrent l’adresse demandée depuis `target_url`, avec le même assainissement ; leur destination non conservée reste explicitement inconnue. Aucune migration et aucune nouvelle mesure ne sont effectuées à la lecture.

## Vérifications du 15 octobre 2026

- Suite Java complète, puis tests ciblés de sérialisation/confidentialité et de lecture historique.
- Tests frontend ciblés (32), contrôle éditorial FR/EN, lint des composants modifiés et build de production.
- Revue dans le navigateur sur données fictives : rapport privé partiel FR sombre et EN clair à 390 px, ouverture de la méthode et vérification de la relance désactivée ; absence de débordement horizontal. Exemple public EN clair à 1440 px, exemple public FR et rapport privé complet FR clair à 768 px. Les adresses demandée et redirigée restent distinctes et lisibles.
- Les tests d’export couvrent FR/EN, homepage et deux chemins, résumé et export complet ; les tests Java couvrent redirection, paramètres sensibles et chemin long.

Cette recette locale ne constitue pas une nouvelle analyse de production et ne valide pas un PDF issu du navigateur de production.
