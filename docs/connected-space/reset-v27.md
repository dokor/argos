# Remise à zéro Clarté — migration V27

Décision utilisateur du 14 octobre 2026 : aucune donnée de l’ancienne base
Argos n’est à conserver. La préparation et les tests sont autorisés ; cette
PR ne déploie rien et n’exécute aucune opération sur la base de production.
Cette décision remplace les restrictions de conservation des dossiers F01–F13.

## Effet au premier démarrage de la version livrée

`V27__clarte_fresh_start` est une migration Java Flyway découverte dans le
même emplacement que V13/V24/V25. Elle s’applique automatiquement par
`DatabaseInitializer`, avant le serveur HTTP et la planification des workers.
**Déployer puis démarrer cette version sur une base en V26 ou antérieure
efface toutes ses données Argos**, y compris les données publiques.

Les 29 tables applicatives existantes sont vidées dans une transaction DML,
enfants avant parents, contraintes et triggers actifs :

- Comptes, administrateurs, identités, mots de passe, sessions, jetons, OAuth,
  rattachements, limites de requêtes et journaux de sécurité/administration.
- Sites, URL, découvertes, pages sélectionnées, lots et progression.
- Audits, runs, rapports, preuves et introductions ; liens publics et privés
  précédents deviennent indisponibles, aucun ancien token n’est récupérable.
- Consommations, réservations et plafonds individuels.
- Cache technique des domaines, feedback et son historique, newsletter et analytics.

Seules deux lignes techniques sont réinsérées : `ARG_AUDIT_ADMISSION(1,0)`
et `ARG_DISCOVERY_GATE(1)`. Les comptes ADMIN et les données de démonstration
ne sont jamais créés par la migration. Les nouvelles offres utilisent la
configuration FREE 10 / PREMIUM 1000 ; aucun paiement n’est activé.

Les tables, colonnes, index, contraintes, triggers et séquences existants restent
utiles au produit. Aucun changement de structure ni de mapping QueryDSL n’est
nécessaire. Les identifiants auto-incrémentés ne repartent pas à 1 : vider les
données ne justifie pas de réutiliser les anciens identifiants.

`flyway_schema_history` et les fichiers historiques sont conservés. La V27
possède un checksum des opérations et une révision d’algorithme. Une fois
marquée réussie, Flyway ne la rejoue pas : les nouveaux comptes, audits et
crédits survivent aux démarrages suivants. Ne jamais supprimer sa ligne,
modifier une migration déjà appliquée ou employer `clean` en exploitation.

## Transaction, prérequis et incident

Arrêter **toutes** les anciennes instances API/workers et bloquer les admissions
avant la bascule. Flyway sérialise les migrateurs, pas les anciens processus
applicatifs. Garder la maintenance jusqu’à la vérification du résultat.

La migration refuse une table attendue manquante/non-InnoDB et une connexion
avec contrôles de clés étrangères désactivés. Les tables installées par du code
extérieur à Argos ne sont pas ciblées. Examiner les triggers/événements/routines
SQL personnalisés pendant l’inventaire : leurs effets ne font pas partie du
schéma testé. Aucun `TRUNCATE`, `DROP`, désactivation de FK ou reset de séquence.

Une erreur pendant les DELETE/INSERT provoque un rollback explicite, y compris
les mises à jour des compteurs par trigger. Cela ne rend pas transactionnelles
les anciennes migrations DDL qui précèdent V27. Prévoir l’espace InnoDB pour
undo/redo et une fenêtre adaptée au volume ; aucun benchmark de production
n’est revendiqué.

Flyway inscrit le succès après le commit de la purge. Une coupure entre les
deux peut laisser une base vide sans succès V27 : maintenir l’arrêt des accès,
vérifier la version et les compteurs, corriger la cause, puis appliquer la
procédure Flyway de réparation uniquement après diagnostic. Ne jamais lancer
un `repair` automatique ni remettre des utilisateurs au travail avant que V27
soit enregistrée réussie. En cas d’état incertain, garder l’API arrêtée.

Le retour à l’ancien code ne restaure pas les données. Un snapshot opérateur
avant bascule peut servir au secours technique ; il n’impose aucune reprise
métier des anciennes données. La décision d’abandon porte sur la base Argos,
pas sur les autres schémas MariaDB ou les secrets de l’infrastructure.

## Vérification SQL avant réouverture

Utiliser la connexion opérateur sur la base explicitement nommée :

```sql
SELECT DATABASE();
SELECT version, description, checksum, success
FROM flyway_schema_history WHERE version = '27';
SELECT id, pending FROM ARG_AUDIT_ADMISSION;
SELECT id FROM ARG_DISCOVERY_GATE;
SELECT COUNT(*) AS accounts FROM ARG_ACCOUNT_USER;
SELECT COUNT(*) AS audits FROM ARG_AUDIT;
SELECT COUNT(*) AS reports FROM ARG_AUDIT_REPORT;
SELECT COUNT(*) AS reservations FROM ARG_USAGE_RUN;
SELECT COUNT(*) AS batches FROM ARG_DOMAIN_BATCH;
```

Attendu avant création de comptes : V27 réussie avec checksum, admission 1/0,
gate 1, compteurs métier à zéro. Le test d’intégration vérifie les 29 tables.
Après création du compte opérateur, le contrôle « comptes à zéro » ne s’applique
plus. Redémarrer une fois et vérifier que le nouveau compte reste présent.

## Preuves automatisées

`ClarteFreshStartMigrationIT` utilise exclusivement la base locale jetable
`argos_credentials_test` et les garde-fous du harness MariaDB existant :

- V26 peuplée dans les 29 tables, effacement complet, histoire et structure intactes.
- Installation vierge et migration depuis V6 avec anciens liens de rapport.
- Données nouvelles, publication/queue et compte conservés aux redémarrages.
- Erreur injectée tardivement : rollback des données et des compteurs, puis reprise.
- Refus d’une table non transactionnelle avant suppression.

La suite MariaDB existante continue à tester l’inscription/vérification,
le bootstrap ADMIN, les droits, quotas, lots et publications sur le schéma
courant. Les assertions de backfill historique s’arrêtent explicitement à V26 ;
les tests métier sont amorcés après V27. Aucune fixture de test n’est une cible
opérateur. Résultats et SHA réellement exécutés à consulter dans la PR.
