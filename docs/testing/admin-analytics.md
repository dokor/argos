# Revue de l’administration et de la mesure produit

Démarrer les fixtures fictives en lecture seule :

```sh
node .agents/skills/argos-visual-review/scripts/preview-backend.mjs
```

Dans `apps/console-web`, fournir `API_BASE=http://127.0.0.1:3018` au build puis au serveur local. Depuis la racine :

```sh
HEADER_BASE_URL=http://127.0.0.1:3000 node scripts/e2e/admin-analytics.mjs
```

Sous PowerShell, définir ces variables avec `$env:API_BASE` et `$env:HEADER_BASE_URL` avant les commandes. Le script refuse les URLs distantes.

Couverture : 320, 390, 768 et 1280 px, FR/EN, clair/sombre ; période, actualisation, titres, absence de débordement de page, liens localisés, refus de rôle après chargement, profils anonymes/USER/PENDING et cookie historique sans droit. Il vérifie aussi l’absence (404 sans redirection) des anciennes adresses FR/EN, les anciennes lectures fermées, l’accueil et un rapport partagé fictif. Les tables défilent dans leur conteneur.

Les réponses de compte et mesures sont fictives. Cette recette ne valide pas les autorisations Java ni la configuration de production ; les tests de session et de service couvrent séparément les contrôles Java. Captures et relevé de parcours sont enregistrés dans `outputs/ui-review/`.
