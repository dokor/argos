# Reprendre une URL récente (#594)

La nouvelle analyse utilise les tentatives récentes de la vue serveur du compte pour afficher jusqu’à trois URL distinctes. « Utiliser cette URL » conserve l’URL exacte dans le paramètre de préremplissage et ne crée aucune analyse. Le formulaire existant garde son profil serveur réel et son enregistrement automatique.

Le raccourci « Historique des URL » mène au bloc des URL récentes ; chaque ligne donne accès à son propre historique. Le chargement, l’absence d’URL et une erreur avec nouvelle tentative ont des états séparés.

## Vérification

Depuis `apps/console-web` : `npm test -- --maxWorkers=2`, `npm run lint`, `npm run build`.

Après installation des dépendances verrouillées de `apps/playwright-service` et démarrage du build console local : fournir `CONNECTED_BASE_URL`, éventuellement `CLARTE_BROWSER_PATH`, puis lancer `node scripts/e2e/known-analysis-urls.mjs` depuis la racine.

Les réponses de compte sont fictives et interceptées par le test. Dix cas vérifient FR/EN, clair/sombre, 1056/390 px, puis 320/768 px, les liens d’historique et le préremplissage au clavier sans soumission. Les captures et résultats sont locaux dans `outputs/ui-review/594/`, hors Git. Ce test ne valide pas le backend réel.
