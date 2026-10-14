# Préparation et mise en service de Clarté

La refonte F01–F14 et la recette F13 sont intégrées dans `main`. Le présent
kit prépare la remise à zéro de la base Argos existante par **Flyway V27**.
La décision utilisateur autorise l’abandon de toutes les anciennes données.
Aucun déploiement ni accès à la base de production n’est effectué par cette PR.

Cible proposée d’après le contexte opérateur : **argos_db_prod**, utilisateur
**argos_user**, origine **https://argos.lelouet.fr**. Confirmer ces identifiants
sur l’instance réelle dans la [fiche privée](environment.example.md). Les
anciennes propositions `argosclarteprod`/`argosclarte` de #577 et le nettoyage
sélectif de #578 sont remplacés par cette procédure. Ne pas reprendre les
scripts Python de la PR #578 fermée sans fusion.

## 1. Préparation maintenant

- Relever version MariaDB, images actives, SHA candidat, réseaux Docker, volumes
  de configuration et nom exact de la base. Exécuter l’[inventaire SQL](database-inventory.sql)
  en lecture seule avec la connexion opérateur habituelle.
- Confirmer l’absence d’écrivains extérieurs et inspecter les effets SQL
  personnalisés éventuels. Tous les schémas autres que la base Argos sont hors cible.
- Les quatre workflows `deploy-*` restent désactivés. Vérifier cet état avant
  une fusion ; aucune réactivation ni commande `up` n’appartient à la préparation.
- Construire les quatre images au SHA retenu et conserver leurs références.
  Préparer une fenêtre de maintenance et les moyens de diagnostic de migration.

Conserver les sorties sans données personnelles ni secrets. Ne pas publier les
fichiers HOCON/env complets, `printenv`, `docker inspect` complet ou une
configuration Compose développée. Un inventaire non exécuté reste à faire.

## 2. Configuration candidate séparée

Copier les exemples dans un répertoire privé hors des chemins actifs,
par exemple `/srv/configs/argos-clarte-candidate`, après avoir vérifié qu’aucun
service ne l’utilise. Ne pas écraser un répertoire existant sans l’inspecter.

| Source versionnée | Fichier privé candidat |
|---|---|
| [backend.candidate.conf](backend.candidate.conf) | `backend.conf` |
| [backend.private.example.conf](backend.private.example.conf) | `backend.private.conf` |
| [console.env.example](console.env.example) | `console.env` |

Renseigner le DNS MariaDB interne, les identifiants DB, le secret JWT, SMTP,
le secret API interne et le token administratif serveur à partir du coffre.
Les valeurs vides des exemples ne permettent pas le démarrage. `argos_user`
doit avoir les droits DDL/DML sur **la seule base Argos**, pour les migrations
et le fonctionnement courant ; ne pas créer de compte aux droits globaux.
Vérifier les droits réels avec l’outil DBA sans transmettre de secrets.

L’origine Next `ACCOUNT_ORIGIN` et Java `account.origin` doit être identique.
`API_BASE` reste serveur. Configurer les callbacks OAuth effectivement retenus,
SMTP STARTTLS et les réglages décrits dans [operations](../../accounts/operations.md).
Retirer les anciennes variables `ADMIN_PASSWORD`/`ADMIN_TOKEN`.
`ADMIN_API_TOKEN` reste un secret serveur distinct du secret JWT de compte.

Préparer des copies des Compose de la révision retenue :

- API : monter `backend.conf` sur `/config/prod.conf` et le fichier privé sur
  `/config/clarte-private.conf`, en lecture seule ; garder `JAVA_TOOL_OPTIONS`.
- Console : utiliser le seul `console.env` candidat, sans cumuler un ancien
  `env_file` par override (les listes Compose peuvent se fusionner).
- Conserver les réseaux, le routage BFF `/api/account/*`, les protections egress,
  l’isolation Chromium et les limites de ressources. Adapter la lecture des
  secrets à l’UID des conteneurs sans les rendre publics.

`docker compose -f <copie-candidate> config --quiet` valide la syntaxe sans
créer de service. Il ne valide ni connexion DB, ni SMTP, ni secrets HOCON.

## 3. Bascule ultérieure — destructrice, à exécuter lors du déploiement

La préparation de cette PR s’arrête avant ces actions. Lire d’abord le
[contrat V27](../reset-v27.md), notamment sa transaction et la reprise d’incident.

1. Consigner le SHA testé, la base exacte, l’opérateur et la fenêtre. Bloquer les
   admissions publiques/connectées puis arrêter **toutes** les anciennes API et
   leurs workers, y compris les instances annexes. Arrêter les anciens collecteurs
   pour abandonner les analyses en vol. Vérifier les redémarrages automatiques.
2. Prendre, si retenu pour secours technique, un snapshot cohérent hors Git.
   Aucun ancien compte, rapport ou autre donnée métier ne doit être réimporté.
3. Installer la configuration et les images candidates dans la fenêtre de
   déploiement. Démarrer une seule API sur la base nommée, avec les accès entrants
   toujours fermés. Son démarrage applique les migrations manquantes puis V27,
   **avant HTTP et scheduler**. Sur une base vierge, la même chaîne fonctionne.
4. Vérifier V27 réussie et les compteurs du [contrat V27](../reset-v27.md).
   Une migration échouée bloque le démarrage : garder la maintenance, diagnostiquer
   et corriger ; aucun `clean`, suppression d’historique ou `repair` automatique.
5. Démarrer les collecteurs/console candidats, ouvrir seulement les accès de recette.
   Vérifier SMTP puis créer et vérifier un nouveau compte opérateur. Toutes les
   anciennes sessions et tous les anciens liens de rapports sont abandonnés.
6. Suivre le [bootstrap du premier ADMIN](../first-admin-runbook.md) avec le vrai
   compte vérifié ; arrêter API/workers pendant la promotion, puis reconnecter.
7. Exécuter les [smoke tests](../commissioning-f13.md), redémarrer l’API et confirmer
   que les comptes/analyses créés après V27 restent présents. Ouvrir le trafic
   seulement après validation. La réactivation des workflows reste une action
   explicite d’exploitation, pas une conséquence de la fusion de cette PR.

Une nouvelle base n’est pas requise. Ne pas modifier les versions historiques
Flyway ni leur checksum. Les mappings QueryDSL restent alignés, V27 ne change
aucune colonne. Les identifiants auto-incrémentés restent à leur position.

## 4. Quotas et contrôles cible

Les valeurs regroupées dans `backend.conf` sont modifiables par configuration :

```hocon
usage.offers.FREE.monthly-limit = 10
usage.offers.PREMIUM.monthly-limit = 1000
```

Un redémarrage planifié de l’API recharge les quotas ; le registre est ensuite
conservé. Le mois reste UTC. Une page publiée consomme un crédit, un lot réserve
un crédit par page, une absence de rapport libère la réservation. `0` bloque,
`null` signifie illimité ; les futurs plafonds individuels priment sur l’offre.
PREMIUM n’accorde ni rôle ADMIN ni paiement.

Les preuves CI ne valident pas les secrets, callbacks Google/GitHub/LinkedIn,
la délivrabilité email, HTTPS, la charge Argon2/Chromium sur le Raspberry ou
le zoom natif/lecteur d’écran. Consigner ces résultats dans la fiche opérateur.
Les fonctionnalités publiques restent utilisables après bascule avec de nouveaux
rapports ; les anciens liens ne sont pas conservés.


## 5. Lancement depuis GitHub Actions

Les quatre workflows `deploy-*` acceptent un lancement manuel
(`workflow_dispatch`) sur `main` uniquement. Les déclenchements automatiques
sur les chemins existants sont conservés. Réactiver un workflow ne rejoue pas
les pushes survenus pendant sa désactivation.

Avant la première bascule Clarté, relever le SHA de `main` dont les six workflows
de validation sont verts. Garder ce SHA identique pendant les quatre lancements
et vérifier le `headSha` de chaque run. Ne pas fusionner d'autres changements
pendant la bascule. Les fichiers actifs sont `/srv/configs/api-backend/prod.conf`
et `/srv/configs/console-web/.env.prod` ; les pipelines ne les remplacent pas.
Une configuration privée incluse dans HOCON doit déjà être montée par le Compose.

Sans utilisateur actif, une page de maintenance n'est pas nécessaire. Arrêter
la console, l'ancienne API et les deux collecteurs avant les lancements pour
abandonner les travaux en cours. Ne pas arrêter MariaDB ni les autres applications
du serveur. Vérifier qu'aucune instance API annexe n'écrit dans la base Argos.

Réactiver et lancer les workflows un par un, en attendant le succès de chacun :

1. `deploy-playwright-service.yml`, puis contrôler l'état healthy du collecteur.
2. `deploy-lighthouse-service.yml`, puis contrôler l'état healthy du collecteur.
3. `deploy-api-backend.yml`, puis vérifier le démarrage, le succès de V27 et les
   compteurs SQL du [contrat de remise à zéro](../reset-v27.md).
4. `deploy-console-web.yml`, puis effectuer les smoke tests et le bootstrap ADMIN.

Exemple pour le premier service, depuis un poste authentifié GitHub :

```sh
gh workflow enable deploy-playwright-service.yml --repo dokor/argos
gh workflow run deploy-playwright-service.yml --ref main --repo dokor/argos
```

Un `up -d --build` réussi ne prouve pas que l'application a terminé son démarrage.
Contrôler chaque service avant de poursuivre ; en cas d'échec, arrêter la séquence
et diagnostiquer. Ne pas relancer un ancien run qui déploierait un ancien SHA.
Le premier démarrage de l'API applique automatiquement la purge V27 ; garder la
console arrêtée jusqu'à sa vérification. Le workflow de console recrée ensuite
le conteneur avec le fichier d'environnement actualisé.
