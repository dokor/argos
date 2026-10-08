# Agrégation des endpoints SSL (#329)

SslLabsModuleAnalyzer analyse toutes les adresses retournées par SSL Labs.
Chaque contrôle utilise worst-measured-endpoint-v1 :

- FAIL est prioritaire sur WARN, puis PASS.
- À statut égal, le grade le plus mauvais et l'expiration la plus proche sont retenus.
- Les autres égalités sont résolues par une identité d'endpoint stable, jamais par
  la position dans le tableau.
- Un résultat WARN/FAIL réellement mesuré reste visible lorsque d'autres adresses
  sont inconnues. Un PASS n'est publié que lorsque le contrôle est connu pour
  toutes les adresses ; sinon la conclusion est INFO non scoré.

Les checks ne fusionnent pas les caractéristiques de plusieurs serveurs.
selectedEndpoint indique l'adresse de la preuve retenue ; endpoints contient,
pour chaque adresse, son statut, sa valeur et ses propres détails. Les contrôles
de validité et d'expiration du certificat peuvent sélectionner des adresses
différentes : leurs preuves restent séparées. Une adresse absente reçoit un
identifiant déterministe de contenu. Les adresses IPv4 et IPv6 sont incluses.

Les preuves distinguent EVALUATED, NOT_EVALUATED et ASSESSMENT_FAILED.
Un échec de l'évaluation SSL Labs est inconnu pour les contrôles TLS, contrairement
à un grade F ou un protocole obsolète effectivement observé. Dans une réponse hôte
READY, un statusMessage autre que Ready indique l'échec de l'évaluation de
l'endpoint, conformément à la [documentation SSL Labs v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md).

Chaque check expose les nombres d'endpoints attendus et mesurés.
Une mesure scorée partielle conserve l'état MEASURED mais porte la confiance
PARTIAL et la raison SSL_ENDPOINTS_PARTIALLY_MEASURED. Le domaine et le rapport
sont alors provisoires, même si la couverture pondérée des clés dépasse 80 %.
Le panneau existant du rapport public affiche cette qualification.

La couverture passe en weighted-coverage-v3, afin que les comparaisons avec
l'ancien calcul ne produisent pas de delta trompeur. Les rapports historiques
restent figés. Les poids du barème ne changent pas et un même contrôle n'est
compté qu'une fois, indépendamment du nombre d'adresses.