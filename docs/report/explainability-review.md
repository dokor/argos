# Rapports explicables — #671, #673, #676

## Livraison et périmètre

Cette PR unique répond à la demande de regrouper les trois tickets. Elle livre les changements de code, l’inventaire et des scénarios reproductibles. Elle ne prétend pas avoir effectué la recette humaine exigée par #673 ni identifié la distribution des causes dans les runs de production de #671 : aucun échantillon réel n’a été fourni dans ces issues. Ces deux validations restent ouvertes, avec le protocole ci-dessous.

## Couverture : faits établis

Complément du 18 octobre 2026 : la [note d’investigation #671](coverage-investigation-671.md) documente le premier run réel autorisé, à **77 %**, sa décomposition exacte et les preuves encore nécessaires pour expliquer la récurrence des 96 %. L’outil accepte aussi le résultat interne et compare les causes par méthode conservée ; la synthèse publique rend désormais le détail accessible sans connexion. Les conclusions historiques ci-dessous restent datées de la livraison initiale.

Le calcul weighted-coverage-v3 utilise measuredWeight / expectedWeight et exclut uniquement NOT_APPLICABLE. Le seuil suffisant est 80 %, sans plafond à 96 %. Les mesures restent figées dans chaque rapport ; le frontend et l’outil d’investigation utilisent leur dénominateur enregistré, sans nouvelle policy.

Un défaut de collecte reproductible concernait http.headers.compression et http.headers.server : la réponse avait été examinée, mais une absence d’en-tête produisait INFO + valeur null. MeasurementAvailability la classait MEASUREMENT_MISSING. La collecte conserve maintenant une valeur explicite (identity ou chaîne vide) et present=false. Une réponse absente, un challenge anti-bot et une mesure runtime inconnue ne deviennent pas des mesures réussies. Le barème V13, ses poids, son empreinte et le calcul de score sont inchangés. Le contrat des collecteurs passe à analysis-measurements-v4 pour éviter des comparaisons silencieuses entre méthodes différentes. Les anciens rapports ne sont pas réécrits.

Cette correction représente jusqu’à 4 unités de poids sur ces deux contrôles ; ce ne sont pas nécessairement 4 points de pourcentage. Elle n’explique pas à elle seule la récurrence signalée à 96 %.

La fixture fictive coverage-96.json utilise les 56 contrôles de poids positif du catalogue V13, avec seulement Observatory absent. Elle n’est ni un run réel ni la preuve d’un incident Observatory :

| Élément | Mesuré | Attendu | Manque global |
| --- | ---: | ---: | ---: |
| Ensemble des contrôles | 215 | 223 | 8 / 223 = 3,587443946 points |
| observatory.score / MODULE_MISSING | 0 | 8 | 3,59 points à l’affichage |
| Ratio enregistré | 96,412556054 % | 100 % | 96 % / 4 % après arrondi |

La fixture ne simule pas une réponse de collecteur complète ; elle teste l’agrégation du catalogue et le rendu. Les scénarios anti-bot, exclusion, transport, provenance multi-source et mesure SSL partielle sont couverts séparément par les tests Java existants et les tests de présentation. Le détail signale aussi les totaux historiques qui ne se réconcilient pas avec leurs lignes ; aucune ligne manquante n’est fabriquée.

Pour examiner des rapports DTO figés autorisés :

    node scripts/explain-coverage.mjs rapport-a.json rapport-b.json

La sortie attribue des numéros d’échantillons et omet URL, domaine, token et identifiants de run. Elle conserve état, raison bornée, domaine, poids, propriétaire, source réelle et contribution non arrondie. Vérifier les données d’entrée avant tout partage. Pour un run réel à 96 %, relever séparément dans un espace privé : ID/date, profil, versions et statut technique des modules ; comparer JSON/API/UI/export complet, puis regrouper les contrôles manquants sur plusieurs cibles. Les labels suffisante et complète gardent des sens distincts.

## Référentiel éditorial et preuves

- rule-inventory.json / .md recensent les 75 clés statiques du catalogue et des analyseurs, y compris les contrôles informatifs et les stubs. Les sources et lignes, poids, faits disponibles, contrat courant, méthode décrite et besoins de collecte sont vérifiables.
- Les identifiants Lighthouse détaillés et ZAP sont des ensembles ouverts. Les 86 clés détaillées des playbooks FR/EN couvrent les contrôles statiques publics prioritaires et les diagnostics courants. Toute autre clé reçoit un repli explicite : seuil/version/élément à demander, reproduction avant correction, aucune cause fabriquée.
- findingCatalogue conserve titres et impacts ; findingPlaybooks est la source des méthodes, étapes, vérifications, exemples et limites. Les groupes de contenu sont partagés pour éviter des copies divergentes. FindingGuide est utilisé dans le constat web et dans le PDF complet ; les vues et actions utilisent le même findingContent.
- Une seule idée par étape ; aucune plateforme supposée. Les exemples sont marqués fictifs, échappés et distincts des observations collectées. Les ratios Lighthouse restent des ratios : seuls numericValue et une unité reconnue peuvent donner une durée.
- La clé imgAltMissingCount réellement émise est désormais reconnue, ainsi que l’ancienne variante missingAltCount. La présence d’un alt ne prouve jamais sa pertinence ou le caractère informatif de l’image.
- Les liens de référence sont des documentations primaires consultées le 16 octobre 2026. La date porte sur la référence éditoriale et ne valide pas la méthode d’un ancien run. La version exacte d’une règle reste annoncée comme inconnue lorsqu’elle n’a pas été conservée.
- Les besoins résiduels sont explicites : versions exactes des règles, initiateur runtime, localisation des contrôles HTML quand elle n’est pas collectée, détails de certains sous-tests agrégés et provenance incomplète des rapports historiques. Ne pas réintroduire HTML brut, cookies, paramètres ou tokens pour combler ces lacunes.

Maintenance : à chaque changement de collecteur, revoir les étapes et seuils associés, mettre à jour le contrat des mesures si nécessaire, régénérer avec node scripts/report-rule-inventory.mjs et exécuter la vérification --check. Les tests comparent chaque clé statique à sa fiche ou son repli bilingue. La fréquence réelle des constats reste à mesurer sur des échantillons autorisés ; la priorité de cette passe suit gravité et impact potentiel, sans prétendre disposer de statistiques de production.

## Conseils généraux

Le catalogue local webTips contient 50 entrées FR/EN : SEO, performance, accessibilité, sécurité et UX, identifiants stables, source primaire, date de vérification, activation et expiration optionnelle. Aucun pourcentage spectaculaire ou statistique non sourcée. L’ajout ou la désactivation se fait dans le catalogue, sans changer les pages.

Placement : fin du rapport indépendant, après méthode et actions ; pied de l’espace connecté. Un rapport embarqué réutilise seulement le pied de l’espace connecté. Cela garde le conseil général hors du parcours de correction. Pas de sticky, de carrousel ou de fermeture à mémoriser pour ce petit encart.

La sélection s’initialise après montage dans un emplacement réservé, commun au SSR et au premier rendu client. Elle reste stable pendant la consultation, même en changeant de langue. sessionStorage conserve uniquement l’identifiant du dernier conseil pour éviter une répétition immédiate quand cela est possible. Aucun suivi de navigation, donnée personnelle ou appel réseau. Le stockage indisponible ne bloque pas l’affichage. Pas de contenu actif traduit : pas d’encart éditorial.

## Panel de recette et validations restantes

| Scénario | Données contrôlées | Vérification |
| --- | --- | --- |
| 96 % arrondis, Observatory absent | fixture de catalogue, sans URL | Somme des contributions = 100 - ratio non arrondi ; web/admin/PDF partagent CoverageDetails |
| Site avec chemins spécifiques | preview atelier.example/collection/sac-en-coton | Le périmètre reste visible ; aucun chemin n’est inventé dans une preuve |
| Images sans alt, CSP, LCP | fiches FR/EN et preuves présentes/absentes | Pourquoi, méthode, correction, exemple fictif et résultat attendu distincts |
| Historiques, clé inconnue, preuve absente | historical-report.json | Pas de nouvelle mesure, de version ou de score attribué |
| Service indisponible, anti-bot, exclusion, provenance, SSL partiel | tests Java + DOM | État et cause expliqués ; aucune réussite fabriquée |
| Export complet | mêmes composants que le web | Textes de fiche identiques, liens de documentation et preuves échappés |

Recette humaine encore à réaliser : un propriétaire de site non technique et un développeur/prestataire doivent lire au moins quatre fiches de domaines différents. Pour chaque fiche, demander de reformuler le problème, la preuve, l’action et le résultat attendu. Consigner profil/date, incompréhensions, corrections et nouvelle lecture. Aucun test DOM ni une relecture par l’agent ne vaut cette validation. Ne pas fermer #673 sur la seule base des tests automatiques.

L’étude de plusieurs runs réels à 96 %, la mesure de récurrence et leur comparaison aux runs à 100 % restent à réaliser avant de conclure sur la cause de production de #671. Le nouvel outil et l’affichage rendent cette étude reproductible ; aucune panne d’intégration particulière n’est présumée.

## Vérifications effectuées le 16 octobre 2026

- Backend : 902 tests Maven, 0 échec/erreur, 1 test d’intégration ignoré (901 réussis).
- Frontend : suite complète 103 fichiers / 942 tests réussis, puis tests ciblés après les ajustements de provenance et confidentialité (28 puis 19 réussis, dont le nouveau contrôle des sources absentes).
- Build de production local réussi avec webpack ; lint sans erreur, avec un avertissement préexistant dans ReportPriorityList. Aucun avertissement dans les fichiers modifiés lors du contrôle ciblé.
- Revue sur fixtures fictives du build de production : couverture, fiche image sans alt et conseils en FR/EN ; thèmes clair et sombre ; largeurs 320, 390, 768 et 1440 px selon les parcours. Aucun débordement horizontal constaté. Un seul h1 sur le rapport inspecté.
- Accordéons et lien de conseil parcourus au clavier, focus visible ; conseil stable pendant les interactions et renouvelé au rechargement ; aucune erreur d’hydratation dans la nouvelle session de production locale.
- Pied connecté inspecté à 390 px avec profil fictif. Détail administrateur ouvert avec Entrée ; le jeu de données historique incomplet affiche l’avertissement de réconciliation attendu.
- Captures conservées localement dans outputs/ui-review/ (rapport, fiche, conseil et pied connecté). Les captures de cette revue ne contiennent que des données fictives. Les artefacts de la CI visuelle complètent cette revue.
- La première CI fonctionnelle, sécurité, dépendances, E2E d’audit/authentification et intégration MariaDB est passée. La matrice visuelle a révélé un sélecteur de test aside devenu ambigu après l’ajout de l’encart ; le sélecteur cible maintenant explicitement la barre latérale. Vérifier le statut de la révision finale dans la PR.

La cohérence du contenu web/PDF est couverte par les tests de composants partagés ; cette revue ne revendique pas une vérification visuelle exhaustive de la pagination PDF. La recette humaine et l’étude des runs réels décrites plus haut restent nécessaires.
