# Configuration et recette des comptes

Le jalon reste désactivé par défaut (`account.enabled=false`). V11 ajoute les tables et la propriété nullable des runs, sans attribuer les données historiques. Appliquer la migration avec la procédure de sauvegarde existante, puis activer les comptes dans la configuration montée de Java. Next et Java doivent recevoir la même origine exacte, sans chemin : `ACCOUNT_ORIGIN=http://localhost:3000` en local et `https://argos.lelouet.fr` en production. `API_BASE` reste exclusivement serveur. Les cookies sont Secure en HTTPS et HttpOnly dans les deux environnements.

Le fichier [application.example.conf](application.example.conf) contient les paramètres, sans secrets. Générer un secret JWT aléatoire d'au moins 64 octets UTF-8, distinct de `ADMIN_API_TOKEN`, conservé dans le gestionnaire de secrets ou la configuration montée. Sa rotation invalide les JWT existants ; aucune période avec deux clés n'est implémentée. Conserver JWT 15 min et cookie BFF 900 s synchronisés ; changer la durée JWT exige aussi d'adapter le cookie et l'intervalle frontend. Idem pour les preuves 24 h et transactions OAuth 10 min. Le renouvellement ne prolonge pas la limite absolue ni l'inactivité métier. La preuve de renouvellement signée (`usage=account-renewal`) expire à l'échéance initiale de la session et reste dans un cookie HttpOnly distinct ; elle ne donne aucun accès métier direct.

Pour obtenir les 24 h prévues, mettre également `account.session-ttl = 24h` et `account.idle-ttl = 24h` dans la configuration montée si elle contient encore les anciennes valeurs 12 h / 30 min. Les limites configurées plus courtes restent appliquées. Une reconnexion crée la nouvelle session de 24 h ; les sessions déjà enregistrées conservent leur échéance. Le BFF conserve le cookie CSRF 24 h. Connexion par mot de passe et callback OAuth émettent la preuve de renouvellement ; un renouvellement avec JWT d'accès encore valide permet aussi de mettre à niveau une session existante. Après un incident réseau, l'interface réessaie au bout de 30 secondes et lors du retour en ligne ou dans l'onglet.

## Accès opérateur Clarté

L’administration du frontend utilise exclusivement une session de compte.
La [matrice et procédure de transition #516](legacy-admin-transition.md)
décrit les consommateurs, le provisionnement ADMIN hors API publique,
la récupération. Suivre le [runbook du premier ADMIN](../connected-space/first-admin-runbook.md) pour une base neuve nommée. La console historique est retirée : prévoir un compte ACTIVE ADMIN et un accès infra indépendant avant de déployer cette version.

## Origine du frontend en production

Le Compose de `console-web` fixe `ACCOUNT_ORIGIN=https://argos.lelouet.fr`, en accord avec son routage Traefik. Le BFF prend cette variable serveur au runtime ; modifier uniquement `account.origin` dans le fichier Java `prod.conf` ne configure pas Next. Hors de ce Compose, définir `ACCOUNT_ORIGIN` dans l'environnement de Next. Sans origine explicite ni `NEXT_PUBLIC_SITE_URL`, le BFF utilise le domaine HTTPS Argos en production et `http://localhost:3000` en développement. Il ne déduit jamais une origine de confiance des headers du navigateur ou du proxy.

Après un changement des variables du frontend, recréer le conteneur (`docker compose -f /srv/apps/console-web/docker-compose.prod.yml up -d --force-recreate console-web`) : un simple `docker restart` ne recharge pas son environnement. Une modification du code nécessite également l'image mise à jour.

Pour diagnostiquer un refus `csrf_invalid` à l'inscription : vérifier l'origine exacte dans Next et Java, puis le cookie de `/api/account/csrf` (HttpOnly, Secure en HTTPS). Un cookie et un jeton concordants ne suffisent pas si l'origine diffère. Le message de confirmation expirée peut donc correspondre à une configuration d'origine incorrecte ; la demande est rejetée avant l'inscription et l'envoi SMTP.

## Email local et SMTP

Les six e-mails de compte FR/EN partagent désormais le modèle Clarté,
en HTML et texte (`multipart/alternative`). Voir l’[inventaire, les aperçus et
la recette](emails.md). Le SMTP OVH est confirmé par l’opérateur le 16 octobre
2026 ; la délivrabilité et les clients mail doivent être vérifiés avec une
boîte de recette après configuration.

Les tests injectent une capture email : ni compte SMTP ni secret réel n'est nécessaire. Pour une recette manuelle, utiliser un SMTP de développement isolé, renseigner host/port/from et ne mettre `account.smtp.require-tls="false"` que sur ce serveur local. En production : SMTP STARTTLS obligatoire, certificat vérifié, identifiants dédiés, adresse d'expédition autorisée et SPF/DKIM/DMARC du domaine à préparer. Vérifier délivrabilité, lien, expiration, renvoi, reset et notifications avec une boîte de test. Ne jamais activer debug SMTP ou journaliser le contenu.

Les liens utilisent un fragment `#token=` retiré après hydratation. Ouvrir le lien par GET ne consomme rien ; le bouton envoie le POST explicite. Un renvoi invalide le lien précédent. Les messages sont enregistrés dans `ARG_ACCOUNT_MAIL_OUTBOX` dans la même transaction que les jetons ou changements de compte. Le scheduler les envoie après commit, sans conserver de connexion SQL pendant SMTP. Une panne SMTP ne remet plus en cause l'opération métier : reprise après 30 secondes, délai exponentiel plafonné à 30 minutes. Une réservation abandonnée est récupérable après 5 minutes. Les jetons expirés, consommés ou remplacés sont écartés avant envoi ; les notifications expirent après 24 heures. Les lignes sont supprimées après acquittement ou expiration. Le worker traite au plus 20 messages par passage, toutes les 2 secondes lorsque les comptes sont activés.

Le destinataire et le contenu (dont les jetons) sont chiffrés par AES-GCM avec une clé dérivée du secret JWT et dédiée par contexte à cette outbox. La rotation du secret rend les messages en attente indéchiffrables : vider la file avant rotation ou demander un nouveau lien ensuite ; les anciennes lignes seront purgées à expiration. Ne jamais journaliser le contenu ni les erreurs SMTP brutes. Pour surveiller la file, consulter uniquement son nombre de lignes, `attempts`, `next_attempt_at` et `expires_at`.

La livraison est au moins une fois : une panne après acceptation SMTP et avant acquittement SQL peut entraîner un doublon. Chaque reprise conserve le même jeton et le même Message-ID, sans garantie de déduplication du destinataire. Les lignes acquittées ne sont plus rejouées et une réservation active empêche les workers concurrents de prendre le même message. Une pause du worker dépassant le bail de 5 minutes peut également produire un doublon.

## Applications sociales

### Liens publics pour Google Auth Platform

Dans **Branding → App domain**, renseigner après fusion et déploiement :

- Page d’accueil : `https://argos.lelouet.fr/`
- Conditions d’utilisation : `https://argos.lelouet.fr/conditions-utilisation`
- Règles de confidentialité : `https://argos.lelouet.fr/confidentialite`

Ces pages doivent répondre sans session ni restriction d’accès. Elles sont liées depuis le footer public et les écrans de connexion/inscription, avec leurs versions anglaises `/en/terms-of-use`, `/en/privacy` et `/en/legal-information`. La page `/informations-legales` présente les faits confirmés sur Antoine Le Louët EI, distincts des CGU ; les compléments juridiques restants sont consignés dans l’[inventaire factuel](../product/privacy-inventory.md). La confidentialité explicite les données d’identité utilisées par Google (`openid email profile`), leur usage, leur conservation et le retrait du moyen de connexion.

Le domaine autorisé est `lelouet.fr`. Vérifier la propriété de ce domaine dans Google Search Console avec un compte associé au projet Google. Conserver le callback OAuth configuré exactement comme indiqué ci-dessous. Consulter les [exigences de marque et de liens publics de Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification). L’ajout de ces pages ne publie pas l’application OAuth et n’active pas les comptes.

### Clients et callbacks

Créer des applications de test distinctes de la production et enregistrer exactement ces callbacks sur l'origine utilisée :

| Fournisseur | Callback | Permissions |
|---|---|---|
| Google | `/api/account/auth/oauth/google/callback` | `openid email profile` |
| GitHub | `/api/account/auth/oauth/github/callback` | `read:user user:email` |
| LinkedIn | `/api/account/auth/oauth/linkedin/callback` | `openid email profile` ; produit Sign In with LinkedIn using OpenID Connect |

Google et LinkedIn utilisent issuer/sub et une signature RS256 validée avec leurs JWKS. Les endpoints sont fixes. GitHub utilise l'ID numérique stable, avec PKCE S256 conformément à sa [documentation OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps). Google documente l'[identité OIDC et le nonce](https://developers.google.com/identity/openid-connect/openid-connect). La [configuration LinkedIn OIDC](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) ne publie pas PKCE : le client confidentiel conserve state, nonce et liaison navigateur, sans inventer un support fournisseur. L'email LinkedIn peut manquer ; une preuve email Argos est alors requise.

Tester chaque fournisseur réellement : connexion, annulation, callback rejoué, mauvaise transaction, collision d'email, adresse absente/non vérifiée, liaison depuis un compte déjà authentifié récemment, retrait, reconnexion et compte archivé. Ne jamais fusionner deux comptes à partir du seul email. Un callback social n'est pas une réauthentification récente ; utiliser le mot de passe existant ou le code email de confirmation pour les opérations sensibles.

### Association et retrait des méthodes (#441)

Mon compte → Connexions utilise les API existantes de méthodes ; Sécurité permet
d'ajouter ou de changer le mot de passe avec la politique commune de 15 à 128
points de code Unicode. L'adresse principale vérifiée reste inchangée lors d'une
association sociale. Une identité externe appartient à un seul compte, même après
son retrait ; aucune fusion ni aucun transfert entre comptes n'est proposé.

La preuve fraîche repose sur le mot de passe existant ou sur un code email à usage
unique, lié au compte et à la session Argos, envoyé uniquement à l'adresse déjà
vérifiée. Google, GitHub et LinkedIn peuvent réutiliser une session fournisseur :
leur callback, même avec un sélecteur de compte, ne renouvelle jamais cette preuve.
La liaison est initiée avec l'intention `link` et un CSRF valide ; son callback
revérifie compte, session, fraîcheur, cookie CSRF, fournisseur, navigateur et état
à usage unique. Une transaction `login` ne peut pas devenir une liaison.

La suppression exige confirmation explicite et preuve fraîche. Le verrou de la
ligne utilisateur sérialise ajout, retrait et connexion avant la lecture des
méthodes. La contrainte unique `(provider, subject)` arbitre les liaisons
concurrentes entre comptes. Le serveur calcule `usable` dans la liste des
méthodes avec la même règle que le retrait : mot de passe présent ou fournisseur
configuré avec identifiant et secret. Une adresse email seule ne compte jamais.
Toutes les associations sont affichées, y compris plusieurs identités chez un
même fournisseur, sans afficher leur subject ou leurs credentials.

Chaque ajout, changement de mot de passe et retrait réussi écrit un événement de
sécurité et envoie une notification à l'adresse vérifiée. Les autres sessions
sont révoquées dans la transaction ; la session courante reste ouverte. Un échec
SMTP annule la mutation, comme pour les autres notifications de compte.

L'émetteur LinkedIn accepté est `https://www.linkedin.com/oauth`, conformément au [document de découverte actuel](https://www.linkedin.com/oauth/.well-known/openid-configuration), dont la valeur diffère de l'exemple de la documentation OIDC. Les clés d'identité déjà enregistrées conservent le préfixe historique `https://www.linkedin.com|` pour éviter de créer de nouveaux comptes lors d'une reconnexion. La signature, l'audience, l'expiration et le nonce restent vérifiés.

Un refus `use_existing_account` après un callback signifie que l'adresse du fournisseur correspond à un compte Argos, sans méthode déjà liée pour cette identité externe. Se connecter avec la méthode habituelle, ouvrir Mon compte, confirmer son identité puis utiliser Associer dans Méthodes de connexion. Ce refus ne doit jamais déclencher une fusion automatique. Le BFF conserve désormais les codes d'erreur publics autorisés jusqu'à l'écran FR/EN ; les autres réponses et détails restent masqués. La destination initiale reste dans un cookie HttpOnly, y compris après un refus. Le diagnostic et les limites de la correction #548 sont dans [le compte rendu LinkedIn du 13 octobre 2026](../archive/accounts/linkedin-callback-2026-10-13.md).

## Reverse proxy et sécurité

Toutes les routes `/api/account/*` passent par Next, jamais par le routage Java public. Traefik conserve sa limite par client TCP. Java conserve des compteurs persistants indépendants par compte, par client et un plafond global par action (`account.rate.<action>.global`, défaut 1000 tentatives par fenêtre de 15 minutes). Les tentatives refusées comptent aussi ; une fois le plafond global atteint, aucune nouvelle clé client/compte n'est créée. `account.rate.<action>.ip` conserve son nom mais utilise l'identité vérifiée ci-dessous lorsqu'elle est disponible. Les compteurs stockent des empreintes, pas les IP ni les emails en clair.

Pour distinguer les clients derrière le BFF, configurer la chaîne de confiance complète avant activation :

1. Générer 32 octets aléatoires encodés en **64 caractères hexadécimaux minuscules**, distincts des secrets JWT/admin. Fournir la même valeur à `ARGOS_ACCOUNT_PROXY_SECRET` pour Next et à `account.proxy-secret` dans le `prod.conf` Java monté (ou via la substitution d'environnement du fichier exemple). Ne jamais utiliser une variable `NEXT_PUBLIC_*`.
2. Charger aussi cette variable pour **l'interpolation Compose** : `docker compose --env-file /srv/configs/console-web/.env.prod -f /srv/apps/console-web/docker-compose.prod.yml …`. Le `env_file` du service seul ne remplit pas les labels. Le Compose injecte la même valeur dans Next et dans le middleware `argos-account-proxy`, qui remplace `X-Argos-Edge-Key` sur les routeurs API, authentification et feedback. Le secret figure donc dans les métadonnées Docker : réserver l'accès Docker/Traefik aux opérateurs et ne pas publier `docker compose config` ou `docker inspect`.
3. Garder Traefik comme entrée publique directe. Il doit **ajouter son client TCP à droite de X-Forwarded-For** (`forwardedHeaders.notAppendXForwardedFor=false`, valeur par défaut). Ne pas modifier ce header après Traefik. Si un CDN/autre proxy précède Traefik, le quota porte sur ce dernier pair ; cette topologie exige une revue spécifique avant de sélectionner un autre hop. Voir les contrats officiels [entrypoints](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/) et [headers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/).
4. Next vérifie le secret d'entrée en temps constant et ne retient que la dernière IP littérale. Il ignore les identités client proposées par le navigateur et émet `X-Argos-Client-IP` et `X-Argos-Client-Proof` : HMAC-SHA256 du message `argos-client-v1\n<secondes Unix>\n<IP>`, clé UTF-8, preuve `<secondes Unix>.<hex>`. Java vérifie la signature et une tolérance d'horloge de 60 secondes, refuse les doublons et normalise IPv6/IPv4 mappée sans DNS. Synchroniser les horloges. Restreindre les liens internes aux réseaux de confiance (TLS si le lien traverse un réseau non fiable).

Sans configuration complète, signature valide ou IP valide, Java utilise toujours son pair TCP : le quota partagé reste actif, sans confiance implicite dans `Forwarded`, `X-Forwarded-For` ou `X-Real-IP`. Une rotation du secret doit mettre à jour les trois composants ; pendant le décalage, ce repli conservateur s'applique. Restreindre l'exposition de Java et supprimer cookies, Authorization, les trois headers internes ci-dessus et query strings OAuth/rapport des logs de proxy et APM. Aucune preuve ni aucun secret ne doit être renvoyé au navigateur.

Recette après configuration, sur des comptes synthétiques : épuiser le quota d'un premier client puis vérifier qu'un second client reste admis ; faire varier les IP sur le même compte et vérifier son 429 ; faire varier comptes et IP jusqu'au plafond global ; vérifier `Retry-After: 900` puis la réouverture à la fenêtre suivante. Répéter avec `X-Forwarded-For`, `X-Argos-Edge-Key`, `X-Argos-Client-IP` et `X-Argos-Client-Proof` falsifiés : ils ne doivent pas permettre de choisir le quota d'une victime.

Les journaux métier de sécurité contiennent seulement action/résultat/date/IDs internes et sont purgés à 90 jours lors de l'écriture suivante. Restreindre leur lecture aux opérateurs habilités. Les empreintes des jetons expirés sont supprimées au prochain envoi du même compte ; les transactions OAuth expirées au prochain démarrage OAuth. Les comptes archivés et leurs références techniques restent conservés. Aucune anonymisation ni restauration n'est annoncée.

Mesurer Argon2id sur l'hôte cible avec la charge et la mémoire disponibles ; minimum 19 MiB, 2 passes, parallélisme 1. Les mesures de tests Windows ne constituent pas un dimensionnement du Raspberry de production. Évaluer la concurrence maximale et le coût des tentatives invalides avant activation.

## Recette avant activation

La [procédure commune](../testing/accounts.md) couvre les tests locaux, les
fixtures MariaDB et les parcours navigateur. Les échanges fournisseurs y sont
simulés. Applications OAuth et SMTP réels, HTTPS déployé, charge Argon2 sur l'hôte
cible et revue indépendante restent à vérifier avant activation.
