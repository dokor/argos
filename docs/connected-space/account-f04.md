# F04 — Compte personnel, sécurité et connexions

Implémentation du lot [#554](https://github.com/dokor/argos/issues/554), exigences UI-10, FUN-08 et QA-12. Base : F03, PR #565. La validation OAuth réelle de #548 reste distincte.

## Écran et parcours livrés

- `/account/settings` et `/en/account/settings`, avec `section=profile|security|connections`. Les liens natifs permettent le retour navigateur, le rechargement et le changement de langue dans la même rubrique. `/account` redirige vers les réglages ; aucun second écran personnel n’est maintenu.
- Le retour vers un rapport après vérification email est conservé par une allowlist pure commune au BFF, aux redirections serveur et aux formulaires.
- Profil : nom d’affichage, email en lecture seule, statut vérifié ou demande de vérification. Le résumé latéral et le cadre connecté reçoivent le nom enregistré sans démonter le formulaire ni perdre son message de succès.
- Sécurité : création/changement du mot de passe, retrait protégé, sessions créées et révocation des autres sessions. Les dates sont locales ; aucun appareil ou horodatage de dernière activité n’est inventé. La déconnexion courante reste directement accessible dans le résumé.
- Connexions : associations réellement retournées par le serveur et fournisseurs configurés. Un fournisseur associé devenu indisponible reste visible comme tel ; il ne compte pas comme accès alternatif utilisable. Le retrait du dernier accès est désactivé, et le backend conserve la décision atomique faisant autorité.
- Les actions sensibles ouvrent une confirmation native avec réauthentification par mot de passe ou code email. Un compte OAuth sans mot de passe reçoit directement le parcours email. Annulation, erreur, envoi du code, double soumission, réponse tardive et retour de focus sont traités. Une réauthentification achevée après la fermeture de la vue ne déclenche pas l’action prévue.
- La fermeture exige une confirmation explicite. Le texte décrit l’archivage, la révocation des sessions, le blocage des nouvelles analyses et la conservation des rapports partagés jusqu’à expiration ; il ne promet pas d’effacement physique immédiat.

## Contrats conservés

Le [contrat compte](../accounts/contract.md) reste l’unique système d’identité. Pas de migration, nouvelle table, politique de mot de passe ou jeton supplémentaire. Toutes les mutations passent par le BFF same-origin, ses cookies HttpOnly, son contrôle CSRF et les autorisations Java existantes.

| Action | Route relative à `/api/account` |
|---|---|
| Profil | `GET/PATCH me` |
| Vérification | `POST auth/confirm-email` |
| Catalogue / méthodes | `GET auth/providers`, `GET methods` |
| Identité récente | `POST auth/reauth` : password, code, ou corps vide pour envoyer le code |
| Mot de passe | `POST methods/password` |
| Retrait | `POST methods/{id}/remove`, confirmation explicite |
| Sessions | `GET sessions`, `DELETE sessions/{id}`, `POST sessions/revoke-others` |
| Déconnexion / fermeture | `POST auth/logout`, `POST me/archive` |
| Liaison OAuth | `POST auth/oauth/{provider}/start`, intent=link |

Le BFF admet les destinations settings concrètes et uniquement les trois valeurs de section connues. Le backend OAuth continue à recevoir une destination privée neutre, sans paramètres navigateur ni token de rapport. Le retour HttpOnly conserve la langue et Connexions, en succès comme en échec. Le refus `access_denied`, après passage dans le traitement de callback existant, est présenté par le code public `oauth_cancelled` ; aucun texte brut du fournisseur n’est affiché. Les garanties state, nonce, liaison de session et absence de fusion automatique par email restent inchangées.

Un événement interne `argos-account-profile` actualise le cadre sans masquer les enfants. Les réponses de profil antérieures à une invalidation ne peuvent pas rétablir l’accès affiché.

## Fidélité et écarts explicites

La composition suit les trois rubriques, le panneau principal et le résumé latéral de la référence, dans le shell F02 : rayons 9 px, marges, couleurs, langues, thèmes et footer communs. Les rubriques sont des liens de navigation, plutôt que des onglets ARIA simulés.

Le panneau de consommation existant reste accessible sous Profil, ainsi que par « Offre et quotas », en attendant F05/#555. Sa refonte commerciale n’est pas revendiquée dans ce lot. Le formulaire de mot de passe est directement visible dans Sécurité, puis la confirmation apparaît au moment de l’enregistrement.

## Vérifications et preuves

- Tests de composants : réauthentification avant mutation, compte OAuth seul, code invalide, annulation/focus, confirmation d’archivage, dernier accès utilisable, catalogue partiel, échec de sauvegarde, mutation interrompue au démontage et profil tardif après révocation.
- Tests BFF : destinations settings autorisées/refusées, annulation de liaison FR/EN, nettoyage des cookies de transaction, conservation de la langue, de la session et des codes publics précédemment corrigés.
- `npm run test`, `npm run lint`, `npm run build` dans `apps/console-web`.
- `node scripts/e2e/connected-account.mjs` contre un build local : 320/390/768/1056/1440, FR/EN, clair/sombre ; profil, sécurité, connexions. À 320 et 1440 : confirmations, compte OAuth seul, fournisseur indisponible, email manquant, erreur de lecture, expiration de session et texte 200 %. Clavier, échappement, focus, absence de débordement, axe et footer contrôlés.
- Captures synthétiques et bilan : `outputs/ui-review/clarte-account/`. Artefact CI `connected-account-{sha}`. Les résultats exacts au commit sont consignés dans la PR.
- La recette réelle `apps/console-web/scripts/check-accounts.mjs` est adaptée au nouveau parcours. Elle requiert AccountBrowserFixture + MariaDB ; son adaptation ne signifie pas qu’elle a été exécutée localement.
- `AccountLifecycleIT` conserve les tests SQL d’archivage, dernier accès utilisable, concurrence, révocation, codes à usage unique et OAuth lié à la session. Leur exécution MariaDB en CI est distincte des réponses simulées par la recette visuelle.

Les écrans et callbacks contrôlés ne prouvent ni les applications OAuth réelles ni SMTP en environnement déployé. La connexion/reconnexion LinkedIn de #548 reste à valider par ce ticket ; cette PR ne ferme ni #548, ni l’ensemble de QA-12 automatiquement. Aucun déploiement, effacement de production ou fusion n’est inclus.
