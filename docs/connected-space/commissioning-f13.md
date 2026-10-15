# Mise en service Clarté — après remise à zéro

La décision D-21 autorise l’abandon de toutes les données de la base Argos,
y compris comptes et rapports publics. La PR prépare l’opération sans déployer.
Le [kit opérateur](production/README.md) fixe l’ordre d’arrêt, migration et reprise ;
le [contrat V27](reset-v27.md) précise l’effacement et la gestion d’incident.

## 1. Environnement et données

Consigner la base exacte, MariaDB, le SHA des quatre images et la fenêtre opérateur.
La cible est la base Argos existante ; une installation vierge est aussi testée.
Aucune reprise métier n’est attendue : comptes, identités, sessions, audits,
rapports/liens, quotas, domaines/lots, caches, journaux, newsletter, feedback et
analytics sont effacés. Les configurations/secrets de l’infrastructure restent
hors base. Seuls l’historique Flyway et les deux lignes techniques persistent.

Ne jamais exécuter les harness contre la production. La future migration V27
s’applique après arrêt de tous les anciens écrivains, avant de rouvrir les accès.
Les versions historiques restent immuables. V27 ne modifie ni colonnes ni
mappings QueryDSL. Le code du moteur et les protections restent opérationnels.

## 2. Construire et initialiser lors de la future bascule

1. Retenir le SHA testé et les images API, console, Lighthouse et Playwright.
   Les lots F01–F14 sont fusionnés ; utiliser les preuves CI du commit livré.
2. Préparer la configuration selon le [kit opérateur](production/README.md) :
   origine Next/Java, API_BASE serveur, JWT, SMTP, OAuth retenus, offres et limites.
   Retirer ADMIN_PASSWORD/ADMIN_TOKEN ; ADMIN_API_TOKEN reste serveur et distinct.
3. Dans la fenêtre autorisée, bloquer les admissions et arrêter les anciens
   services écrivants. Démarrer une seule API candidate sur la base nommée :
   Flyway applique la chaîne historique et V27 avant HTTP et scheduler.
4. Vérifier V27 réussie, les deux lignes techniques et les compteurs vides.
   Garder les accès fermés en cas d’échec et suivre le diagnostic V27.
5. Démarrer la console et les collecteurs candidats. Vérifier la délivrabilité
   SMTP puis créer et vérifier le nouveau compte opérateur. Appliquer le
   [bootstrap ADMIN](first-admin-runbook.md), API/workers arrêtés pour la promotion.
   Redémarrer puis se reconnecter.
6. Exécuter les smoke tests ci-dessous avant réouverture. Ne pas réactiver
   automatiquement les workflows de déploiement.

## 3. Smoke tests de l’environnement retenu

Utiliser deux nouveaux comptes de recette et un domaine de test autorisé.
Consigner résultat/date/SHA sans mot de passe, jeton, URL privée ou contenu email.

- Inscription, vérification, connexion, déconnexion, récupération et changement
  de mot de passe ; délivrabilité SMTP et callbacks OAuth réellement configurés.
- Analyse URL : admission, progression, publication, lecture privée, relance,
  historique et absence de duplication sur reprise d’une requête.
- Domaine : découverte, sélection, coût, admission tout-ou-rien, fermeture/retour,
  rafraîchissement, synthèse, filtre, run exact et conservation des nouveaux lots.
- Dashboard : compteurs/listes concordants, absence de mesure explicite,
  filtres/pagination et arrêt du polling au terminal.
- Quotas : limite − consommé − réservé, refus à zéro, publication débitée une fois,
  échec sans rapport restitué ; valeurs FREE 10 et PREMIUM 1000 configurables.
- ADMIN : utilisateur standard refusé, cible ADMIN protégée, version obsolète,
  plafond sous engagé refusé, motif/journal, suspension et sessions révoquées.
- Deux propriétaires du même hôte : aucun ID de l’autre ne donne accès aux données.
- Accueil et audit public fonctionnels, nouveaux liens de rapport valides ; anciens
  liens et sessions indisponibles, anciennes routes 404 et lectures BFF retirées 410.
- Rapport et PDF : preuves collectées, absence distincte de zéro, secrets exclus.
- Redémarrage : comptes/analyses nouveaux conservés, V27 non rejouée, queue correcte.
- Clavier, zoom natif 200 %, lecteur d’écran, langues et thèmes sur les parcours principaux.

La CI ne valide pas les secrets, DNS, certificats, délivrabilité ou performances
du serveur cible. Mesurer aussi la capacité Argon2/Chromium et configurer les
limites et la supervision avant ouverture.

## 4. Incident et décision

En cas d’échec de migration, garder les admissions fermées et diagnostiquer
avant de relancer. Le [contrat V27](reset-v27.md) explique le rollback DML et
l’intervalle entre commit et enregistrement Flyway. Aucun repair automatique.

La CI restaure une MariaDB jetable ; elle ne prouve pas la reprise du serveur
réel. Une sauvegarde de secours technique éventuelle n’impose aucune reprise
métier des données abandonnées. Revenir à une ancienne image ne restaure pas
la base effacée. Consigner la décision d’ouverture et les résultats cible.
