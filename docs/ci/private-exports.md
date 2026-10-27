# Rapports CI privés et exports structurés

Contrat de #736, dépendant de [l’admission](admission.md) et du
[contrat d’erreur #741](errors.md). API en préversion : `premium-ci.enabled=false`
reste obligatoire jusqu’à la recette complète #467. Ce lot ne fusionne et ne
déploie aucun changement. La documentation publique en ligne appartient à #742.

## Accès et chemins de lecture

Chaque appel CI exige une clé machine active, un compte ACTIVE, la portée requise,
la même intégration stable que l’admission et toutes les origines déclarées dans
cette admission. Une rotation conserve cet accès ; une clé de remplacement dont
la portée de cibles est plus étroite ne récupère pas les anciens résultats plus
larges. Les droits sont relus en base à chaque requête, sans confiance dans des
en-têtes propriétaire, cookies ou identifiants fournis par le client.

Les lectures historiques restent possibles après la fin du droit commercial tant
que la clé reste valide et la fonction ouverte. L’expiration d’une preuve de
domaine n’efface pas un résultat historique ; elle interdit les nouvelles admissions.
La désactivation globale ferme aussi les lectures machine.

Le marqueur CI est posé avant l’insertion du run. Même un ancien token connu
valide ou un partage historique ne donne accès ni au rapport public, ni à sa
progression, ni aux lecteurs génériques du compte ou de l’administration. Les
historiques, dernières analyses, contexte par token et introductions excluent ces
runs. Le lecteur par token commun les exclut aussi pour le feedback et l’analytics.
Les compteurs de facturation gardent leurs crédits, sans exposer la cible CI dans
les ventilations de consommation. La supervision ADMIN conserve seulement les
métadonnées opérationnelles habituelles (identifiant, compte, domaine, état,
dates) ; elle ne fournit ni export ni chemin privé de cible.

| Appel | Portées | Résultat |
| --- | --- | --- |
| GET `/api/ci/v1/runs/{id}/report` | results:read | Synthèse numérique summary-v1 |
| GET `/api/ci/v1/runs/{id}/export` | results:read | Export JSON details-v1, 64 Kio maximum |
| DELETE `/api/ci/v1/runs/{id}/report` | audits:write et results:read | Suppression idempotente d’un résultat terminal |

Les réponses, erreurs comprises, sont privées `no-store`, `nosniff`,
`no-referrer`, `Vary: Authorization` et non indexables. Le BFF reconstruit les
réponses autorisées, impose une échéance et une taille, refuse les champs inconnus
et vérifie l’identité du run. Il génère lui-même le nom du téléchargement JSON.
Il ne transmet ni cookie ni en-tête d’identité, analytics, cache ou redirection.

## Contenu de details-v1

L’[OpenAPI](openapi-v1.json) décrit les champs stricts et leurs bornes :

- summary : synthèse numérique publiée et dates, sans titre ou URL de cible ;
- reportPath : chemin relatif vers la lecture API authentifiée, sans token ;
- details : au plus quatre scores de catégorie, 256 états de contrôle et
  128 constats dédupliqués, identifiés par les clés exactes du catalogue v1 ;
- omittedFindings : nombre de constats non représentés, notamment les contrôles
  dynamiques non approuvés. Une valeur positive interdit de conclure que l’export
  contient tous les constats ; consommer le [verdict serveur #466](verdicts.md),
  sans reconstruire un GO depuis cet export ;
- artifactPolicy : export privé, dépôt d’artefact volontaire, plafond de sept jours
  pour ces artefacts et d’un jour pour les diagnostics contrôlés ;
- publicIssue : titre et texte fixes utilisables dans un dépôt public.

Les catégories sont dérivées du catalogue versionné, jamais d’un texte de cible.
Les valeurs absentes restent absentes ou nulles ; aucune preuve n’est reconstituée
à partir d’un compteur. Les clés dynamiques Lighthouse/ZAP absentes du catalogue
sont comptées dans omittedFindings. Aucun format HTML, Markdown, PDF ou SARIF
n’est accepté par cet endpoint en v1.

La projection dédiée est construite à la publication atomique, bornée à 48 Kio
en base, puis validée de nouveau à la lecture. Un snapshot absent, invalide ou
trop gros n’entraîne jamais une relecture de report_json ou result_json.
Pour les runs CI, ces colonnes ne conservent pas les diagnostics bruts :
report_json vaut {}, result_json est NULL, le diagnostic textuel, le titre et le
logo sont absents. Les enrichissements optionnels de synthèse IA et de notation
de domaine sont désactivés pour ces publications, ainsi que la projection des
problèmes vers les statistiques produit.

Cookies, en-têtes d’authentification, HTML, console, sélecteurs, chemins de cible,
query, liens à token, textes de preuve et de recommandation, images et contenu IA
ne font pas partie du DTO. Les mentions, séquences ANSI, commandes workflow,
liens externes et instructions injectées sont éliminés à cette frontière.
Les clients doivent utiliser les clés connues et des modèles maîtrisés, sans
interpréter du texte reçu comme du shell, une expression CI ou une instruction.

## Contrat des futures publications GitHub/GitLab

La publication reste optionnelle et désactivée par défaut (#738 et clients dédiés).
Un dépôt public reçoit seulement publicIssue : aucun score, domaine, URL, clé
de constat, sévérité, preuve, compte ou identifiant de corrélation. Ce message
générique invite à ouvrir Argos sous authentification. Il ne crée aucun partage.

Une publication de constats exige une destination dont la confidentialité est
vérifiée auprès du fournisseur ET un consentement explicite configuré. En cas
d’incertitude, changement de visibilité ou permission insuffisante, refuser la
publication détaillée ; ne jamais basculer silencieusement vers un dépôt public.
Le contrôle doit être refait juste avant chaque écriture. Le client ne transmet
pas les credentials Git à Argos. Une panne de publication ne relance pas l’audit.
Un futur lien vers l’interface devra rester authentifié ; reportPath est déjà
une route authentifiée, pas un lien public porteur de droits.

## Rétention et suppression

- Serveur : plafond de 30 jours après publication, configurable entre 1 et 30 via
  premium-ci.report-retention-days. La lecture applique le délai même pour un
  expires_at ancien absent ou trop long. La purge horaire efface le rapport, sa
  projection et les payloads terminaux, sans toucher à l’intention ni au registre
  comptable. Les métadonnées d’admission/URL nécessaires à l’idempotence restent
  internes ; une suppression ne donne jamais de nouveaux crédits.
- Diagnostics des runs terminaux : nettoyage après 24 heures, y compris FAILED et
  CANCELED sans rapport. Un run QUEUED/RUNNING n’est jamais purgé ainsi.
- Suppression immédiate autorisée : DELETE efface rapport et diagnostics du run
  terminal dans une transaction. Un run en cours répond RESOURCE_NOT_AVAILABLE ;
  lire son état avant de réessayer. Les compteurs et l’identifiant de l’intention
  restent conservés ; réémettre le POST initial récupère la même intention.
- Artefacts côté client : aucune mise en ligne automatique par cet endpoint.
  Les futurs clients doivent appliquer un opt-in, une destination privée vérifiée,
  une durée maximale de sept jours et la suppression à l’échéance ou à la demande.
  Un artefact déjà téléchargé est une copie : DELETE côté Argos ne le révoque pas.
  Les backups restent soumis à leur rotation et à la procédure de restauration ;
  ce lot ne prétend pas effacer une copie externe ou une ancienne sauvegarde.

## Erreurs, journaux et recette

Utiliser uniquement les codes/actions du contrat #741. AUTHENTICATION_FAILED ne
révèle pas l’existence d’une clé ; PERMISSION_DENIED indique une portée manquante ;
RESOURCE_NOT_AVAILABLE couvre autre intégration, cible hors portée, résultat non
publié, supprimé ou expiré. Consulter d’abord le statut autorisé du run.
Une projection corrompue donne INTERNAL_ERROR, sans message d’exception.
Un corps upstream inconnu ou trop gros donne TRANSPORT_FAILED dans le BFF.
Un requestId UUID corrèle une erreur ; il ne donne aucun droit de lecture.

Les handlers et le BFF ne journalisent pas les credentials ou les corps ; les
collecteurs utilisent des origines réduites et des erreurs contrôlées. Les sorties
CI de diagnostic doivent rester sous liste blanche, même avec verbose : pas de
curl -v, set -x, dump d’environnement, stack upstream, impression du DTO privé
dans stdout/stderr ou résumé Actions. Le futur client publie seulement des
messages reconstruits et des compteurs explicitement autorisés.

La configuration globale de Traefik/APM n’est pas dans ce dépôt. Avant ouverture,
#467 doit contrôler l’environnement réellement déployé : absence de capture
d’Authorization, cookies, corps ou query dans access logs, traces et analytics,
absence de capture des routes CI, exclusion des artefacts détaillés des résumés
publics, rétention et purge des exports chez le fournisseur. Ne pas activer la
fonction si ces contrôles ne sont pas démontrés.

Validation du dépôt : fixtures MariaDB avec vraie publication/HTTP, matrice
propriétaire/autre compte/intégration/portée/anonyme/token connu, expiration et
suppression, contenu synthétique hostile et vérification du stockage ; tests
BFF de schéma strict, contenu, cache et bornes ; tests de parité des catalogues.
La CI complète et le scanner de secrets sont rattachés au SHA dans la PR. Aucun
contrôle de production ou publication réelle de ticket n’est revendiqué ici.
