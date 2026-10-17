# Recette UI — #668, #669, #675 — 16 octobre 2026

Compte rendu historique et captures de cette revue. Pour les commandes et
comportements actuels, consulter la [recette du rapport](../../../testing/report.md)
et les [conventions d'interface](../../../ux/public-design.md). Les résultats
ci-dessous ne valident pas les modifications ultérieures.

Les données `atelier.example` sont fictives. Aucun service de production n’a été appelé.

- #668 : footer commun connecté compact, cinq destinations conservées et localisées ; contact à droite sur desktop et retour à la ligne sur mobile. Le footer public reste distinct.
- #669 : vrai lien FR/EN vers la liste `/account/sites`, après arrivée directe et rechargement, activation clavier et focus visible. Page courante non cliquable. Absence de fil privé dans les lecteurs public et partagé.
- #675 : à 390 px, le tableau initial mesurait 650 px dans un conteneur de 341 px, avec contenu hors champ. Jusqu’à 800 px, quatre fiches présentent les mêmes données, via titres et couples `dt`/`dd`. Au-delà, le tableau conserve ses en-têtes sémantiques. Valeurs et formule inchangées.

`scripts/e2e/report-navigation-mobile.mjs` vérifie 320, 360, 390, 768 et 1120 px, FR/EN, clair/sombre (20 combinaisons), sans débordement global. À 768 px, il vérifie aussi le reflow de la méthode agrandie à 200 % via CSS `zoom`. La visibilité exclusive tableau/fiches est contrôlée via les rôles accessibles du navigateur. Le test ne remplace pas une écoute avec lecteur d’écran ni un test de zoom natif sur appareil mobile.

Validation : build de production et ESLint ciblé réussis. La suite complète a passé 95 fichiers / 878 tests ; les deux échecs provenaient d’une assertion du nouveau test sur les espaces de la formule. Après correction de cette assertion, les cinq fichiers concernés passent (44 tests). Contrôles éditoriaux FR/EN réussis.

Captures avant/après du calcul, exemple en sombre, footer desktop et fil d’Ariane mobile joints dans ce dossier. Les captures de sections masquent uniquement la navigation publique fixe ; la mesure des débordements et les interactions utilisent la page complète.

Captures conservées : [tableau initial](before-table.png),
[exemple FR mobile](after-example-fr-320-light.png),
[exemple EN mobile sombre](after-example-en-390-dark.png),
[footer desktop sombre](after-footer-en-1120-dark.png) et
[fil d'Ariane mobile sombre](after-breadcrumb-en-320-dark.png).

Reproduction depuis la racine, dans des terminaux distincts :

```powershell
node scripts/e2e/report-fidelity-fixture.mjs
```

```powershell
cd apps/console-web
$env:API_BASE='http://127.0.0.1:3018'
npm run build
npm run start -- --port 3040
```

```powershell
node scripts/e2e/report-navigation-mobile.mjs
```

Installer auparavant les dépendances console-web et playwright-service ainsi que Chromium (`npx playwright install chromium` depuis playwright-service). `REVIEW_BROWSER_CHANNEL=msedge` permet d’utiliser Edge installé ; `PLAYWRIGHT_MODULE` permet de désigner une installation Playwright existante. Les résultats détaillés et toutes les captures sont écrits dans `outputs/ui-review/issues-668-669-675/`.
