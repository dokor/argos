# Sessions et autorisations — recette #444

Cette référence complète le [contrat des comptes](contract.md). Les garanties
ci-dessous sont contrôlées par Java, y compris lors d'un appel direct sans Next.
Le BFF choisit les credentials transmis ; ni un ID de propriétaire, ni un rôle,
ni un cookie d'administration présenté par le navigateur n'accorde de droits.

## Contrat de session

| Paramètre | Valeur et effet |
|---|---|
| JWT | Signer Plume, issuer/audience `argos-account`, usage `account`, `uid`, `sid`, expiration obligatoires pour authentifier une requête |
| Durée du JWT | 15 minutes ; expiration exclusive, aucune dérive tolérée |
| Renouvellement | POST explicite avant expiration, à 10 minutes côté interface ; session courante, origine et CSRF requis |
| Inactivité | 30 minutes depuis la dernière activité métier ; le renouvellement ne la modifie pas |
| Durée absolue | 12 heures depuis la création ; ni activité ni renouvellement ne la prolongent |
| Réauthentification récente | 5 minutes ; un renouvellement n'est pas une preuve récente |
| Chevauchement | Les JWT précédents restent acceptés jusqu'à leur expiration, avec le même registre serveur révocable |
| Fingerprint Plume | Désactivé ; aucun cookie fingerprint n'est attendu. La liaison CSRF au navigateur reste obligatoire |
| Stockage | Cookie `argos_account`, HttpOnly, Path=/, SameSite=Lax, Secure en HTTPS ; aucun JWT dans la réponse JSON du BFF ni en DB |
| Révocation | Compte puis session verrouillés dans la transaction ; déconnexion, reset, révocation et archivage prévalent sur tout JWT signé, même renouvelé en course |

À l'égalité de l'échéance, l'accès est refusé. Un JWT expiré exige une nouvelle
connexion. Les droits et l'état du compte sont relus en DB : les claims ne
transportent aucun rôle ni offre faisant autorité. Une nouvelle authentification
crée une nouvelle session ; les identités et sessions des autres navigateurs
restent distinctes et révocables.

Next extrait uniquement le cookie de compte et construit le Bearer Java ; lors
d'un audit connecté, il utilise le header dédié `X-Argos-Account-Session`.
L'origine configurée et les deux valeurs CSRF sont vérifiées avant transmission.
Java vérifie à nouveau l'origine, le double envoi CSRF et le hash CSRF enregistré
dans la session. Les valeurs malformées, y compris non ASCII, échouent en 403.
Un audit avec une session refusée n'est jamais retenté anonymement.

## Matrice des routes du socle

Les chemins suivants sont préfixés par `/api`. « Vérifié » signifie compte ACTIVE
et session valide ; « propriétaire » porte sur la ressource demandée, jamais sur
`ARG_AUDIT` ou `ARG_DOMAIN`, qui restent partagés. ARCHIVED et SUSPENDED sont
refusés sur toutes les opérations authentifiées, renouvellement compris.

| Routes | Accès et contrôles supplémentaires |
|---|---|
| GET `/account/auth/providers`, GET `/account/csrf` (BFF) | Public, aucune identité accordée ; bootstrap CSRF sans JWT |
| POST `/account/auth/{register,verify,resend,forgot,reset}` | Public, origine + CSRF, preuve email selon l'opération, limitation persistante |
| POST `/account/auth/login` | Credentials fournis + origine + CSRF ; rotation par création de session |
| POST `/account/auth/oauth/{provider}/start` | Login public ; liaison avec session vérifiée et réauthentification récente ; origine + CSRF |
| GET `/account/auth/oauth/{provider}/callback` | Exception de protocole : state à usage unique, cookie de transaction, fournisseur et nonce ; aucune mutation métier libre via GET |
| GET `/account/me` | Session valide, profil minimal également accessible au compte PENDING |
| GET `/account/session` (BFF) | Anonyme : `signedIn:false` ; cookie présent : Java vérifie la session avant toute réponse positive |
| PATCH `/account/me` | Vérifié, origine + CSRF ; seul displayName est modifiable |
| POST `/account/auth/confirm-email` | Session valide, origine + CSRF ; preuve Argos obligatoire avant activation |
| POST `/account/auth/reauth` | Session valide, origine + CSRF ; mot de passe existant ou code email lié à cette session |
| POST `/account/auth/renew` | Session valide, origine + CSRF ; aucun déplacement des limites serveur |
| POST `/account/auth/logout` | Session valide, origine + CSRF ; révocation serveur |
| POST `/account/me/archive` | Session valide, origine + CSRF, confirmation et réauthentification récente ; y compris PENDING |
| GET `/account/sessions`, GET `/account/methods` | Vérifié, ressources du compte courant uniquement |
| DELETE `/account/sessions/{id}`, POST `/account/sessions/revoke-others` | Vérifié, propriétaire, origine + CSRF, réauthentification récente |
| POST `/account/methods/password`, POST `/account/methods/{id}/remove` | Vérifié, propriétaire, origine + CSRF, réauthentification récente ; conserver une méthode utilisable |
| POST `/audits` | Public ; credential utilisateur présenté : session vérifiée obligatoire, origine + CSRF, propriétaire dérivé côté serveur |
| GET `/account/runs`, GET `/account/runs/{id}`, GET `/account/runs/{id}/report` | Vérifié, filtrage propriétaire en SQL avant pagination ; aucun token reconstruit |
| POST `/account/runs/{id}/claim` | Vérifié, origine + CSRF, preuve de rattachement distincte et valide ; attribution atomique |
| GET `/reports/{token}`, GET `/reports/{token}/status` | Capacité publique de lecture limitée au rapport/progrès concerné ; aucun droit de rattachement ni de mutation |
| GET `/audits`, `/audits/runs/{id}`, `/audits/{id}/history`, `/audits/{id}/history/{runId}/comparison`, `/audits/runs/{id}/report` | Accès administratif serveur distinct `ADMIN_API_TOKEN` ; un JWT utilisateur ou cookie admin ne le remplace pas |

Les extensions du socle gardent leurs matrices spécialisées :
[sites](sites-contract.md), [historique et comparaison](history.md),
[usage](usage-contract.md), [administration explicite](administration-contract.md),
[partage des rapports](../security/report-credentials.md) et
[retours utilisateurs](../feedback/contract.md). Les routes privées supplémentaires
de découverte, lots, synthèse et notifications passent également par
`AccountAccess` et les contrôles transactionnels de leur service ; un administrateur
n'obtient aucun accès implicite sur les routes personnelles d'un autre compte.

Les erreurs sont stables : 401 session absente/invalide/expirée/révoquée ; 403 action
interdite, vérification manquante, CSRF ou réauthentification ; 404 identique pour une
ressource absente ou étrangère ; 429 avec Retry-After. Les réponses privées, y
compris les refus, portent `Cache-Control: private, no-store`. Les messages sont
traduits par le frontend existant en FR/EN, sans détails internes.

## Preuves exécutables

| Critère | Suite et scénarios |
|---|---|
| Bornes temporelles et horloge injectable | `AccountSessionSecurityIT` : une milliseconde avant, à et après les échéances JWT/inactivité/absolue ; JWT toujours signé mais registre expiré |
| Renouvellement limité | Même suite : renouvellements sans activité, réauthentification non prolongée, activité métier sans prolongation absolue, quatre onglets simultanés et anciens JWT |
| Courses de révocation | Même suite : émission suspendue sous les verrous MariaDB, puis logout/reset/archive concurrents ; tous les JWT issus avant la transition sont inutilisables après son commit |
| Java direct | `AccountLifecycleIT` : lectures, mutations, création connectée et renouvellement refusés pour JWT expiré, inactivité, durée absolue, révocation ou archivage ; headers d'identité/cookie admin forgés, origine et CSRF incorrects, révocation d'une session étrangère |
| Deux comptes sur la même URL | `AccountLifecycleIT` : statut, rapport, liste, dernier résultat, historique paginé et comparaison restent propres au propriétaire ; le token partagé ne permet pas le rattachement |
| Migration de données existantes | `AccountSecurityMigrationIT` : historique V10 vers V11/V12, anciens propriétaires NULL, affectation indépendante de deux runs d'une URL, FK propriétaire, unicité fournisseur+sujet, index de lecture et rapports conservés |
| Contexte cryptographique | `AccountCryptoTest` et `AccountLifecycleIT` : signature, issuer, audience, usage, expiration, paire uid/sid incorrecte |
| BFF et cookies | `account-session-security.test.ts`, `account-proxy.test.ts`, routes session : headers forgés filtrés, renouvellement HttpOnly/Secure, aucune exposition JSON du JWT, CSRF malformé en 403, absence de repli anonyme |
| Régression administrative | `AccountAdminAccessTest`, `AuditAccessHttpTest`, `AccountLifecycleIT` : rôle courant relu après retrait, aucune autorisation par ancien JWT, cookie admin ou header client |
| Archivage et partage | `AccountLifecycleIT` : accès privé, reset et callback social refusés ; rapports partagés valides maintenus jusqu'à expiration |

Les suites MariaDB sont incluses explicitement dans le workflow
le job `integration` de `ci.yml` ; elles utilisent uniquement les schémas jetables prévus
par [la procédure MariaDB](../testing/mariadb.md). Aucun test de session ne dépend
d'une application OAuth, d'un SMTP réel ou d'un délai mural pour expirer un token.
La recette des fournisseurs réels, des redirects/cookies en HTTPS déployé et le
dimensionnement Argon2 restent décrits dans [operations.md](operations.md) avant
activation. Ces essais d'exploitation ne sont pas présentés comme exécutés par
les tests locaux de cette PR.
