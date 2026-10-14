# Préparation opérateur de la production Clarté

Ce kit complète le [runbook de mise en service](../commissioning-f13.md).
L'opérateur exécute les commandes sur le serveur ; Codex n'y accède pas.
La préparation conserve les services et la base existants. Le démarrage de
l'API candidate, les migrations, la promotion ADMIN et la bascule restent
pour la future mise en service explicitement autorisée.

Décisions du 14 octobre 2026 : nouvelle base **argosclarteprod**, utilisateur
**argosclarte**, origine **https://argos.lelouet.fr**, FREE **10** et PREMIUM
**1000** crédits par mois UTC. Le nom de base évite les caractères joker des
GRANT MariaDB. Une collision de nom doit être résolue avant toute création,
sans réutiliser ou nettoyer une base existante.

## 1. Inventaire à exécuter maintenant — lecture seule

Depuis le serveur, transmettre uniquement la sortie de ces commandes :

```sh
docker version --format '{{.Server.Version}}'
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
for service in api-backend console-web playwright-service lighthouse-service; do
  docker inspect --format '{{.Name}} image={{.Image}} networks={{range $name, $config := .NetworkSettings.Networks}}{{$name}} {{end}}' "$service"
done
for file in /srv/configs/api-backend/prod.conf /srv/configs/console-web/.env.prod; do
  stat -c '%a %U:%G %n' "$file"
done
```

Ne pas transmettre `docker inspect` complet, `printenv`, les fichiers de secrets
ou la sortie développée de `docker compose config`. En cas de droits manquants,
utiliser le compte opérateur habituel ; ne pas modifier les permissions du démon.

Exécuter [database-inventory.sql](database-inventory.sql) dans l'outil MariaDB
opérateur déjà configuré. En CLI, utiliser un fichier client protégé existant
(`--defaults-extra-file` doit être la première option) ou la saisie interactive
du mot de passe, jamais `--password=...`. Aucun conteneur MariaDB ni compte root
n'est supposé par le kit. Une erreur de droits sur `mysql.user` signifie que la
collision utilisateur reste à vérifier par le DBA, pas que le compte est absent.

Remplir la [fiche privée](environment.example.md). Vérifier aussi dans GitHub
que les quatre workflows `deploy-*` sont toujours `disabled_manually` ; ne pas
les réactiver pendant la préparation.

## 2. Fichiers candidats — hors des chemins actifs

Créer un répertoire réservé aux candidats, après avoir vérifié qu'il n'existe
pas déjà et qu'aucun Compose actif ne l'utilise. Par exemple, avec les droits
opérateur appropriés :

```sh
(umask 077; mkdir /srv/configs/argos-clarte-candidate)
```

Si le répertoire existe, l'inspecter ; ne pas écraser son contenu. Copier via
l'éditeur ou le transfert de fichiers habituel, sans afficher les secrets :

| Source versionnée | Copie privée à préparer |
|---|---|
| [backend.candidate.conf](backend.candidate.conf) | `/srv/configs/argos-clarte-candidate/backend.conf` |
| [backend.private.example.conf](backend.private.example.conf) | `/srv/configs/argos-clarte-candidate/backend.private.conf` |
| [console.env.example](console.env.example) | `/srv/configs/argos-clarte-candidate/console.env` |

Les exemples de secrets sont volontairement vides et inutilisables tels quels.
Renseigner `clarte.database-host` avec le nom DNS MariaDB joignable depuis
`mariadb-public`, sans port, chemin ni credentials (port MariaDB 3306).
Un port différent demande d'adapter explicitement l'URL JDBC candidate.
Stocker les mots de passe DB, API interne, SMTP et les jetons dans le coffre.
Générer un secret JWT aléatoire d'au moins 64 octets UTF-8, distinct du jeton
serveur `admin-api.token` / `ADMIN_API_TOKEN`. Le jeton serveur doit correspondre
entre Next et Java. Les secrets n'ont pas besoin d'être envoyés à Codex.

Le backend inclut les valeurs applicatives du package puis le fichier privé
obligatoire `/config/clarte-private.conf`. Les valeurs publiques de la candidate
(origines, quotas, TLS SMTP) sont ensuite prioritaires. Ne pas surcharger les
quotas dans le fichier privé. Prévoir les callbacks exacts et les réglages SMTP
réels décrits dans [operations.md](../../accounts/operations.md). Ne configurer
que les fournisseurs testés ; la connexion par mot de passe suffit au bootstrap.

Préparer une **copie séparée** des Compose complets de la révision retenue :

- API : remplacer la source du montage `/config/prod.conf` par le fichier
  candidat `backend.conf` ; ajouter le montage en lecture seule
  `/srv/configs/argos-clarte-candidate/backend.private.conf:/config/clarte-private.conf:ro`.
- Console : remplacer `env_file` par le seul fichier candidat `console.env`.
  Ne pas cumuler l'ancien env-file via un override Compose ; les listes se fusionnent.
- Garder `JAVA_TOOL_OPTIONS=-Dconfig.file=/config/prod.conf`, les réseaux, routes
  BFF, restrictions egress, isolation des collecteurs et limites de ressources.
  Vérifier que Next joint `api-backend:8081` sur leur réseau commun.
- Relire les paramètres spécifiques actuellement nécessaires (SMTP, external
  services, analytics, etc.) avant leur report dans la copie. Les valeurs
  d'environnement ont parfois priorité sur HOCON ; relever les noms des
  variables concernées sans publier leur contenu.
- Permissions : répertoire réservé à l'opérateur, secrets non lisibles par les
  autres utilisateurs, lecture permise à l'UID effectif du conteneur monté.
  Adapter propriétaire/groupe plutôt que rendre les secrets publics.

`docker compose -f <copie-candidate> config --quiet` vérifie la syntaxe Compose
sans afficher la configuration développée et sans créer de conteneur. Cela ne
vérifie ni les secrets HOCON, ni la connexion DB, ni SMTP. Ne lancer aucune
commande `up`, `restart`, workflow de déploiement ou copie vers les fichiers actifs.

## 3. Base neuve — après revue de l'inventaire

Cette étape prépare seulement une base vide et son utilisateur ; elle ne touche
pas l'ancienne base. Ne la lancer qu'une fois le serveur MariaDB, l'absence de
collision et le périmètre réseau de l'utilisateur confirmés dans la fiche.

Dans la connexion opérateur à **la bonne instance** :

```sql
CREATE DATABASE `argosclarteprod`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Pas de `IF NOT EXISTS` : une collision doit arrêter la procédure. Créer ensuite
`argosclarte` via l'outil d'administration habituel, avec un nouveau secret du
coffre et un hôte autorisé limité au réseau client réellement utilisé. Ne pas
utiliser automatiquement `%`. Ne pas réutiliser un compte aux droits globaux.
Le provisionnement du compte dépend de cet hôte, encore à relever ; ne pas
copier un exemple d'adresse comme cible réelle.

Attribuer les droits sur **`argosclarteprod` uniquement**, sans `GRANT OPTION`.
Le compte utilisé par l'application applique aussi Flyway au démarrage : il lui
faut les droits DDL/DML sur ce schéma (ALL PRIVILEGES limité à cette base), pas
seulement SELECT/INSERT. Vérifier les grants avec l'outil DBA ; ne pas publier de
sortie pouvant contenir une empreinte d'authentification.

Avec la connexion du nouvel utilisateur, vérifier la base sélectionnée et son
absence de tables (résultat attendu : `argosclarteprod`, puis `0`) :

```sql
SELECT DATABASE();
SELECT COUNT(*) AS tables_present FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE();
```

Conserver une preuve expurgée de la création et des droits. **Ne pas lancer les
harness de tests contre cette base**, ni Flyway `clean`, ni l'API pour « tester »
la connexion : son démarrage migrerait le schéma et lancerait des services.

## 4. Quotas modifiables sans changement de code

Dans `backend.conf`, les deux valeurs sont regroupées :

```hocon
usage.offers.FREE.monthly-limit = 10
usage.offers.PREMIUM.monthly-limit = 1000
```

Après modification, un redémarrage planifié de l'API recharge la configuration
(elle est lue au démarrage, pas dynamiquement). Aucun build du code ni remise à
zéro des consommations n'est nécessaire. Le mois est calendaire UTC ; conserver
ce fuseau pour ne pas changer la répartition du registre.

Un crédit correspond à une analyse de page publiée ; un lot réserve un crédit
par page sélectionnée. Le disponible tient compte du consommé **et** du réservé.
Les plafonds individuels définis dans l'administration priment sur l'offre ;
vérifier les exceptions quand on change la valeur globale. Un abaissement sous
l'engagé ne rembourse rien : les nouvelles admissions sont bloquées. `0` bloque
les lancements ; supprimer le plafond ou le mettre à `null` signifie illimité.
L'offre PREMIUM ne confère aucun droit ADMIN et ne déclenche aucun paiement.

## 5. Premier administrateur — préparation maintenant, exécution ultérieure

Conserver l'email souhaité dans la fiche privée ; aucun compte ni mot de passe
initial n'est codé dans une migration. Le [runbook ADMIN](../first-admin-runbook.md)
reste la procédure d'autorité. À la future mise en service :

1. Appliquer les migrations historiques par le démarrage normal autorisé de
   l'API sur la base candidate, puis vérifier SMTP et le parcours réel.
2. Créer le compte, ouvrir son email, confirmer la vérification et se connecter.
3. Relever l'ID exact de ce compte (chaîne entière), puis simuler le bootstrap
   avec `--database argosclarteprod --user-id <ID_VERIFIE>` et les variables
   temporaires `ARGOS_BOOTSTRAP_*` injectées par le coffre.
4. Arrêter API/workers dans la fenêtre autorisée avant `--apply`, puis appliquer,
   purger les variables temporaires, redémarrer et se reconnecter.
5. Vérifier l'accès ADMIN, le refus d'un compte standard et le journal de sécurité.

Aujourd'hui : ne pas démarrer de service, ne pas exécuter `--apply`, ne pas
fabriquer un compte ACTIVE en SQL. La simulation exige elle aussi le schéma
migré et le compte vérifié ; elle ne peut pas réussir sur la base vide préparée.

## 6. Conditions avant la future bascule

La conservation de l'ancienne base ne rend pas ses rapports accessibles depuis
la nouvelle : décider séparément du traitement des données publiques et des
anciens liens. Vérifier sauvegarde/restauration isolée, SMTP/OAuth, capacité
Raspberry/Argon2, parcours et accessibilité selon le runbook. Relever les SHA
et les résultats de recette du code finalement retenu. La préparation de ces
fichiers ne vaut pas validation de ces contrôles ni autorisation de déploiement.
