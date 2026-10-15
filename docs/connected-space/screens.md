# Écrans, routes et parcours cibles

Ces routes sont une proposition d’implémentation cohérente, pas un inventaire
des routes déjà disponibles. Le préfixe `/account` conserve la séparation du
site public ; aucune redirection depuis l’ancien dashboard n’est exigée.

| ID | Route cible | Blocs et actions obligatoires |
|---|---|---|
| UI-01 | Layout `/account/*` | Navigation Clarté, contexte du compte, thème/langue, quota résumé, footer, entrée administration conditionnelle |
| UI-02 | `/account` | Trois KPI actionnables : URL prioritaires, URL sans diagnostic complet, crédits disponibles ; lancement rapide ; sites à traiter ; analyses récentes |
| UI-03 | `/account/analyses/new` | URL avec label, profil réellement supporté, coût/quota, validation, lancement puis progression persistée |
| UI-04 | `/account/sites` et `/account/sites/[siteId]` | Sites personnels, recherche, URL suivies, dernière tentative et dernier rapport disponible distincts, historique et relance |
| UI-05 | `/account/runs/[runId]` | Progression puis rapport du même run ; score qualifié, catégories, problèmes/actions/preuves, contexte technique, comparaison admissible |
| UI-06 | `/account/domains` | Domaines déjà analysés ; dernière tentative, date, pages retenues, prioritaires, incomplètes ; ouvrir ; nouvelle analyse |
| UI-07 | `/account/domains/new` | Hôte/périmètre → découverte → sélection/coût → confirmation → suivi ; exclusions et limites visibles |
| UI-08 | `/account/domains/[domainId]/batches/[batchId]` | Synthèse et onglet pages ; problèmes communs ; pages les plus problématiques ; couverture et erreurs ; historique des lots |
| UI-09 | Même route avec `tab=pages&rule=…` | Liste filtrée des pages affectées, recherche/statut/tri, pagination, lien vers le run exact de chaque page |
| UI-10 | `/account/settings` | Profil, mot de passe/méthodes sociales, sessions, déconnexion, fermeture du compte avec réauthentification |
| UI-11 | `/account/usage` | Offre effective, consommés/réservés/disponibles, période et renouvellement, détail des consommations |
| UI-12 | `/account/admin/users` et `/[userId]` | Recherche/filtres/pagination ; compte, usage, plafond/offre ; suspension/reprise ; journal administratif |
| UI-13 | `/account/integrations` | API et CI « Bientôt », bénéfices/contextes, aucun bouton qui prétend activer un service indisponible |

## Parcours à préserver

1. **Analyser une URL** : saisie → admission serveur → URL stable du run →
   progression → résultat. Rafraîchir, quitter ou revenir n’interrompt pas le job.
2. **Analyser un domaine** : liste → nouvelle découverte → sélection → coût
   explicite → création atomique du lot → suivi → synthèse UI-08. Revenir par
   la liste ouvre exactement cette même ressource persistée.
3. **Comprendre un problème commun** : synthèse → règle → liste des pages
   affectées → rapport du run enfant → retour au lot et à son filtre.
4. **Traiter un échec** : ligne en échec → cause et modules disponibles →
   relancer avec coût confirmé. La relance crée un nouveau run/lot, ne réécrit
   jamais le lot précédent ni ses compteurs.
5. **Gérer un quota** : quota insuffisant → explication utilisé/réservé/reste
   → réduire la sélection ou consulter l’usage. Aucun faux parcours de paiement.
6. **Administrer** : recherche d’un utilisateur → détail → modification
   chiffrée avant/après → réauthentification si nécessaire → confirmation et
   motif contrôlé → résultat et événement de journal.

## États obligatoires par famille

| Famille | États à spécifier, implémenter et recetter |
|---|---|
| Toutes les pages | Chargement stable, erreur récupérable, session expirée, accès interdit/ressource absente, petit écran et clavier |
| Listes/KPI | Premier usage vide, aucun résultat filtré, pagination, données anciennes, rafraîchissement en erreur sans inventer de zéro |
| Analyse | En attente, en cours, terminée, partielle, échouée, annulation demandée/annulée, rapport expiré |
| Domaine | Découverte en cours, vide, tronquée, interrompue, bloquée, sélection invalide, quota changé avant confirmation, lot partiel |
| Rapport | Score absent, provisoire ou définitif ; preuve indisponible ; comparaison impossible avec motif ; aucune anomalie détectée sur périmètre mesuré |
| Compte | Fournisseur non configuré, liaison annulée/échouée, dernière méthode protégée, vérification requise, session révoquée, compte suspendu/archivé |
| Administration | Non-ADMIN, réauthentification expirée, conflit de version, baisse sous l’usage, cible ADMIN protégée, mutation refusée sans modification partielle |

Les liens de détail utilisent des IDs stables, jamais l’index d’une ligne.
Les filtres/onglets utiles sont sérialisés dans l’URL ; pagination remise à
zéro quand le filtre change. Le paramètre de retour accepte seulement une
route interne validée, pas une URL externe. Le bouton retour navigateur
conserve le contexte. Les modales gèrent focus initial, Escape, piégeage et
restitution du focus. Les soumissions préviennent le double clic mais
l’idempotence reste une responsabilité serveur.

Le footer est présent dans tous les états : aide/contact réellement reliés,
mentions légales, confidentialité, version si disponible, langue/thème selon
le shell. Il reste en bas du contenu ou de la fenêtre sur page courte, sans
masquer les tableaux ni les actions. Les textes de la maquette ne constituent
pas des documents juridiques à publier.
