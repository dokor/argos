# Règles communes sur les cartes de domaine (#593)

La carte conserve trois indicateurs : pages prioritaires, règles communes, diagnostics complets/pages retenues. Le compteur commun reprend la longueur de `commonFindings` de la synthèse canonique du dernier lot ; il ne fusionne pas les résultats des pages côté navigateur.

La lecture détaillée démarre uniquement pour une carte visible. Les lots en cours sont suivis avec le polling existant ; une synthèse absente, inaccessible ou sans page évaluée affiche « — ». Un vrai zéro mesuré reste un zéro. Une portée partielle est explicitée. Le profil et les versions proviennent de `profileSnapshot`, et l’incomplétude reste affichée en donnée secondaire.

## Vérification reproductible

- `npm test -- --maxWorkers=2`, `npm run lint`, `npm run build` depuis `apps/console-web`.
- Installer les dépendances verrouillées de `apps/playwright-service` et démarrer le build console local.
- Fournir `CONNECTED_BASE_URL` (localhost uniquement), éventuellement `CLARTE_BROWSER_PATH`, puis lancer `node scripts/e2e/domain-common-metric.mjs` depuis la racine.

Le script intercepte les réponses de compte avec des données fictives : il vérifie l’UI et le clavier, pas le backend. Dix variantes couvrent FR/EN, clair/sombre, 1056/390 px, puis 320/768 px. Captures et résultats sont écrits dans `outputs/ui-review/593/`, localement et hors Git.
