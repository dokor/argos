# Protection des formulaires publics — #667

## Choix et périmètre

Turnstile Managed avec `appearance: interaction-only` et exécution à l'envoi :
pas d'interaction supplémentaire si la vérification suffit, défi possible sinon.
Il fonctionne sans hébergement Cloudflare. Aucun SDK ni dépendance UI ajouté.
Le chargement explicite convient à la navigation Next et aux modals.

| Action serveur | Protection activée |
| --- | --- |
| `POST /api/account/auth/register` | Toujours, action `register` |
| `POST /api/account/auth/forgot` | Toujours, action `forgot` |
| `POST /api/account/auth/resend` | Toujours, action `resend` (API publique historique, aucun formulaire public de renvoi actuellement affiché) |
| `POST /api/audits` | Anonyme, action `audit` ; tous les points d'entrée publics utilisent AuditForm |
| `POST /api/feedback` | Anonyme, action `feedback` ; connecté exempt après vérification de session en DB |
| `POST /api/newsletter/subscribe` | Toujours, action `newsletter` (API existante ; aucun formulaire newsletter monté actuellement) |
| Connexion / OAuth / vérification et reset avec token | Pas de CAPTCHA systématique ; limites de tentatives et preuves existantes conservées |
| Confirmation d'email depuis Mon compte / analyses connectées | Session et CSRF existants, pas de challenge supplémentaire |
| Contact | Liens mail/LinkedIn, aucun endpoint d'envoi Argos |

La connexion adaptative nécessiterait un signal de risque fiable ; aucun signal
n'est inventé dans ce lot. Les futures interfaces de renvoi/newsletter doivent
utiliser `useAntiBot` avec leur action avant d'appeler leur API.

## Frontière et contrat

Le navigateur obtient la configuration publique via `/api/antibot` et transmet la
preuve dans `X-Argos-Captcha`. Les BFF transmettent seulement cette preuve, jamais
un booléen ou un en-tête prétendant qu'elle est validée. Le filtre Java inspecte
l'annotation de la méthode réellement sélectionnée, y compris en accès direct et
avec une autre orthographe de chemin. Une exemption audit/feedback exige une
session valide en base ; un en-tête forgé ne suffit pas.

Le serveur appelle exclusivement l'endpoint officiel Siteverify par HTTPS, sans
redirection, avec délais de connexion/réponse. Il contrôle `success`, l'action,
l'hôte autorisé et `challenge_ts` (moins de 300 secondes, tolérance future 30 s).
L'usage unique/replay est contrôlé par Siteverify, sans retry transparent de la
mutation. Après chaque tentative, le widget et le jeton sont remplacés. Les
timeouts, erreurs, blocages et expirations ne déclenchent aucune mutation.

Les protections SSRF BFF/Java, réponses génériques des emails, rate limiting,
CSRF, quotas et limites de traitement restent actives. Le CAPTCHA n'est pas une
autorisation d'auditer une URL et ne remplace aucune de ces protections.

## Configuration et mise en service

Le mode est **explicitement désactivé par défaut**, pour compatibilité des
installations existantes. Aucun secret n'est déduit ni stocké dans Git. Pour
activer, configurer dans le fichier Java monté (ou variables pour les 3 champs
indiqués) :

```hocon
antibot {
  mode = turnstile # ARGOS_ANTIBOT_MODE
  site-key = "clé publique du widget" # ARGOS_TURNSTILE_SITE_KEY
  secret = "secret Siteverify" # ARGOS_TURNSTILE_SECRET
  hostnames = ["argos.lelouet.fr"]
}
```

Créer un widget Managed, enregistrer les domaines exacts, désactiver le
pré-clearance. Aucune infrastructure proxy Cloudflare n'est requise. Les clés
officielles de test sont refusées pour des hôtes autres que localhost/127.0.0.1.
Le mode activé avec configuration manquante/invalide refuse le démarrage ; une
indisponibilité fournisseur retourne `antibot_unavailable` (503), une preuve
invalide `antibot_invalid` (400). Aucune bascule automatique vers le mode désactivé.

Le BFF récupère le mode depuis Java, sans copie de secret ni clé publique figée au
build. CSP : script-src et frame-src autorisent uniquement
`https://challenges.cloudflare.com` en complément des sources existantes. Le
navigateur contacte exceptionnellement ce fournisseur pour le challenge ; les
API métier restent exclusivement same-origin.

Avant activation en production : relire confidentialité et contrats du
prestataire, qualifier la base légale, les transferts/sous-traitants et l'éventuel
besoin d'adapter la CMP selon la configuration retenue. La notice FR/EN décrit le
traitement technique, sans déclaration de conformité juridique. Aucune activation
en production ni compte fournisseur n'est créé par cette PR.

Rotation : créer/faire tourner le secret chez le fournisseur, mettre à jour le
secret monté et redémarrer Java, puis vérifier configuration publique et envoi
humain avec un jeton neuf. Si le widget change, modifier aussi site-key/domaines.
Ne jamais placer le secret dans une variable NEXT_PUBLIC, des logs ou une capture.

## Mode dégradé, confidentialité et suivi

Sans JS ou avec script bloqué, le formulaire indique un recours via les
informations sur le service. Une panne conserve la saisie et permet une nouvelle
tentative. L'opérateur peut traiter une demande par le contact affiché ; ne pas
proposer de bypass public. Une désactivation d'urgence est une décision explicite
d'exploitation, à tracer, avec les limites anti-abus existantes maintenues.

Le script est chargé seulement à l'envoi. Aucun champ email/password/message/URL,
remoteip ou cData n'est transmis par Argos à Siteverify. Le fournisseur voit
nécessairement le trafic du navigateur et ses signaux techniques. Pas de cookie
de pré-clearance, stockage local ni journalisation des jetons. Les seuls événements
serveur sont `antibot action=<valeur fixe> outcome=accepted|rejected|unavailable`.
Comparer les compteurs par action et les retours d'utilisateurs avant/après ; ne
pas ajouter d'identifiant ou de contenu privé pour mesurer les faux positifs.

Tests : fournisseur simulé pour preuves absentes/invalides, replay, timestamp,
hôte/action, panne ; filtre sur chaque ressource publique et session forgée ;
frontend pour configuration indisponible, script bloqué, expiration et nouveau
jeton. Les tests ne désactivent pas une installation de production. La recette
avec un vrai widget et ses domaines doit être exécutée lors de sa configuration.

Références : [validation serveur](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[configuration widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/),
[CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/),
[tests locaux](https://developers.cloudflare.com/turnstile/troubleshooting/testing/),
[confidentialité Cloudflare](https://www.cloudflare.com/privacypolicy/).
