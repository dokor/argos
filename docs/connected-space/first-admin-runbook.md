# Premier ADMIN — base nommée et compte vérifié

Cette procédure est opérateur, hors API. Ne jamais utiliser les schémas de test
ou commandes de nettoyage Flyway contre une base conservée. L’outil ci-dessous
ne crée pas de schéma, ne migre pas, ne supprime pas de données et ne démarre pas
le serveur. Il ne sert pas à récupérer un ADMIN existant.

## Préparation

1. Nommer explicitement l’environnement et sa base. La production retenue
   conserve `argos_db_prod` et `argos_user` ; voir le
   [kit opérateur](production/README.md). Contrôler l'historique Flyway et la
   sauvegarde. Pour un environnement neuf, employer un compte DB limité à sa
   base dédiée. Les tables moteur/public et données nécessaires restent conservées.
2. Construire `mvn package` dans `apps/api-backend`. Configurer l’application
   avec cette base ; au démarrage habituel, Flyway applique les migrations restantes.
   Garder les versions historiques et leurs checksums. Vérifier V26 ou suivantes.
3. Configurer `account.enabled`, origine exacte commune Next/Java, secret JWT,
   SMTP de recette et offres/plafonds suivant [operations](../accounts/operations.md).
   `ADMIN_API_TOKEN` reste distinct. Retirer les anciennes variables Next
   `ADMIN_PASSWORD` et `ADMIN_TOKEN`. Aucun accès frontend de secours partagé.
4. Vérifier d'abord si un ADMIN existe : le CLI refuse tout nouveau bootstrap
   dans ce cas, utiliser l'accès ou la récupération du compte existant.
   Sinon conserver un compte ACTIVE vérifié éligible. S'il n'existe pas, depuis
   `/account/register`, créer le compte opérateur, ouvrir l'e-mail de vérification
   et confirmer. Vérifier une connexion normale. Ne jamais modifier
   l’état en SQL pour contourner la preuve e-mail. Relever son ID exact dans
   ARG_ACCOUNT_USER avec l’outil DB opérateur ; ne pas convertir cet ID en flottant.
5. Arrêter les processus API/workers pour l’application de la promotion.
   Conserver un accès infra indépendant. Une simulation peut précéder cet arrêt ;
   elle ne réserve pas la cible et tous les contrôles sont refaits lors de l’application.

## Simulation et application explicite

Injecter dans un environnement opérateur temporaire, depuis le gestionnaire de
secrets : `ARGOS_BOOTSTRAP_JDBC_URL` (jdbc:mariadb…), `ARGOS_BOOTSTRAP_USER` et
`ARGOS_BOOTSTRAP_PASSWORD`. Ne pas mettre le mot de passe dans une ligne de
commande, un historique shell, un log ou un fichier versionné. Retirer ces
variables et fermer la connexion opérateur après usage. Ce sont des paramètres
CLI temporaires, pas une nouvelle configuration de l’application.

Depuis la racine du dépôt, remplacer **123** par l’ID vérifié :

```sh
java -cp 'apps/api-backend/target/dist/api-backend/lib/*' com.dokor.argos.operations.FirstAdminBootstrap --database argos_db_prod --user-id 123
```

Sortie attendue : `DRY_RUN userId=123`, code 0, aucune écriture. Vérifier la base
et la cible dans l’outil DB. Pour appliquer la décision opérateur autorisée :

```sh
java -cp 'apps/api-backend/target/dist/api-backend/lib/*' com.dokor.argos.operations.FirstAdminBootstrap --database argos_db_prod --user-id 123 --apply
```

Sortie attendue : `APPLIED userId=123`, code 0. Les mêmes arguments fonctionnent
sous PowerShell ; adapter le chemin du répertoire `lib` à l’installation réelle.
Un échec renvoie code 1 sans imprimer les paramètres JDBC ni les secrets.
La base réellement sélectionnée doit correspondre exactement à `--database`.
Tout ADMIN existant interdit un nouveau bootstrap ; une seconde exécution n’est
pas un chemin de récupération. Une transaction échouée ne doit laisser ni rôle
promu, ni sessions partiellement révoquées, ni événement isolé.

## Smoke tests

- Redémarrer l’API avec sa configuration normale. L’ancienne session de la cible
  doit être refusée ; se reconnecter via `/account/sign-in` (ou `/en/account/sign-in`).
- Ouvrir `/account/admin/users`, consulter la fiche et le journal, accéder aux
  analyses et aux métriques. Un compte standard et une session expirée/révoquée
  doivent rester refusés côté API. L’offre de la cible reste inchangée.
- Vérifier le rôle ADMIN, l’incrément de `admin_version`, les révocations et un
  événement de sécurité `bootstrap_admin/accepted` lié au seul ID de la cible.
- `/dashboard`, `/dashboard/analytics`, `/dashboard/report/123`, `/login` et
  leurs variantes `/en` : 404 sans redirection. Le cookie `argos_admin` n’y change rien.
- GET `/api/audits` et lectures numériques historiques : 410/no-store au BFF.
  `POST /api/audits` public, token de rapport, audit connecté et historique restent
  utilisables ; vérifier un quota épuisé sans nouvelle admission.
- Vérifier la collecte analytics uniquement avec consentement et secret serveur ;
  ne pas employer ce secret comme JWT de compte. Vérifier footer, langue et thème.

## Diagnostic et récupération

En cas de refus, vérifier base sélectionnée, version du schéma, compte ACTIVE
avec méthode de connexion active, ADMIN préexistant, droits SQL et verrou opérateur.
Ne pas afficher l’environnement complet ni les exceptions JDBC dans des tickets.
Conserver le résultat, l’ID cible, l’environnement et l’approbation opérateur dans
le registre d’exploitation, sans secret. Si un ADMIN existe mais ne peut plus se
connecter, utiliser la récupération de compte existante ou une intervention infra
séparément autorisée. Ne pas supprimer le rôle pour contourner le bootstrap.

La preuve automatisée utilise une MariaDB jetable gardée par le harness existant :
`AccountLifecycleIT` initialise le schéma vierge et exerce la vraie vérification,
la promotion, les refus et la reconnexion. `ControlledAuditE2eIT` utilise aussi le
bootstrap avant sa recette administrative dans le navigateur. Aucun de ces tests
n’autorise un reset, une fusion ou un déploiement de production.
