# Retour LinkedIn : diagnostic et restitution des refus (#548)

Revue du 13 octobre 2026 sur `main` 822a17e, dans une branche isolée.

## Diagnostic établi

Le mainteneur constate une erreur au retour dans Argos : « La connexion au fournisseur a échoué. Réessayez. ». L'adresse de son compte LinkedIn et son éventuel rattachement à un compte Argos ne sont pas connus.

La PR #509 est déjà fusionnée. Le code actuel utilise l'émetteur du [document de découverte LinkedIn](https://www.linkedin.com/oauth/.well-known/openid-configuration), `https://www.linkedin.com/oauth`, avec signature, audience, expiration et nonce vérifiés. Le symptôme fourni ne justifie pas de relâcher ces contrôles.

Deux pertes d'information sont reproductibles :

- `accountProxy` transforme tout refus du callback en `error=oauth_invalid`, même un `409 use_existing_account` émis après validation du fournisseur.
- `AccountView` affiche le message OAuth générique pour n'importe quelle valeur du paramètre `error`.

`AccountOAuthService.finish` refuse volontairement un login social si une identité externe n'est pas encore liée et que son email correspond à un compte existant. C'est une protection contre la fusion implicite, pas une panne du fournisseur. Ce cas est reproduit avec une réponse backend contrôlée ; **il n'est pas démontré comme cause de la tentative réelle du mainteneur**.

## Correction

Le BFF et l'écran partagent une liste limitée de codes publics. Le message de collision explique en FR/EN qu'un compte utilise déjà l'adresse et invite à se connecter avec la méthode habituelle puis à ouvrir Mon compte pour associer le fournisseur. Les refus de session, confirmation récente, méthode déjà liée, limitation et indisponibilité conservent leurs messages existants. Un code inconnu, une réponse malformée ou une chaîne arbitraire de l'URL ne devient jamais du texte affiché.

La redirection d'erreur conserve la langue et la destination dans un cookie HttpOnly ; elle nettoie les cookies de transaction, même en cas d'indisponibilité réseau. Aucun jeton, email ou texte du fournisseur n'est ajouté à l'URL. Un refus n'installe pas de session ; un 401 continue de supprimer le cookie de session invalide.

Aucun changement du protocole LinkedIn, des sujets d'identité, des sessions Java ni de la liaison explicite des méthodes.

## Vérifications locales

- Les cinq régressions collision (BFF Google/GitHub/LinkedIn et écran FR/EN) échouent sur les sources d'origine, puis passent avec la correction.
- Suite frontend complète : 518 tests / 59 fichiers réussis avant l'ajout du dernier cas de panne HTTP 500 ; contrôle éditorial FR/EN réussi.
- Tests finaux ciblés BFF et AccountView : 121 tests réussis, incluant collision, erreurs publiques, valeurs arbitraires, panne réseau/HTTP, cookie privé, absence de session sur refus et parcours existants de réussite.
- Lint frontend et build production Next/TypeScript réussis.
- Callback du build compilé avec un backend fictif sur loopback : réponse `409 use_existing_account` transformée en 303 vers `/en/account/sign-in?error=use_existing_account`, réponse privée sans cache, destination HttpOnly conservée et aucun cookie de session créé.
- Inspection du build compilé : FR sombre 1280/320 px, FR clair 390 px avec focus clavier visible, EN clair 768 px et sombre 390 px. Message complet, alerte accessible et absence de débordement horizontal. Captures locales dans `outputs/ui-review/linkedin-collision-*.png`, données exclusivement fictives.

## Validation réelle restante

Cette correction n'est pas un déploiement ni un essai avec un compte LinkedIn réel. #548 reste ouverte jusqu'à connexion et reconnexion réelles validées.

Après livraison, relever uniquement le message public affiché, sans copier l'URL de callback, code OAuth, state, nonce, cookie ou jeton. Si le refus indique un compte existant, suivre le parcours de liaison explicite. Si `oauth_invalid` subsiste, vérifier le backend réellement déployé (notamment #509) et analyser le refus côté serveur avec des données assainies avant de modifier les contrôles OIDC.

## Diagnostic opérateur ajouté le 15 octobre 2026

L'opérateur confirme un nouvel échec depuis la page de connexion, après la
connexion chez LinkedIn. Aucun message technique n'est disponible. Cette
instrumentation prépare le diagnostic ; elle ne déclare pas la panne corrigée.

Les logs de `console-web` émettent `account_oauth_callback_rejected` avec
fournisseur autorisé, étape et code public autorisé uniquement :

| Étape BFF | Information à vérifier |
|---|---|
| `invalid_state` | Le callback n'a pas de state au format attendu |
| `missing_browser_cookie` | Le cookie privé de cette transaction manque au retour |
| `backend_response` | Java a refusé le callback ; rapprocher le journal Java |
| `backend_transport` | Le BFF n'a pas pu terminer l'appel à Java |

Le backend émet `account_oauth_rejected` avec un vocabulaire fermé :

| Étape Java | Sens |
|---|---|
| `CALLBACK_CONTEXT` | Code ou contexte navigateur absent/invalide |
| `TRANSACTION` | Transaction absente, expirée, consommée ou mal liée |
| `TOKEN_EXCHANGE` | Échange du code auprès du fournisseur |
| `PROVIDER_PROFILE` | Lecture du profil GitHub |
| `ID_TOKEN_PARSING` | Lecture de l'ID token Google/LinkedIn |
| `ID_TOKEN_VALIDATION` | Validation signature, clés et claims OIDC |
| `IDENTITY_CLAIMS` | Construction de l'identité après validation |

`reason` distingue `HTTP_REJECTED`, `TIMEOUT`, `NETWORK_IO`,
`MALFORMED_RESPONSE`, `OIDC_REJECTED`, les refus de contexte/transaction et
`UNEXPECTED_RESPONSE`. `http_status` est le statut HTTP du fournisseur, ou zéro
s'il n'y en a pas. Un refus OIDC peut encore nécessiter un diagnostic ciblé :
ce journal ne copie pas les claims ni le message de l'exception.

Les logs n'incluent aucun code OAuth, state, nonce, cookie, jeton, email, URL de
callback, corps de réponse ou stack trace. Le fournisseur est ramené à une
liste fixe ; une valeur inconnue devient `unknown`. Le navigateur conserve
ses messages publics actuels et les refus ne créent pas de session.

Après fusion et déploiement explicitement autorisés, faire une nouvelle
tentative puis communiquer seulement l'étape, la raison, le statut et l'heure
de la ligne correspondante via l'interface de logs disponible. Inutile de
demander un relevé shell général ou des journaux bruts. Connexion/reconnexion
réelles restent nécessaires pour clôturer #548.
