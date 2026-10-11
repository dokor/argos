# Recette de lecture — #369

## Périmètre automatisé

La commande `node scripts/e2e/report-pdf.mjs --web` construit une version de production contre un backend local fictif. Elle couvre les trois vues de six rapports (complet, partiel, historique, vide, protection anti-bot, scores indisponibles), FR/EN, clair/sombre et 360/768/1024/1440 px. Chaque combinaison vérifie titre principal accessible, absence de débordement, reflow à 200 %, focus clavier, unicité des constats techniques et contraste des textes rendus. Les 288 résultats sont dans web-matrix.json. Les interactions FR/EN couvrent le lien priorité→constat, le focus du détail ouvert, retour/avance et la remise à zéro des filtres.

Les contrôles calculés ne constituent pas une certification WCAG ni une validation avec lecteur d’écran. Les exports PDF sont vérifiés séparément dans pdf-contract.json et pdf-rendering.json : 16 exports, 42 pages, formats synthèse/complet, quatre fixtures FR/EN.

## Recette humaine à obtenir

Aucun retour réel de lecteur commercial ou technique n’a été fourni par l’opérateur au 11 octobre 2026. #369 reste ouvert et la présente recette ne remplace pas ces retours.

1. Lecteur commercial : montrer uniquement la synthèse pendant dix secondes. Demander quel site/périmètre a été mesuré, ce que signifie le verdict, quelle première correction serait décidée et quelles limites empêchent de conclure à une conformité. Recueillir ses mots, temps, hésitations et incompréhensions.
2. Lecteur technique : retrouver une priorité, son constat unique, la source, la confiance et la preuve originale ; expliquer comment vérifier puis répéter la mesure. Refaire avec un rapport partiel et un historique dont des liens manquent.
3. Tester navigation clavier et lecteur d’écran, copie du lien privé, erreur de copie, contact et choix PDF. Vérifier la compréhension du partage par possession du lien.
4. Consigner scénario/fixture/langue/appareil, observation factuelle et correction ; retester après modification. Ne publier aucune citation ou identité sans autorisation.

La clôture exige des retours réels et les corrections issues de cette recette. Les épiques #362 et #373 restent ouverts tant que leurs critères résiduels ne sont pas satisfaits.
