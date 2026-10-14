# Décisions et écarts de référence

Les décisions `D-*` ci-dessous constituent la cible de réalisation. Les valeurs
marquées « proposition technique » sont des valeurs de départ testables, pas
un engagement commercial. Les changer exige une mise à jour de ce dossier et
des critères des issues concernées, pas un nouvel arbitrage à chaque composant.

| ID | Décision | Origine / conséquence |
|---|---|---|
| D-01 | Direction Clarté, blocs à rayon 9 px, footer connecté présent | Choix utilisateur ; conserver la composition validée |
| D-02 | Persona technique, un ou plusieurs sites personnels | Choix utilisateur ; pas de clients, équipes, affectations ou facturation client |
| D-03 | Domaine entier livré dans la refonte | Choix utilisateur ; retirer « Bientôt » sur ce module |
| D-04 | Compte personnel ET administration des comptes/quotas | Confirmation utilisateur ; permissions serveur distinctes |
| D-05 | Mes domaines est l’entrée du module ; nouvelle analyse → même synthèse persistée | Choix utilisateur ; pas de rapport temporaire réservé au tunnel |
| D-06 | Nouveau départ connecté sans compatibilité de l’ancien espace | Choix utilisateur ; ni double écriture, ni feature flag de bascule, ni anciennes routes à maintenir |
| D-07 | Protéger le moteur d’audit, le site public et les protections SSRF/auth | Frontière de la refonte ; les modifications communes ont leur propre recette |
| D-08 | L’API et la CI restent « Bientôt » | Décision conservée ; ne pas livrer de clés ni de fausse activation |
| D-09 | Une identité de compte, un registre de sessions ; réutiliser les primitives existantes | Décision technique ; ne pas reconstruire une cryptographie ni une seconde authentification |
| D-10 | Crédits = runs publiés ; réservation avant lancement ; restitution si aucun rapport | Réutilise le registre existant ; une reprise worker n’est pas un nouveau crédit |
| D-11 | Refuser une nouvelle baisse de plafond sous consommés + réservés | Choix de cohérence avec la maquette, changement explicite du contrat admin antérieur ; HTTP 409 |
| D-12 | Motif administratif sous forme de code contrôlé ; journal avant/après append-only | Remplace le champ libre illustratif de la maquette ; évite les données personnelles/secrets dans le journal |
| D-13 | Suspension des utilisateurs standards ; interdite pour soi et les autres ADMIN | Nouveau comportement ; réauthentification, confirmation et révocation des sessions |
| D-14 | Aucune modification du scoring pour reproduire un score de maquette | Le scoring et la couverture courants restent l’autorité |
| D-15 | Nouveau lot tout-ou-rien à l’admission, résultats individuels ensuite | Transactions/idempotence ; aucun lot caché en cas de quota insuffisant |
| D-16 | Hôte exact et ports web standards pour la découverte ; aucun sous-domaine implicite | Proposition technique V1 ; mêmes validations à chaque redirection |
| D-17 | Découverte bornée, sans coût en crédits mais limitée en ressources | Proposition : 50 URL, profondeur 3, 60 s, 2 requêtes/hôte, 1 découverte active/compte |
| D-18 | 50 pages maximum par lot ; 1 lot actif/compte | Proposition technique configurable côté serveur ; préserver les limites globales headless |
| D-19 | Compteurs et regroupements calculés serveur sur le périmètre complet | Pas de calcul sur la seule page de pagination, pas de moyenne de scores de domaine |
| D-20 | Domaine logique privé par propriétaire+hôte ; lots et rapports immuables | Une nouvelle analyse conserve les précédentes ; la liste désigne la dernière tentative |

## Écarts à ne pas recopier

| Maquette | Cible de production |
|---|---|
| 100 crédits, 50 pages, dates fixes | Plafond mensuel et date issus de l’API ; 100 n’est qu’une fixture ; limite technique configurable |
| Score V7, Chromium 130, Lighthouse 12.8, profil mobile-v1 | Versions et profil réellement exécutés, persistés ; aucune promesse de profil non mesuré |
| « Partiel » implique toujours aucun score | Séparer exécution, complétude et score disponible/provisoire selon le moteur courant ; un partiel peut avoir un score qualifié |
| Catégorie « Fiabilité » d’un constat fictif | Garder les quatre domaines canoniques performance/sécurité/SEO/accessibilité ; la provenance Runtime reste une provenance |
| Preuves HTML/HTTP et sélecteurs inventés | Seulement des preuves collectées et bornées ; « preuve non disponible » si absente, dépendance #538 |
| Les KPI dashboard portent sur 6 URL, les domaines sur 15 autres exemples | Un jeu canonique commun ; ici 15 URL, 9 prioritaires, 3 incomplètes ; les chiffres changent, la composition reste |
| Résultats d’un domaine parfois remplacés en mémoire | Lots persistés, liens stables, historique conservé, nouvelle tentative distincte |
| Relancer depuis un domaine peut renvoyer vers un rapport d’exemple ancien | Ouvrir exactement le run enfant du lot sélectionné ; garder le contexte de retour |
| Simulation par timers et données en mémoire | Jobs durables, reprise worker et polling ; quitter la page ne stoppe pas l’analyse |
| Administration visible dans tout le prototype | Rubrique rendue seulement pour ADMIN ; autorisation revérifiée au BFF et en Java |
| Mot de passe minimum 12 caractères | Conserver la politique d’authentification existante (15–128 points de code au point d’inventaire) |
| Connexions sociales toujours cliquables | Fournisseurs réellement configurés ; retour erreur/annulation ; dernière méthode utilisable protégée |
| Conservation implicite des anciens écrans | Suppression du code connecté remplacé, sans conserver de console fantôme |
| Tri des pages avec départage systématique par score | Critiques puis importants puis URL stable ; aucun départage par scores non comparables |

## Limite de l’autorisation

La création initiale du dossier était documentaire et organisationnelle. Les
lots d’implémentation et la recette F13 ne constituent pas une autorisation de
nouveau tarif, paiement, changement de rôle de production, suppression de table
ou mise en ligne. Aucun besoin de compatibilité ancienne ne doit
être réintroduit comme prérequis caché. L’issue de préparation de mise en
service doit seulement identifier précisément l’environnement et les données
à initialiser avant toute opération ultérieure autorisée.
