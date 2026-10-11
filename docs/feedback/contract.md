# Retours privés — milestone 11

Le formulaire `/feedback` et `/en/feedback`, accessible depuis le footer, reçoit
les bugs et suggestions sans imposer un compte. Les rapports proposent le même
formulaire ; joindre leur référence est facultatif et décoché par défaut. Un
constat technique propose « Signaler un faux positif » avec explication et
information explicite sur les références transmises. Le rapport de démonstration
ne propose pas de faux positif puisqu’il ne possède aucune référence réelle.

`POST /api/feedback` passe par Next : origine exacte, double jeton CSRF,
liste blanche et limites, cookie de session transmis en Bearer uniquement au
backend. Java revérifie CSRF, validation et session si présente. Les textes sont
du texte brut, rendus par React sans HTML. Description : 4 000 caractères ; attendu,
observé et étapes facultatifs d’un bug : 1 000 chacun ; clé du constat : 200.
Le contexte de page facultatif est une enum PUBLIC/ACCOUNT/REPORT/OTHER : aucun
chemin, URL ou query string n’est récupéré automatiquement. Aucun contact ou
pièce jointe n’est collecté. Un champ piège et des compteurs persistants limitent
les abus ; la confirmation est donnée seulement après `accepted: true`.

Un faux positif doit fournir la clé exacte `ReportDto.Issue.id` d’un rapport
encore accessible. La possession du lien partagé garde sa capacité existante ;
le token est vérifié puis remplacé par `run_id` avant stockage. Pour un rapport
personnel, un ID de run exige une session et le propriétaire correspondant en
base ; l’ID seul ne donne aucun accès. Référence inconnue, d’autrui, expirée ou
clé absente : 404 sans dépôt. Le signalement et son traitement ne modifient
jamais les scores, résultats, preuves ou policies d’audit.

L’administration des comptes relie `/account/admin/feedback` (version anglaise
disponible). GET liste/détail et PATCH statut utilisent `/api/account/admin/feedback`.
Le rôle ACTIVE/ADMIN est relu côté serveur dans chaque transaction, avec la
permission Jersey habituelle. Aucun accès avec le secret legacy du dashboard.
Liste paginée de 1 à 100, curseur ID descendant, filtres type et statut. Les
listes exposent seulement ID, type, statut et dates. Le détail expose les textes,
la clé et un lien admin par ID de run, jamais un lien bearer de rapport.

Statuts : OPEN, PENDING, CONFIRMED, REJECTED, RESOLVED. PATCH exige le statut
attendu ; un statut devenu différent retourne 409. La ligne est verrouillée,
son changement et l’événement (acteur, ancien/nouveau statut, date) sont écrits
dans une transaction. Une panne du journal annule le changement. Un traitement
inchangé ne crée pas d’événement. Le traitement n’envoie pas d’email et n’ouvre
pas d’issue publique. Les réponses applicatives sont `private, no-store`.

V16 ajoute ARG_FEEDBACK et ARG_FEEDBACK_EVENT avec leurs entités QueryDSL.
Pas de token, cookie, IP, URL complète ou capture automatiquement conservé dans
ces tables. Les textes libres restent sous la responsabilité de leur auteur,
avec un avertissement de ne pas inclure de secrets/données personnelles.
Conservation : 90 jours depuis le dépôt ; liste et détail excluent immédiatement
les retours plus anciens, puis le scheduler les supprime chaque heure. La FK
supprime les événements associés ; aucune conservation indépendante du journal.
Les sauvegardes suivent la politique de l’exploitant.

Déploiement : appliquer V16, conserver ACCOUNT_ORIGIN/`account.origin` identiques,
et le BFF sous le routeur console-web-api de priorité 200. Un routeur POST
feedback de priorité 210 ajoute un budget Traefik par pair TCP (moyenne 5/15 min,
burst 3). Les compteurs Java utilisent ARG_ACCOUNT_RATE : par défaut 5/15 min
par navigateur CSRF et 30/15 min par pair TCP, configurables par
`account.rate.feedback.account` et `account.rate.feedback.ip`. Derrière Next,
ce dernier plafond est partagé : le dimensionner pour la topologie, sans faire
confiance aux headers d’IP client. Aucun changement de configuration ou
déploiement réel n’est exécuté par cette PR.
