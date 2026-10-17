# Recette de lecture — #369

## Périmètre automatisé

La commande `node scripts/e2e/report-pdf.mjs --web` construit une version de production contre un backend local fictif. Elle couvre les trois vues de six rapports (complet, partiel, historique, vide, protection anti-bot, scores indisponibles), FR/EN, clair/sombre et 360/768/1024/1440 px. Chaque combinaison vérifie titre principal accessible, absence de débordement, reflow à 200 %, focus clavier, unicité des constats techniques et contraste des textes rendus. Les résultats sont écrits dans outputs/report-validation/web-matrix.json. Les interactions FR/EN couvrent le lien priorité→constat, le focus du détail ouvert, retour/avance et la remise à zéro des filtres.

Les contrôles calculés ne constituent pas une certification WCAG ni une validation avec lecteur d’écran. Les exports PDF sont vérifiés séparément : 24 exports, formats synthèse/complet, quatre fixtures FR/EN et parcours public/propriétaire/partagé. Le nombre de pages dépend du rendu courant.

## Recette humaine à obtenir

Aucun retour réel de lecteur commercial ou technique n’a été fourni par l’opérateur au 11 octobre 2026. #369 reste ouvert et la présente recette ne remplace pas ces retours.

1. Lecteur commercial : montrer uniquement la synthèse pendant dix secondes. Demander quel site/périmètre a été mesuré, ce que signifie le verdict, quelle première correction serait décidée et quelles limites empêchent de conclure à une conformité. Recueillir ses mots, temps, hésitations et incompréhensions.
2. Lecteur technique : retrouver une priorité, son constat unique, la source, la confiance et la preuve originale ; expliquer comment vérifier puis répéter la mesure. Refaire avec un rapport partiel et un historique dont des liens manquent.
3. Tester navigation clavier et lecteur d’écran, copie du lien privé, erreur de copie, contact et choix PDF. Vérifier la compréhension du partage par possession du lien.
4. Consigner scénario/fixture/langue/appareil, observation factuelle et correction ; retester après modification. Ne publier aucune citation ou identité sans autorisation.

La clôture exige des retours réels et les corrections issues de cette recette. Les épiques #362 et #373 restent ouverts tant que leurs critères résiduels ne sont pas satisfaits.

## Reproduire la recette et conserver les sorties

Installer les dépendances console-web et playwright-service, puis Chromium via
`npx playwright install chromium` depuis playwright-service. Depuis la racine,
exécuter séparément (ports 3090/3091 réservés par les fixtures) :

```sh
node scripts/e2e/report-pdf.mjs --web
node scripts/e2e/report-pdf.mjs
python scripts/e2e/check-report-pagination.py
```

Chaque commande compile Next contre un backend local contrôlé. Le mode web
produit captures et matrice sous `outputs/report-validation/` ; le mode PDF
produit PDF, captures et `pdf-contract.json` sous
`outputs/pdf/report-fixtures/`. Les scripts vérifient navigation, accès, formats
et compteurs ; ils ne réalisent pas la revue visuelle humaine.

Pour compléter la vérification PDF, rendre toutes les pages avec Poppler,
inspecter les pages longues/finales, accents, césures et pagination ; extraire
texte et métadonnées avec pypdf pour contrôler l'absence de token/lien privé.
Conserver ce bilan et les rendus avec le SHA dans les artefacts de la PR.
Le contrôle Python nécessite pypdf. La [recette archivée du 15 octobre 2026](../archive/report/integration-644-2026-10-15.md) couvre 24 PDF et 110 pages, avec rendus Poppler et corrections de pagination sur cette révision.
Le relevé historique du 11 octobre comptait 42 pages ; il n'est pas une assertion
de pagination à reproduire. Aucune conformité PDF/UA n'est déduite de ces tests.

## Navigation mobile et méthode du score

La commande `node scripts/e2e/report-navigation-mobile.mjs` vérifie le reflow de
la méthode du score, le fil d'Ariane et le footer connecté en FR/EN, clair/sombre,
avec les largeurs et contrôles définis dans le script. Elle utilise le backend
fictif `scripts/e2e/report-fidelity-fixture.mjs` (port 3018 par défaut), puis Next
construit et démarré avec `API_BASE=http://127.0.0.1:3018` sur le port 3040.
`REPORT_REVIEW_BASE` permet d'indiquer une autre origine locale du frontend.
Les sorties vont sous `outputs/ui-review/issues-668-669-675/`.

La [revue du 16 octobre 2026](../archive/ui/issues-668-669-675-2026-10-16/README.md)
conserve ses captures et ses limites. Le contrôle automatisé ne remplace pas une
écoute avec lecteur d'écran ni un test de zoom natif sur appareil mobile.

## Progression et réussite des modules (#588)

`scores.completeness` reste le pourcentage de collectes entièrement réussies. `scores.moduleExecution`, optionnel pour les rapports historiques, expose les comptes total/completed/partial/failed/skipped/pending/running et terminalPercent. Les états internes PARTIAL, FAILED, UNAVAILABLE, TIMEOUT et SKIPPED terminent la progression sans devenir des réussites. Méthode et limites et les deux formats d’export partagent les mêmes libellés FR/EN. Le cas 6 COMPLETED + 2 erreurs donne 75 % de réussite et 100 % de progression terminale, sans modifier la couverture pondérée.
