# Verdict CI et confirmation v1 — #466

API en préversion. **premium-ci.enabled=false jusqu’à la recette complète #467.**
Ce lot suit #751 ; le client portable #465 et les publishers #738–#740 restent
distincts. Aucun déploiement ni publication Git réelle n’est déclenché ici.

## Politique annoncée et figée

GET `/api/ci/v1/policies/standard-v1` exige une clé API et `results:read`.
Il annonce la politique `premium-ci-verdict-v1`, son empreinte SHA-256, le profil,
le nombre de mesures, les seuils de couverture, les versions compatibles, le
catalogue des contrôles éligibles aux tickets et la liste d’exceptions, vide.
Le manifeste versionné est partagé et vérifié par Java, le BFF et le contrat du
futur client. Une modification sémantique demande une nouvelle version.

La politique est figée avec l’intention, avant l’insertion des runs. À la
publication atomique, une projection privée séparée conserve seulement les
empreintes de scoring, mesure et périmètre, le score observé, les identités de
constats et un éventuel code d’indisponibilité. Aucun HTML, titre, preuve, URL,
cookie ou diagnostic brut n’y entre. Les rapports historiques sans ce snapshot
ne sont jamais recalculés ni complétés depuis les anciens payloads.

## Deux analyses et leurs limites

Le parcours de confirmation soumet `samples:2` avec `profileId:standard-v1`.
Les deux analyses sont annoncées, réservées ensemble puis exécutées en séquence
par le registre existant. Chaque rapport produit consomme une analyse, même
partiel ; un échec sans rapport libère sa réservation. Un défaut confirmé ne
rembourse pas les mesures, et une discordance ne crée aucune troisième analyse.
Les lectures du verdict ne réservent rien et ne relancent rien. Une reprise de
l’intention réutilise l’UUID d’idempotence, y compris après rotation de clé.

`samples:1` reste une observation exploratoire autorisée par l’admission. Elle
ne donne jamais de GO confirmé : `CONFIRMATION_REQUIRED`. L’API n’ajoute pas un
second run. Choisir ensuite une nouvelle intention de deux analyses est une
décision explicite, dont le coût est annoncé ; aucun retry ne la prend à la
place du client. Il n’existe pas de variante supprimant TLS, SSRF, module,
contrôle de provenance ou confirmation.

## Conditions du verdict

GET `/api/ci/v1/admissions/{id}/verdict` exige `results:read`, la même intégration
stable et l’ensemble des origines de l’intention. Les droits sont relus ; ni
cookie, token de rapport, identifiant propriétaire ou autre intégration ne les
remplace. Une rotation garde les lectures autorisées ; une portée réduite,
révocation ou expiration conserve les refus habituels. Aucun identifiant de
référence historique ni paire de runs arbitraire n’est accepté.

Le verdict exige les deux publications disponibles, les huit modules terminés
sans échec/partiel/skip, l’absence explicite d’anti-bot et un score disponible.
La couverture `weighted-coverage-v3` doit atteindre 80 % globalement et dans
chacun des quatre domaines, avec ses indicateurs de suffisance et sans score
provisoire. Tous les contrôles attendus doivent figurer dans l’inventaire de
couverture. Une confiance de mesure inconnue ou partielle n’est pas mesurée.
Une confiance LOW sur un constat important/critique interdit de conclure.
La confiance éditoriale UNKNOWN n’est pas une preuve ; la confirmation repose
sur les états de mesure MEASURED et les deux observations comparables.

Les versions de scoring et de méthode doivent être supportées ; leurs empreintes
et celle du périmètre doivent être présentes et identiques. Elles identifient
les paramètres appliqués et les URL demandée/finale, sans révéler ces URL. Elles
ne prouvent ni un SHA déployé, ni un contenu figé, ni un environnement statistique
reproductible. Les exceptions propres au contrôle interne Argos ne sont pas
activées : notamment aucun passe-droit pour l’ancienne lacune d’octets runtime.

L’inventaire vient de `report.issues`, jamais des six priorités. Les constats
doivent avoir une clé exacte du catalogue et une mesure correspondante. Une clé
non représentée, un doublon contradictoire ou une collecte inconnue empêche GO.
Les mêmes critiques/importants, avec la même sévérité, doivent apparaître dans
les deux mesures ; une présence ou sévérité discordante est non confirmée.

| Résultat | Code d’audit | Sens |
| --- | --- | --- |
| GO | 0 | Mesures suffisantes et comparables, aucun critique confirmé |
| SITE_NO_GO | 1 | Au moins un critique confirmé sur les deux mesures |
| CONTROL_FAILED | 2 | Impossible de conclure ; aucun ticket de défaut autorisé |

Le seuil absolu initial est **un critique confirmé**. Les importants confirmés
restent visibles et peuvent être éligibles aux tickets, sans bloquer ce profil.
Les clés éligibles sont relues dans la politique ; les scores agrégés seuls
(Lighthouse, SSL grade, Observatory) ne deviennent pas des tickets. Une baisse
de score, même importante, ne constitue pas une régression prouvée : réseau,
caches et fournisseurs varient. Aucun delta ni comparaison historique n’est
proposé ici. Une mesure à zéro reste une mesure, une valeur absente reste absente.

## Erreurs explicites et publication indépendante

Une lecture HTTP 200 peut porter CONTROL_FAILED : le transport a fonctionné,
mais le contrôle du site n’a pas permis de conclure. Le champ error reprend les
codes, étapes et actions du catalogue #741. Les refus d’authentification, de
propriété et de transport restent des erreurs HTTP contrôlées. Toutes les
réponses sont privées/no-store, bornées, sans texte de cible.

| Code | Action sûre |
| --- | --- |
| WAIT_TIMEOUT | Runs encore en cours : reprendre la lecture dans le budget global |
| RUN_FAILED | Run terminal échoué/annulé : consulter son état, aucune relance implicite |
| COLLECTION_TIMEOUT | Délai de collecte dépassé ; consulter les mesures existantes |
| ANTIBOT_DETECTED | Vérifier les restrictions de la cible en conservant TLS et SSRF |
| MEASUREMENT_INCOMPLETE | Consulter les états de contrôle privés et la couverture requise |
| REPORTS_INCOMPARABLE | Méthode ou périmètre différent ; aucun delta ni confirmation |
| VERDICT_POLICY_UNSUPPORTED | Profil/méthode incompatible ou intention historique sans politique figée |
| CONFIRMATION_REQUIRED | Mesure unique exploratoire, sans ajout automatique de run |
| FINDINGS_UNCONFIRMED | Constats discordants ; aucune publication de défaut ni troisième mesure automatique |
| RESOURCE_NOT_AVAILABLE | Résultat manquant, expiré ou supprimé ; pas de repli vers un lien public |

Le verdict ne reçoit aucun statut de publisher et ne peut être réécrit par lui.
Le contrat pur `pipelineResult` destiné à #465 conserve auditOutcome et
auditExitCode. Une publication activée échouée ou indéterminée donne le code de
processus 3 ; un CONTROL_FAILED conserve 2. Désactivée, aperçu, aucun constat,
plafond atteint ou succès conservent le code d’audit. Le publisher reste opt-in
et reprend ses seules mutations ; il ne redébite ni ne réadmet une analyse.

La suppression ou l’expiration d’un des deux rapports invalide toute nouvelle
lecture du verdict. Les snapshots sont supprimés avec le rapport sous le même
plafond de trente jours. L’intention, sa politique et le registre comptable
restent internes pour l’idempotence ; ils ne permettent pas de recréer un résultat.

Les fixtures couvrent les états nominaux et négatifs, les frontières BFF/Java,
la publication atomique, l’accès intercomptes/intégrations et le coût inchangé.
Les clients réels, les dépôts fournisseurs, les textes d’aide en ligne #742 et
la topologie déployée restent à recetter avant #467.
