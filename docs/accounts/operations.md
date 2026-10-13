# Configuration et recette des comptes

Le jalon reste désactivé par défaut (`account.enabled=false`). V11 ajoute les tables et la propriété nullable des runs, sans attribuer les données historiques. Appliquer la migration avec la procédure de sauvegarde existante, puis activer les comptes dans la configuration montée de Java. Next et Java doivent recevoir la même origine exacte, sans chemin : `ACCOUNT_ORIGIN=http://localhost:3000` en local et `https://argos.lelouet.fr` en production. `API_BASE` reste exclusivement serveur. Les cookies sont Secure en HTTPS et HttpOnly dans les deux environnements.

Le fichier [application.example.conf](application.example.conf) contient les paramètres, sans secrets. Générer un secret JWT aléatoire d'au moins 64 octets UTF-8, distinct de `ADMIN_API_TOKEN`, conservé dans le gestionnaire de secrets ou la configuration montée. Sa rotation invalide les JWT existants ; aucune période avec deux clés n'est implémentée. Conserver JWT 15 min et cookie BFF 900 s synchronisés ; changer la durée JWT exige aussi d'adapter le cookie et l'intervalle frontend. Idem pour les preuves 24 h et transactions OAuth 10 min. Le renouvellement ne prolonge pas la limite absolue ni l'inactivité métier. Aucun refresh token longue durée.

## Accès opérateur et transition historique

L’administration du frontend utilise exclusivement une session de compte.
La [matrice et procédure de transition #516](legacy-admin-transition.md)
décrit les consommateurs, le provisionnement ADMIN hors API publique,
la récupération et les conditions de bascule/retour arrière. La console historique est retirée : prévoir un compte ACTIVE ADMIN et un accès infra indépendant avant de déployer cette version.

## Origine du frontend en production

Le Compose de `console-web` fixe `ACCOUNT_ORIGIN=https://argos.lelouet.fr`, en accord avec son routage Traefik. Le BFF prend cette variable serveur au runtime ; modifier uniquement `account.origin` dans le fichier Java `prod.conf` ne configure pas Next. Hors de ce Compose, définir `ACCOUNT_ORIGIN` dans l'environnement de Next. Sans origine explicite ni `NEXT_PUBLIC_SITE_URL`, le BFF utilise le domaine HTTPS Argos en production et `http://localhost:3000` en développement. Il ne déduit jamais une origine de confiance des headers du navigateur ou du proxy.

Après un changement des variables du frontend, recréer le conteneur (`docker compose -f /srv/apps/console-web/docker-compose.prod.yml up -d --force-recreate console-web`) : un simple `docker restart` ne recharge pas son environnement. Une modification du code nécessite également l'image mise à jour.

Pour diagnostiquer un refus `csrf_invalid` à l'inscription : vérifier l'origine exacte dans Next et Java, puis le cookie de `/api/account/csrf` (HttpOnly, Secure en HTTPS). Un cookie et un jeton concordants ne suffisent pas si l'origine diffère. Le message de confirmation expirée peut donc correspondre à une configuration d'origine incorrecte ; la demande est rejetée avant l'inscription et l'envoi SMTP.

## Email local et SMTP

Les tests injectent une capture email : ni compte SMTP ni secret réel n'est nécessaire. Pour une recette manuelle, utiliser un SMTP de développement isolé, renseigner host/port/from et ne mettre `account.smtp.require-tls="false"` que sur ce serveur local. En production : SMTP STARTTLS obligatoire, certificat vérifié, identifiants dédiés, adresse d'expédition autorisée et SPF/DKIM/DMARC du domaine à préparer. Vérifier délivrabilité, lien, expiration, renvoi, reset et notifications avec une boîte de test. Ne jamais activer debug SMTP ou journaliser le contenu.

Les liens utilisent un fragment `#token=` retiré après hydratation. Ouvrir le lien par GET ne consomme rien ; le bouton envoie le POST explicite. Un renvoi invalide le lien précédent. Un échec SMTP annule la transaction métier ; la livraison et le commit DB ne forment pas une transaction distribuée. Une livraison suivie d'un échec de commit peut produire un lien inutilisable : renvoyer depuis l'écran, sans réutiliser le jeton. Un mécanisme outbox pourra traiter ce cas ultérieurement.

## Applications sociales

### Liens publics pour Google Auth Platform

Dans **Branding → App domain**, renseigner après fusion et déploiement :

- Page d’accueil : `https://argos.lelouet.fr/`
- Conditions d’utilisation : `https://argos.lelouet.fr/conditions-utilisation`
- Règles de confidentialité : `https://argos.lelouet.fr/confidentialite`

Ces pages françaises doivent répondre sans session ni restriction d’accès. Elles sont liées depuis le footer public et les écrans de connexion/inscription ; en anglais, les libellés indiquent la langue française. La page `/informations-legales` reste une présentation de l’opérateur, distincte des CGU. La confidentialité explicite les données d’identité utilisées par Google (`openid email profile`), leur usage, leur conservation et le retrait du moyen de connexion.

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

L'émetteur LinkedIn accepté est `https://www.linkedin.com/oauth`, conformément au [document de découverte actuel](https://www.linkedin.com/oauth/.well-known/openid-configuration), dont la valeur diffère de l'exemple de la documentation OIDC. Les clés d'identité déjà enregistrées conservent le préfixe historique `https://www.linkedin.com|` pour éviter de créer de nouveaux comptes lors d'une reconnexion. La signature, l'audience, l'expiration et le nonce restent vérifiés.

Un refus `use_existing_account` après un callback signifie que l'adresse du fournisseur correspond à un compte Argos, sans méthode déjà liée pour cette identité externe. Se connecter avec la méthode habituelle, ouvrir Mon compte, confirmer son identité puis utiliser Associer dans Méthodes de connexion. Ce refus ne doit jamais déclencher une fusion automatique. Le BFF conserve désormais les codes d'erreur publics autorisés jusqu'à l'écran FR/EN ; les autres réponses et détails restent masqués. La destination initiale reste dans un cookie HttpOnly, y compris après un refus. Le diagnostic et les limites de la correction #548 sont dans [linkedin-callback-validation.md](linkedin-callback-validation.md).

## Reverse proxy et sécurité

Toutes les routes `/api/account/*` passent par Next, jamais par le routage Java public. Les labels Compose ajoutent une limite au bord pour l'authentification. Java utilise l'adresse de son pair TCP, sans accepter les headers d'IP envoyés par le navigateur : derrière Next, son budget IP devient donc un plafond partagé, conservateur. Dimensionner `account.rate.<action>.ip` pour cette topologie tout en conservant les budgets par compte et la limite par client à Traefik. Une provenance proxy de bout en bout serait un chantier explicite, pas une activation de X-Forwarded-For arbitraire. Restreindre l'exposition de Java et supprimer cookies, Authorization et query strings OAuth/rapport des logs de proxy et APM.

Les journaux métier de sécurité contiennent seulement action/résultat/date/IDs internes et sont purgés à 90 jours lors de l'écriture suivante. Restreindre leur lecture aux opérateurs habilités. Les empreintes des jetons expirés sont supprimées au prochain envoi du même compte ; les transactions OAuth expirées au prochain démarrage OAuth. Les comptes archivés et leurs références techniques restent conservés. Aucune anonymisation ni restauration n'est annoncée.

Mesurer Argon2id sur l'hôte cible avec la charge et la mémoire disponibles ; minimum 19 MiB, 2 passes, parallélisme 1. Les mesures de tests Windows ne constituent pas un dimensionnement du Raspberry de production. Évaluer la concurrence maximale et le coût des tentatives invalides avant activation.

## Recette avant activation

La [procédure commune](../testing/accounts.md) couvre les tests locaux, les
fixtures MariaDB et les parcours navigateur. Les échanges fournisseurs y sont
simulés. Applications OAuth et SMTP réels, HTTPS déployé, charge Argon2 sur l'hôte
cible et revue indépendante restent à vérifier avant activation.
