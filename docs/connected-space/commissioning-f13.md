# Mise en service Clarté — initialisation propre

Ce runbook prépare un environnement neuf nommé. Il n'exécute aucune mise en
production, suppression ou copie de données. Il complète le
[premier ADMIN](first-admin-runbook.md), la [configuration comptes](../accounts/operations.md)
et les [protections des collecteurs](../../infra/compose/lighthouse-service).

Le [kit opérateur de préparation](production/README.md) fournit les fichiers
candidats, les contrôles en lecture seule et les quotas retenus. Il sépare la
préparation de la future activation et du bootstrap.

## 1. Fiche d'environnement avant exécution

Consigner environnement, origine HTTPS, nom de base, version MariaDB, SHA des
images frontend/API/collecteurs, responsable et décision de mise en service.
Employer une base neuve et un utilisateur DB limité à cette base. Le nom
`argos_clarte_recette` est un exemple, pas une cible à déduire automatiquement.
Ne pas réutiliser les noms réservés aux harness de test pour un environnement
conservé : les suites d'intégration les nettoient.

Inventaire à décider explicitement si une production existante est remplacée :

| Famille | Conséquence d'un départ sans reprise |
|---|---|
| ARG_ACCOUNT_* | Profils, méthodes, sessions, preuves, associations sites/URL et rattachements de runs absents ; comptes à recréer, aucune reconnexion avec une ancienne session |
| ARG_USAGE_ACCOUNT / ARG_USAGE_RUN | Plafonds individuels et historique de consommation/réservation non repris ; ne pas transposer un compteur sans les réservations correspondantes |
| ARG_DOMAIN_DISCOVERY*, ARG_DOMAIN_BATCH* | Découvertes, sélections, lots, liens stables et historique connecté non repris |
| ARG_ADMIN_EVENT, ARG_ACCOUNT_SECURITY_EVENT | Historique administratif/sécurité non présent dans la nouvelle base ; conservation éventuelle séparée selon la politique existante |
| ARG_AUDIT*, ARG_DOMAIN*, feedback, analytics, newsletter | Données moteur/public partagées ou adjacentes : elles ne sont pas autorisées à être supprimées par la décision de refonte connectée |

Les liens privés et publics utilisent des relations/credentials persistés.
Une base entièrement neuve ne peut pas préserver leurs anciens liens par
magie. Si les données publiques doivent être conservées, définir et faire
valider séparément une reprise cohérente ; ne pas effacer seulement les tables
compte dans une base partagée. Le présent lot n'impose aucune coexistence de
deux interfaces ni migration de compatibilité de l'ancien espace.

## 2. Construire et initialiser

1. Vérifier l'intégration des PR F01–F14 concernées et le manifeste de recette
   du SHA retenu. Un manifeste portant le commit de merge de PR doit être
   distingué du head de branche et du futur commit de livraison.
2. Construire le package Java et le frontend par les commandes du dépôt.
   Démarrer l'API sur la base neuve dédiée : Flyway applique la chaîne historique
   complète jusqu'à V26 ou suivantes. Ne pas éditer les checksums ni utiliser
   `clean` sur un environnement conservé. Le démarrage du package est vérifié
   dans la CI MariaDB, séparément des mocks frontend.
3. Configurer l'origine identique côté Next et Java, API_BASE serveur, comptes,
   secret JWT, SMTP, fournisseurs sociaux réellement disponibles, offres/quota,
   limites de découverte/lot et capacités headless. Partir des exemples
   versionnés référencés dans [operations](../accounts/operations.md),
   [découverte](discovery-f06.md) et [lots](batch-f07.md).
4. Conserver l'egress proxy et l'isolation Chromium. `/api/account/*` doit passer
   par le BFF ; aucune exposition directe ne doit contourner origine/CSRF.
   `ADMIN_API_TOKEN` reste un secret serveur indépendant. Supprimer les anciennes
   variables ADMIN_PASSWORD/ADMIN_TOKEN ; elles ne rétablissent aucun accès.
5. Créer puis vérifier le compte opérateur par le vrai parcours email. Appliquer
   la simulation puis le bootstrap explicite du [runbook ADMIN](first-admin-runbook.md),
   API/workers arrêtés pour la promotion. Reconnexion obligatoire ensuite.

## 3. Smoke tests de l'environnement retenu

Utiliser deux comptes de recette dédiés et un domaine de test autorisé.
Consigner résultat/date/SHA sans mot de passe, jeton, URL privée ou contenu email.

- Inscription, vérification, connexion, déconnexion, récupération et changement
  de mot de passe ; vérifier délivrabilité SMTP et callbacks OAuth configurés.
- Analyse URL : admission, progression, publication, lecture privée, relance,
  historique et absence de duplication sur reprise d'une requête.
- Domaine : découverte bornée, sélection, coût affiché, admission tout-ou-rien,
  fermeture/retour/rafraîchissement, synthèse, filtre de règle, run exact et ancien lot.
- Dashboard : dernières tentatives, compteurs/listes concordants, cas sans mesure,
  filtre/pagination et arrêt de polling au terminal.
- Quotas : disponible = limite − consommé − réservé, refus au quota nul,
  rapport publié débité une fois et échec sans rapport restitué.
- ADMIN : utilisateur standard refusé, cible ADMIN protégée, version obsolète,
  plafond sous engagé refusé, motif/journal, suspension et sessions révoquées.
- Deux propriétaires du même hôte : aucun ID de l'autre n'ouvre de données privées.
- Accueil, analyse publique et token de rapport conservés ; anciennes routes
  en 404, lectures numériques BFF en 410 ; footer, langue et thème présents.
- Rapport/PDF : origine des preuves, absence distincte de zéro, secrets exclus.

La CI démontre ces mécanismes sur fixtures isolées. Elle ne valide pas les
secrets, DNS, certificats, délivrabilité ou performances de l'environnement cible.
Prévoir une revue clavier/zoom natif 200 % et lecteur d'écran sur les parcours
principaux ; les scans axe et la taille racine injectée ne les remplacent pas.

## 4. Sauvegarde, incident et décision

La CI prend un dump cohérent de la MariaDB jetable, le restaure dans un autre
schéma isolé et compare nombre et empreinte des rapports. C'est une preuve de
restauration de cette fixture, pas un exercice de reprise de toute la production.
Tester séparément restauration complète, droits, stockage des secrets et temps
de reprise de l'environnement retenu avant une mise en service effective.

En cas d'anomalie, arrêter les nouvelles admissions, préserver la base et les
preuves, identifier le run/lot/statut et vérifier réservations/publication.
Ne pas rejouer un débit ou modifier un solde à la main. Utiliser le diagnostic
et les reprises des services ; une intervention sur les données nécessite son
propre périmètre et sa décision. Pour un échec du bootstrap, suivre son runbook,
sans retirer le rôle ADMIN pour contourner le garde-fou.

La décision finale consigne les réserves (fournisseurs, accessibilité manuelle,
charge/Argon2, supervision, stockage/rotation des secrets), les responsables et
leur résultat. Aucun reset, fusion ou déploiement n'est lancé par cette recette.
