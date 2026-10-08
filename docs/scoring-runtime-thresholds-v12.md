# Méthodologie V12 : seuils réseau runtime monotones (#327)

Les mesures connues de nombre de requêtes et de transfert estimé contribuent
désormais au domaine performance des deux côtés de leur seuil :

| Check | PASS (ratio 1) | WARN (ratio 0,5) | Poids constant |
| --- | --- | --- | --- |
| runtime.network.request_count | ≤ 120 requêtes | > 120 requêtes | 4 |
| runtime.network.bytes_estimated | ≤ 3 000 000 octets | > 3 000 000 octets | 4 |

Le dénominateur ne varie pas lorsqu'une mesure traverse le seuil. Un dépassement
fait perdre 2 points acquis par check, quelle que soit la qualité initiale de
la page. Corriger ce dépassement fait gagner ces mêmes points. Le barème est
discret : les variations à l'intérieur d'un palier gardent la même note.

Avec la fixture de l'issue (11 erreurs console first-party, 1 erreur JS,
1 requête échouée et 1 réponse 5xx), la performance passe de 13/31
(41,935/100) au seuil à 9/31 (29,032/100) lorsque les deux seuils sont dépassés.
En V11, elle passait incorrectement de 5/23 (21,739/100) à 9/31.

Les PASS n'émettent aucune action. Les WARN conservent leurs recommandations ;
leur gain modélisé est 100 × 2 / dénominateur du domaine, puis pondéré par le
poids effectif de la performance dans le global. Leur couverture reste MEASURED
de part et d'autre du seuil. Une mesure absente reste inconnue et n'émet pas
de PASS : le comportement des réponses runtime partielles est conservé.

La version de scoring devient 12, ce qui change aussi l'empreinte déterministe
du catalogue. Les rapports déjà publiés et leurs calculs figés ne sont pas
recalculés. Une comparaison V11/V12 retourne METHODOLOGY_CHANGED sans delta ;
les audits V12 de couverture et périmètre identiques restent comparables.