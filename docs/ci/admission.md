# API d’admission CI v1 — #463

Contrat en aperçu, **premium-ci.enabled=false jusqu’à #467**. Ce lot suit
#748 (#735), #747 (#462) et #746 (#734). Il ne fusionne, ne déploie et
n’active aucun accès client. [OpenAPI 3.1](openapi-v1.json) est la référence
machine ; la publication de la documentation développeur en ligne reste #742.

## Authentification et routes

Préfixe `/api/ci/v1`. Chaque appel, lectures comprises, exige
`Authorization: Bearer <clé API CI>`. Le BFF transmet cette seule identité
machine : aucun cookie de session, secret admin, token de rapport, header
d’identité ou de mesure n’est substitué. Java relit la clé et le compte
courants, sans cache ; un refus ne devient jamais un audit anonyme.

| Méthode et chemin | Scope | Résultat |
| --- | --- | --- |
| POST `/analyses` | audits:write | 201 pour une nouvelle intention ; 200 pour une intention identique déjà admise |
| GET `/admissions/by-key/{key}` | results:read | Retrouver l’intention d’origine après une réponse perdue |
| GET `/admissions/{id}` | results:read | Intention et ses un ou deux résumés de runs |
| GET `/admissions/{id}/verdict` | results:read | Verdict confirmé de l’intention, sans nouveau run ni débit |
| GET `/policies/standard-v1` | results:read | Paramètres et empreinte de la politique avant admission |
| GET `/runs/{id}` | results:read | Statut/dates/échantillon ; failureCode contrôlé RUN_FAILED si échec |
| GET `/runs/{id}/report` | results:read | Synthèse numérique privée summary-v1 publiée et non expirée |
| GET `/usage` | usage:read | Consommation de cette intégration stable, sans chiffres des autres clients |
| GET `/preflight` | usage:read | Droit courant, scopes, preuves déclarées et consommation, sans admission |
| GET `/identity` | clé valide | Identité et portée déclarée ; aucune garantie d’éligibilité |

Les paramètres de query sont rejetés. Le seul corps d’admission autorisé est :

```json
{"url":"https://example.com","samples":2,"profileId":"standard-v1"}
```

Le profil complet est fixé côté serveur, sans désactivation de module/TLS/SSRF,
credential de cible ou budget fourni par le client. L’URL doit être HTTPS, publique,
sur une origine vérifiée exacte de la clé. Pas de query, fragment, identifiant,
IP ou port alternatif. Les chemins sont permis ; ne soumettre aucune URL qui
contient un secret dans son chemin. Les ressources tierces et redirections gardent
les contrôles de #734 et l’egress obligatoire. La double mesure réserve deux
analyses ensemble, exécutées en séquence ; le [contrat de verdict #466](verdicts.md)
exige deux mesures comparables. Une mesure seule reste exploratoire.

## Une intention durable, sans double réservation

Le client génère une UUID canonique une seule fois pour l’intention, la conserve
et l’envoie dans `Idempotency-Key`. Il ne la remplace pas après un timeout, une
rotation de clé, un redémarrage du job ou une publication GitHub/GitLab échouée.
L’UUID n’est pas un credential ; elle ne donne aucun accès sans la clé/scopes.

V44 persiste l’intention par intégration stable, l’empreinte de son contenu
canonique versionné et celle de sa clé d’idempotence, le profil et la portée
serveur. L’ordre des champs JSON et la forme canonique équivalente d’une URL
ne créent pas une intention différente. Même clé/contenu : mêmes runs, aucun
nouveau débit/réservation. Contenu différent : IDEMPOTENCY_CONFLICT (409).
Une autre intégration possède un namespace distinct et ne peut lire ces runs,
même si elle appartient au même compte ou audite exactement la même URL.

Ces métadonnées restent avec le registre existant ; aucune expiration automatique
de l’idempotence ne relance silencieusement un ancien audit. Elles ne contiennent
ni secret machine, corps HTML, console brute, token public ou corps de requête.
Les identités d’URL du moteur restent partagées ; les relations privées ne le sont pas.

Une première transaction contrôle clé, droit et preuves puis recherche une intention
existante. Le DNS, borné par DiscoveryTransport et une deadline de quatre secondes,
est hors transaction. Une seconde transaction recontrôle clé, droit et preuves,
relit l’idempotence, puis crée intention, runs privés et réservations ensemble.
Une révocation/downgrade pendant le DNS ferme cette seconde barrière. Les identités
de domaine/URL nouvellement créées sont annulées avec un refus de quota/capacité.
Une collision avec une création historique concurrente renvoie une disponibilité
temporaire contrôlée ; reprendre la même intention. Aucun appel cible HTTP n’a lieu
dans l’admission ; le worker répète la validation réseau sous egress.

Après une réponse ambiguë, commencer par GET `/admissions/by-key/{key}`. Si elle
n’est pas encore visible, réutiliser le même POST et la même UUID dans son budget
de reprise. Un GET 404 n’est pas une permission de fabriquer une autre intention.
La sérialisation par compte et l’unicité en base empêchent deux admissions de la
même intention. Les droits/scopes/propriété sont relus avant toute restitution.

## Lectures après downgrade et précontrôle

Une clé toujours valide avec le scope requis peut lire/retrouver ses admissions
après downgrade ou perte de ci_access, et rejouer le POST de cette même intention.
Un nouveau lancement reste refusé. Compte inaccessible et clé expirée/révoquée
restent un 401 uniforme. Cette exception ne crée ni ne réactive aucun credential.

La portée de navigation initiale doit rester incluse dans celle de la clé de lecture.
Restreindre un emplacement lors de son remplacement peut donc masquer ses anciennes
admissions plus larges ; aucune autre clé/intégration ne récupère leurs résultats.
La validité d’une preuve n’est pas réexigée pour lire le passé ; elle l’est pour tout
nouvel audit. Un nouvel epoch de preuve n’élargit pas une ancienne clé.

Le preflight consulte les états existants sans DNS, contrôle réseau de domaine,
renouvellement de challenge, réservation ou débit d’analyse. Les budgets de trafic
et métadonnées normales d’authentification restent appliqués. newAccessAllowed
reflète le droit commercial courant ; vérifier aussi scopes, authorizedForKey et
disponibilité mensuelle. Aucune lecture ne réserve une capacité future.

## Confidentialité minimale nécessaire avant l’admission

Tout run CI porte sa liste d’origines serveur dès son insertion ; sa présence est
le marqueur immuable de confidentialité. Il ne retourne aucun token ou lien public.
Les lecteurs génériques de rapport et le polling par token le refusent même avec
un token valide ; le partage historique ne peut en créer de lien. Les lecteurs de
runs personnels et d’historique/comparaison admin génériques excluent ces runs.
Le BFF/SSR historique passe par ces mêmes barrières. Les accès de supervision
opérateur existants restent distincts de l’API machine et ne lui accordent aucun scope.

Le rapport API est volontairement summary-v1 : score disponible ou null, version,
compteurs numériques ou null, complétude et dates. Il ne charge ni report_json ni
result_json. Il ne publie pas de titre, URL, preuve, HTML, console, cookie, header,
lien porteur de token ou texte de cible. Une mesure absente reste null. Ce contrat
ne produit aucun verdict GO et ne remplace pas les exports détaillés sécurisés #736.
La recette complète des artefacts, logs, rétention et tickets reste dans #736/#737/#467.

## Erreurs, budgets et récupération

Toutes les réponses sont privées/no-store, y compris les erreurs. Le schéma #741
s’applique à Java et au BFF : message/action issus du catalogue, requestId opaque,
aucun corps upstream/exception brute. Le BFF lit au plus 64 Kio de succès et 4 Kio
d’erreur ; son entrée de 8 Kio expire après cinq secondes et le transport après quinze.
Le filtre Java borne aussi les corps chunked. Voir les [budgets de #735](quotas.md).

- AUTHENTICATION_FAILED : vérifier la variable secrète et le cycle de vie dans le
  compte ; le serveur ne dit pas si une clé tierce existe.
- QUOTA_EXCEEDED / RATE_LIMITED / CAPACITY_UNAVAILABLE : respecter l’échéance ou
  Retry-After et le budget global du job. Ne pas tourner les clés pour contourner.
- TRANSPORT_FAILED / UPSTREAM_UNAVAILABLE / INTERNAL_ERROR : récupérer l’intention
  initiale ; un requestId sert à corréler une requête et n’ouvre aucun log.
- FAILED est terminal et porte RUN_FAILED ; CANCELED est terminal aussi. Ni polling
  sans fin ni nouvelle analyse automatique. Un rapport absent/en cours/expiré/hors
  portée donne RESOURCE_NOT_AVAILABLE ; consulter d’abord le statut autorisé du run.
- Un code, format, champ ou type de réponse inconnu est refusé comme échec de
  transport, sans exécuter ou recopier le contenu reçu dans la CI.

Les publications optionnelles GitHub/GitLab restent indépendantes. Leur échec ne
réadmet pas une analyse. Les clés Git ne passent jamais par l’API Argos.

## Validation et ouverture

CiAdmissionIT exerce deux comptes/intégrations, courses de la même intention,
rotation/downgrade, révocation pendant DNS, rollback après refus, contenus upstream
hostiles, publication/expiration, HTTP réel et refus des tokens historiques connus.
Les tests BFF vérifient en-têtes, scopes de données, sorties bornées et deadline.
Les tests de contrat relient OpenAPI aux DTO et au schéma d’erreur canonique.
La preuve réseau d’admission est simulée dans ces fixtures ; les contrôles d’egress
réels restent dans les fixtures d’isolation. Aucun résultat de production, abonnement
réel ou test de charge n’est revendiqué. Les maquettes UI, documentation en ligne,
client et recette complète restent les lots dépendants avant ouverture. Les exports privés structurés sont décrits dans [le contrat #736](private-exports.md).
