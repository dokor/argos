# Accompagnement du périmètre de domaine (#595)

L’étape de périmètre affiche le formulaire et un panneau latéral sur desktop, puis les empile sous 900 px. Le panneau explique l’hôte exact, les sous-domaines exclus, la découverte gratuite dans le respect de robots.txt, puis la sélection et le coût d’un crédit par page. La limite d’URL découvertes ne devient pas un nombre de pages analysables.

La capacité affichée provient du quota réel de session. Un quota à zéro, illimité, en chargement ou indisponible a une présentation distincte ; l’erreur propose de recharger. Le lien vers les quotas reste disponible. Les champs de profondeur, exclusions et leurs validations sont conservés.

## Vérification reproductible

Depuis `apps/console-web` : `npm test -- --maxWorkers=2`, `npm run lint`, `npm run build`.

Après installation des dépendances verrouillées de `apps/playwright-service` et démarrage du build console local : fournir `CONNECTED_BASE_URL`, éventuellement `CLARTE_BROWSER_PATH`, puis lancer `node scripts/e2e/domain-scope-quota.mjs` depuis la racine.

Le test utilise des réponses de compte fictives et refuse les écritures. Dix cas couvrent 1056/390 px en FR/EN clair/sombre, plus 320/768 px, disposition mesurée, profondeur et clavier. Captures et résultats sont locaux dans `outputs/ui-review/595/`, hors Git. Ce test ne valide pas une découverte ou un lot réel.
