# Lecture des rapports transmis à un prospect

## Contrats conservés

Le catalogue affiché est `report-content-v3`. Les tableaux FR/EN sont copiés pour chaque clé avant de personnaliser un titre. Le contenu affiché est indépendant des mesures stockées : aucun score, poids, niveau de gravité, rang ni version de classement n’est recalculé.

Le titre nomme le sujet, l’observation reprend les mesures structurées conservées (y compris longueur du titre, état d’une métadonnée, nombre de h1 et images sans alt), l’impact décrit un effet possible, l’action explique la correction à examiner et la vérification indique le contrôle à rejouer. Une clé inconnue reste identifiable dans les métadonnées techniques, sans recycler son titre anglais comme impact français. Le web et le PDF utilisent le même catalogue.

La gravité du rapport vient du statut et de la sévérité du contrôle source dans `PublicReportComposer.toIssueSeverity()`. Les seuils Lighthouse peuvent produire `FAIL/HIGH`, donc un constat critique, pour un diagnostic de performance comme pour un agrégat. Cela ne confirme pas une urgence métier. La confiance qualifie la mesure, et ne constitue pas une preuve d’impact sur le parcours. Le rendu conserve ces niveaux et distingue les observations documentées, les signaux à reproduire et les diagnostics agrégés d’outil.

La moyenne, la couverture globale et la couverture d’un domaine décrivent des dimensions différentes. La limite des domaines moins couverts est explicitée à proximité du chiffre, même avec une couverture globale suffisante. Les agrégats gardent leur rang mais ouvrent aussi les constats détaillés disponibles du même outil et du même domaine. Sans ces détails, le rapport demande le diagnostic source plutôt que de proposer une cause inventée.

La vue d’ensemble présente trois priorités et une aide concrète avant les scores détaillés. Les trois modes et leurs liens canoniques sont conservés. L’export et la navigation privée sont secondaires. Le résultat automatique d’accessibilité et sa limite restent visibles ; les détails sont repliés dans la synthèse et le plan d’action.

La collecte ne conserve pas toujours les ressources/éléments et leur emplacement. Le rendu le dit explicitement. La collecte bornée F14 et ses limites de confidentialité sont décrites dans le [contrat des preuves observées](../connected-space/evidence-f14.md). Les rapports historiques ne sont pas enrichis rétroactivement.

## Introduction humaine publiée

Le propriétaire d’un run, avec un compte vérifié et une session valide, peut préparer une introduction depuis le rapport dont il possède le lien. Le brouillon et la prévisualisation restent en mémoire dans le formulaire. Ils ne sont pas enregistrés au serveur.

La publication est explicite et comprend uniquement :

- l’identité saisie du prestataire (120 caractères maximum ; identité déclarée, pas identité certifiée) ;
- le contexte (1 200 caractères maximum) ;
- deux ou trois clés uniques de constats présents dans ce rapport ;
- la prochaine étape (500 caractères maximum) ;
- la date de publication fixée par le serveur.

`GET/PUT/DELETE /api/account/report-introduction/{token}` sont réservés au propriétaire vérifié. Les écritures exigent le jeton CSRF. La session fournit le propriétaire ; aucun identifiant d’utilisateur soumis par le client n’est accepté. La requête vérifie le hash du token, la propriété du run, l’expiration explicite et la rétention historique. La publication et le retrait se font dans une transaction.

La migration Flyway `V18` ajoute `ARG_AUDIT_REPORT.introduction_json`. Le JSON automatique `report_json` reste inchangé. Le lecteur du rapport ajoute uniquement la note publiée à la réponse, après les mêmes contrôles d’accès et d’expiration que les mesures. Les drafts, identifiants de compte, autres rapports et notes internes ne sont pas exposés.

Tout détenteur du lien peut lire l’introduction publiée, sans connexion, et ouvrir les preuves canoniques sélectionnées. Il ne peut pas modifier la note. La prévisualisation utilise ce même composant de lecture, sans navigation privée. La note figure dans les deux formats PDF. Une nouvelle préparation d’export relit le rapport sans cache. Retirer la note supprime son accès futur ; les copies et PDF déjà transmis ne sont pas rappelés. Sans note, le rapport standard est conservé.

La migration V18 doit être appliquée avant d’exécuter cette version du backend. Aucun déploiement n’est réalisé dans ce lot.

## Recette reproductible

Les fixtures du script sont entièrement fictives. Le backend local écoute sur loopback et n’accède à aucune donnée de production. Ses autorisations simulées vérifient le parcours frontend/BFF ; elles ne remplacent pas la matrice Java d’autorisation.

Depuis `apps/console-web`, construire avec `API_BASE=http://127.0.0.1:3101` et `ACCOUNT_ORIGIN=http://localhost:3102` dans l’environnement, puis `npm run build -- --webpack`. Depuis la racine, lancer `node scripts/e2e/report-prospect.mjs`. Ajouter `--keep-preview` pour laisser l’exemple fictif ouvert à la fin.

La matrice comprend score élevé avec critique, domaine bien noté mais peu couvert, agrégat accompagné de détails, absence de données, rapport historique, clé inconnue et introduction humaine. Elle vérifie les trois modes en FR/EN, clair/sombre, 390/768/1280 px, les liens et le focus clavier, les boutons voisins, la séparation propriétaire/lecteur et les exports PDF. Les captures et la matrice sont conservées localement dans `outputs/ui-review/prospect/`.

Vérifications réalisées le 13 octobre 2026 : 252 cas de la matrice passés sur le build de production, exemple public FR/EN en 390 et 1280 px, publication/retrait et lecture sans compte vérifiés, huit PDF exportés et leurs 26 pages rendues avec Poppler puis inspectées. Les titres, recommandations et preuves longues restent lisibles ; aucun débordement ou élément coupé n’a été relevé dans ces parcours. Les boutons de contact et de copie ont la même hauteur dans les 252 cas. Le catalogue couvre les métriques et des diagnostics courants dont les identifiants ont été vérifiés dans la configuration locale de Lighthouse 13.5.0, avec conservation des anciens identifiants.

La suite Java exécute 682 tests avec succès (un test ignoré). La suite frontend de 500 tests et les contrôles éditoriaux passent ; les derniers cas ajoutés du score provisoire, du catalogue et du PDF sont également vérifiés séparément. Le build et le lint des fichiers modifiés passent. Ces contrôles ne constituent pas une certification d’accessibilité ni un test de compréhension humaine.

Les tests `AccountLifecycleIT.reportIntroductionRequiresOwnerCsrfExistingFindingsAndIsSeparatelyRevocable` vérifient la migration et les vraies routes Java sur la base MariaDB isolée du projet. Ils nécessitent les variables `ARGOS_TEST_CREDENTIALS_*` et le profil `mariadb-integration` ; ne jamais les lancer sur une base de production.

## Recette de compréhension humaine (#369)

Les contrôles automatisés et la revue visuelle ne prouvent pas la compréhension en 30 secondes. Présenter une fixture à un lecteur non technique, puis lui demander de reformuler :

1. Quelle page a été mesurée et quelle partie du site ne peut-on pas juger ?
2. Quelle correction concrète faut-il examiner et où trouve-t-on la preuve ?
3. Quelle est la prochaine étape et quelle limite du diagnostic faut-il retenir ?

Consigner ses réponses réelles, le délai, les hésitations et les corrections nécessaires. Ne pas déclarer le seuil acquis en l’absence de cette séance.

Résultat actuel : recette humaine non exécutée. La base MariaDB isolée n’est pas configurée dans cette session ; la nouvelle recette d’intégration est ajoutée mais non exécutée. Les tests unitaires Java et les tests de parcours synthétiques couvrent les contrôles disponibles.
