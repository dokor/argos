# Auto-audit après déploiement — #94

Le workflow [`deploy.yml`](../../.github/workflows/deploy.yml) appelle une seule fois
[`post-deploy-audit.yml`](../../.github/workflows/post-deploy-audit.yml) après la
réussite de tous les services sélectionnés et du nettoyage. Ce contrôle concerne les déploiements de `main` dans
`dokor/argos`, y compris leurs relances manuelles. Il n'ajoute aucun cron.
Les PR exécutent uniquement ses tests avec les autres helpers CI.

## Configuration d'exploitation

Créer un compte Argos dédié, vérifié, avec mot de passe et rôle utilisateur
ordinaire. Enregistrer son email et son mot de passe dans les secrets Actions
`ARGOS_CI_EMAIL` et `ARGOS_CI_PASSWORD`. Ce compte n'a besoin d'aucun droit admin.
Attribuer explicitement à ce seul compte l'offre interne `CI`, sans plafond,
via l'administration des comptes, en laissant le plafond individuel vide.
L'offre est déclarée dans `reference.conf` et reste disponible quand
`-Dconfig.file` remplace `application.conf` en production. Un `monthly-limit`
absent ou null sur cette offre signifie réellement illimité ; les offres
FREE/PREMIUM et les autres comptes conservent leur configuration.
Chaque contrôle consomme deux analyses au total, même si le commit déploie les
quatre services. Une relance consomme deux analyses.
Les autorisations serveur, validations SSRF et quotas habituels restent actifs.
Une configuration absente ou un refus de quota échoue explicitement.
Ne pas utiliser un compte personnel. L'offre ne donne aucun droit administrateur
et n'ajoute aucun contournement du contrôle d'admission.

Sur une production antérieure à cette PR, déployer d'abord le backend pour
que `GET /api/account/admin/entitlement-options` présente `CI` avec
`monthlyLimit: null`. Puis modifier uniquement le compte dédié avec
`PATCH /api/account/admin/users/{id}/entitlement` : `offer: "CI"`,
`monthlyLimit: null`, sa version courante dans `expectedVersion`,
`reasonCode: "PLAN_ADJUSTMENT"`, `confirmation: true`. Cette mutation utilise
une session administrateur récente et le CSRF habituels, et est journalisée.
Vérifier ensuite avec la session du compte CI que `GET /api/account/usage`
retourne `offer: "CI"`, `limit: null`, `available: null`, `canLaunch: true`.
Un plafond individuel vide sur FREE rétablit sa limite normale et ne rend
pas le compte illimité. Les secrets Actions existants restent valides.

Le job de contrôle utilise le runner de production `self-hosted`, son accès
Docker existant et Node 24 fourni par `setup-node`. La cible est fixée à
`https://argos.lelouet.fr/`. Le runner doit accéder à cette origine publique.
Le job `tickets`, sur Ubuntu hébergé, reçoit seulement `contents: read` et
`issues: write` avec `GITHUB_TOKEN`, sans les identifiants Argos. Les permissions
du job appelant autorisent cette délégation ; celles du contrôle restent en
lecture. Aucun PAT supplémentaire n'est requis.

## Santé, révision et attente

Le contrôle attend au maximum 120 secondes la disponibilité des quatre
conteneurs et du BFF/backend. Il vérifie ensuite la connexion et lit la
consommation authentifiée, qui traverse Java et la base de données.
Une authentification refusée n'est jamais contournée par un audit anonyme.
Une session ouverte est déconnectée à la fin, au mieux de la disponibilité
du service ; une panne de déconnexion conserve l'expiration normale de session.

Les images sont inspectées par leur ID immuable, jamais par un tag. Le label
`org.opencontainers.image.revision` de chaque service sélectionné doit
égaler le SHA complet du workflow. Les services non sélectionnés peuvent légitimement
porter d'autres SHA : leurs révisions sont enregistrées séparément. Les quatre
conteneurs doivent être démarrés, sans OOM, avec un healthcheck sain s'il existe.
Les IDs, images, révisions, heures de démarrage et compteurs de redémarrage
doivent être identiques avant et après les deux audits. Le groupe de concurrence global empêche un autre déploiement géré par ce
workflow pendant la mesure. Un changement externe invalide le contrôle et
nécessite une relance.
Le label reste une déclaration du build ; voir la
[provenance runtime](../release/runtime-provenance.md).

La connexion suit le flux BFF normal : cookie CSRF, POST login et cookie de
session. Deux POST `/api/account/analyses` utilisent `server-default-v1` et
des UUID déterministes tirés du snapshot de déploiement, du numéro d'échantillon
et de l'identité `run_id:run_attempt` du workflow. Les retries HTTP retrouvent
le run déjà admis si la réponse initiale s'est perdue. Une nouvelle tentative
manuelle du contrôle mesure à nouveau le site : un ancien run échoué ou un
rapport expiré ne bloque donc pas sa reprise. Les tickets restent identiques
à travers ces tentatives grâce à leur marqueur indépendant des runs et du SHA.

Chaque requête a une limite de 10 secondes et une réponse de 2 Mio maximum.
Les GET et admissions idempotentes ont trois tentatives au maximum ; la
connexion n'est pas réessayée après une réponse ambiguë. `Retry-After` est
respecté jusqu'à 30 secondes ; au-delà, le contrôle s'arrête sans réessayer trop
tôt. Chaque run dispose de 240 secondes d'attente, avec polling toutes les deux
secondes. Le job entier est limité à 15 minutes.

## Politique de décision `self-audit-v1`

| Verdict | Condition | Conséquence |
| --- | --- | --- |
| `CONTROL_FAILED` (exit 2) | Auth/quota, santé/révision non vérifiée, timeout, run échoué, module incomplet, couverture insuffisante, anti-bot ou rapports incomparables | Job rouge, preuve filtrée, aucun ticket de défaut du site |
| `SITE_NO_GO` (exit 1) | Au moins un défaut critique mesuré et critique dans les deux audits | Job rouge et synchronisation des tickets |
| `GO` (exit 0) | Aucun défaut critique confirmé, contrôle complet | Job vert ; les défauts importants confirmés créent aussi des tickets |

Les huit modules doivent avoir terminé sans état partiel, sauté ou échoué.
La couverture globale et les quatre domaines doivent atteindre 80 %, sans
statut provisoire. Les empreintes de scoring, de mesure et de périmètre doivent
être présentes et identiques dans les deux rapports. La page demandée et la
destination doivent être exactement la homepage HTTPS, sans masquage. La racine
avec ou sans slash final représente la même page, conformément à la
normalisation Java ; chemin différent, port explicite, query et fragment restent refusés.

Les constats proviennent de **`report.issues`**, pas du top six des priorités.
Seules les clés explicitement revues dans
[`self-audit-policy.mjs`](../../scripts/ci/self-audit-policy.mjs) sont admises,
dans leur domaine prévu, mesurées dans les deux audits, de sévérité importante
ou critique, sans faible confiance. Une confiance `UNKNOWN` n'est pas promue
en `HIGH` : les deux observations mesurées constituent la règle de confirmation.
Un critique vu comme important dans l'autre audit reste important.
Les agrégats Lighthouse/Observatory, erreurs de collecte, durées, erreurs de
tiers et clés inconnues n'ouvrent pas de tickets. Étendre cette liste nécessite
une revue ; un test vérifie son accord avec le catalogue Java.

Le seuil est **absolu**, sans comparaison à une ancienne note : un défaut
critique préexistant bloque aussi. `GO` signifie ce contrôle réussi ; les
variations de faible amplitude et une régression par delta ne sont pas évaluées.
Ce contrôle intervient après la mise en production : il signale le résultat
dans Actions et ne fait ni rollback, ni fusion, ni nouveau déploiement.

## Tickets et confidentialité

Une empreinte de la cible et de la clé canonique identifie le ticket à travers
les déploiements, indépendamment du SHA. Le writer liste toutes les issues
ouvertes et fermées du dépôt, avec pagination bornée, sans dépendre de l'index
de recherche. Il reconnaît uniquement les marqueurs d'issues créées par
`github-actions[bot]`, ignore les PR et échoue si plusieurs tickets possèdent
le même marqueur ou si la pagination est incomplète.

La synchronisation est sérialisée. Une relance identique ne modifie rien ; une
nouvelle observation met à jour le bloc géré du ticket en conservant les notes
humaines autour. Une récidive rouvre le ticket fermé. Aucune clôture automatique
n'est effectuée sur absence d'un constat ou sur contrôle incomplet. Une création
GitHub à réponse ambiguë n'est jamais répétée immédiatement : la relance relit
d'abord les tickets existants. Un refus GitHub rend le job writer rouge.

Les corps sont reconstruits à partir de clés et domaines autorisés, sévérité,
service, SHA et lien Actions. Aucun titre, impact, recommandation, preuve,
extrait HTML, URL issue d'un rapport, identifiant de compte, cookie ou token
de rapport n'est copié. Le writer valide à nouveau la preuve avant toute écriture.
Les rapports complets restent privés dans le compte CI, accessibles à son
opérateur. Aucun rapport brut ni log Docker n'est téléversé.

L'artefact `self-audit-SERVICE-SHA-ATTEMPT` conserve pendant 14 jours le verdict,
sa raison technique fixe, les identités runtime et les seuls constats filtrés.
Son nom est conservé dans les outputs du job de contrôle : une relance du seul
writer reprend cette preuve, tandis qu'un nouveau contrôle publie un nouvel
artefact sans écraser ni relire celui d'une tentative précédente.
Le résumé Actions distingue le verdict et le nombre de constats. Une panne
avant l'écriture de la preuve fait aussi échouer son téléversement.

## Validation et reprise

```sh
node --test scripts/ci/self-audit.test.mjs
```

Les fixtures couvrent le collecteur, les cookies/CSRF, les appels idempotents,
les limites de temps/quota, les identités runtime, les verdicts, la pagination,
les récidives et le filtrage de valeurs sensibles synthétiques. Elles ne
déclenchent ni déploiement, ni audit de production, ni création réelle de tickets.

Après une exécution autorisée, consulter le verdict puis l'artefact filtré.
Corriger la santé/configuration/quota pour un échec technique ; traiter les
tickets confirmés pour un NO-GO. Relancer les jobs du workflow de déploiement
réexécute le déploiement et le contrôle : cela reste une action d'exploitation.
Les secrets et le compte doivent être configurés avant le prochain déploiement.
