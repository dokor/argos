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

## 3. Provisionnement versionné de la base et de l'utilisateur

Le [script opérateur](../../../scripts/operations/provision-clarte.py) nécessite
Python 3 (bibliothèque standard seulement) et Docker. Il utilise le client
MariaDB déjà présent dans `mariadb-public`, sans créer de conteneur auxiliaire.
Il est validé pour MariaDB 11.4. L'inventaire opérateur a confirmé le réseau
`mariadb-public`, son sous-réseau `172.24.0.0/16` et le raccordement de MariaDB.

Depuis une copie du dépôt contenant cette PR, commencer par la simulation :

```sh
python3 scripts/operations/provision-clarte.py
```

Elle demande le mot de passe DBA avec saisie masquée et affiche le compte attendu
(`root` par défaut). Ce mot de passe est celui de MariaDB, pas celui du compte
Linux ni celui de l’application existante `argos_user` / `argos_db_prod`.
Utiliser les credentials DBA du coffre ou de la configuration du service MariaDB.
Elle vérifie conteneur actif,
réseau et version, prend un verrou de session contre les provisionnements
concurrents puis vérifie l'absence de la base et de tout utilisateur homonyme.
Résultat attendu : `DRY_RUN OK`. Elle ne crée aucun objet DB et ne demande pas
le mot de passe applicatif. Le verrou est libéré à la fermeture de la session.
Le client utilise un fichier privé temporaire dans le conteneur, supprimé en
sortie normale et sur erreur ; une interruption brutale de Docker/hôte peut
nécessiter de vérifier les fichiers `/tmp/argos-provision.*` résiduels avec le DBA.

Puis, pour créer explicitement les deux objets :

```sh
python3 scripts/operations/provision-clarte.py --apply
```

Les contrôles sont répétés dans la même session verrouillée avant les écritures.
Le script demande aussi un nouveau mot de passe applicatif du coffre (minimum
24 caractères), puis sa confirmation. Aucun secret n'est affiché, passé dans
les arguments ou écrit dans le dépôt. Garder le mot de passe dans le coffre et
le reporter dans la configuration privée candidate. Ne pas l'envoyer à Codex.

Résultat attendu : `APPLIED OK`. Le script :

- Crée `argosclarteprod` en utf8mb4, sans `IF NOT EXISTS` ni réutilisation.
- Crée uniquement `argosclarte`@`172.24.0.0/255.255.0.0`, jamais un accès `%`.
- Accorde les droits DDL/DML à cette base seulement, sans droits globaux ni
  `GRANT OPTION`, pour que Flyway puisse travailler au futur démarrage.
- Vérifie une connexion TCP avec le nouveau compte, la base sélectionnée,
  l'identité réellement authentifiée, l'absence de tables et les droits effectifs.

Le format hôte/netmask et l'authentification par empreinte locale utilisent les
mécanismes documentés de MariaDB : [CREATE USER](https://mariadb.com/docs/server/reference/sql-statements/account-management-sql-statements/create-user),
[mysql_native_password](https://mariadb.com/docs/server/reference/plugins/authentication-plugins/authentication-plugin-mysql_native_password).
L'empreinte est un credential sensible ; les sorties d'erreur SQL sont donc
masquées et aucune commande SQL complète n'est imprimée.

Une seconde exécution refuse les noms existants, même si la base est vide.
Une erreur après création peut laisser la base ou l'utilisateur présents : les
DDL MariaDB ne constituent pas une transaction globale. Le script préserve ces
objets, signale l'état partiel et ne tente ni suppression, ni correction, ni
rotation de mot de passe. Faire vérifier cet état par le DBA avant toute suite.
Les échecs indiquent l'étape et, si le client le fournit, uniquement le numéro
d'erreur MariaDB et le SQLSTATE. Le texte brut de l'erreur, le SQL, les secrets
et les empreintes restent masqués. `connexion/version` avec ERROR=1045 indique
un refus d'authentification ; `absence-utilisateur` avec ERROR=1142 indique un
manque de droits de lecture pour vérifier les collisions. Comparer avec la
connexion manuelle habituelle, avec saisie masquée :

```sh
docker exec -it mariadb-public mariadb -u root -p -e 'SELECT VERSION(), CURRENT_USER();'
```

Si le compte DBA habituel n'est pas root, utiliser le même nom en CLI et dans
`--admin-user`. Ne pas modifier les grants ou le mot de passe d'un compte existant
pour contourner l'échec ; utiliser le compte opérateur déjà autorisé. Références :
[1045](https://mariadb.com/docs/server/reference/error-codes/mariadb-error-codes-1000-to-1099/e1045),
[1142](https://mariadb.com/docs/server/reference/error-codes/mariadb-error-codes-1100-to-1199/e1142).

Le verrou protège les opérateurs utilisant ce script ; il ne bloque pas un DBA
qui exécute du SQL indépendamment. Les CREATE sans clause de remplacement
refusent également les collisions survenant entre les contrôles et la création.

Les options `--container`, `--network`, `--subnet`, `--database`, `--user` et
`--admin-user` permettent de cibler un autre environnement nommé. Les noms de
base et d'utilisateur applicatif n'acceptent que lettres/chiffres, pour éviter
les jokers de GRANT et toute interpolation SQL arbitraire. Utiliser le compte
DBA habituel si ce n'est pas `root`. Le script ne lance ni Flyway, ni serveur,
ni workflow, ni suppression de données. La base reste vide jusqu'à la future
mise en service autorisée. Ne jamais lancer les harness de tests sur cette base.

Validation : tests unitaires de refus/absence d'écritures et tests sur une
MariaDB jetable, dans le [workflow dédié](../../../.github/workflows/production-provisioning.yml).
La CI vérifie la création, les collisions, le verrou concurrent, l'authentification,
les droits DDL, le refus de lecture d'une autre base, le refus hors sous-réseau,
la conservation d'une donnée publique témoin et la suppression des fichiers
clients temporaires après une erreur d'authentification. Ces tests ne ciblent
jamais un conteneur de production.

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

Les pages publiques FR/EN doivent rester accessibles anonymement et indexables.
La future bascule ne doit ajouter ni protection globale par connexion, ni
`noindex` global, ni blocage du site dans `robots.txt`. Avant et après bascule,
vérifier `/`, `/en`, les pages d'acquisition/ressources/guides, `robots.txt` et
`sitemap.xml` : réponses publiques 200, absence de redirection vers la connexion,
absence de `noindex` HTML ou `X-Robots-Tag` sur les pages indexables, canonicals
et hreflang conservés. Les comptes et rapports privés gardent leur `noindex`.
Une fermeture temporaire de l'espace connecté doit rester limitée à ses routes.

La conservation de l'ancienne base ne rend pas ses rapports accessibles depuis
la nouvelle : décider séparément du traitement des données publiques et des
anciens liens. Vérifier sauvegarde/restauration isolée, SMTP/OAuth, capacité
Raspberry/Argon2, parcours et accessibilité selon le runbook. Relever les SHA
et les résultats de recette du code finalement retenu. La préparation de ces
fichiers ne vaut pas validation de ces contrôles ni autorisation de déploiement.
