# Recette Clarté — issues #593 à #598

Comparaison du build local avec les captures de la maquette dans
[`reference/screenshots`](../../reference/screenshots), le 15 octobre 2026.
Le fragment archivé correspond à la maquette `argos-clarte-synthese-domaines.html`
fournie pour la comparaison. Les captures ci-dessous utilisent uniquement des
données fictives `atelier.example`, sans identifiants de connexion ni données de production.

## Changements et preuves

| Issue | Résultat vérifié | Capture |
| --- | --- | --- |
| #593 | Trois indicateurs : priorités, règles communes de la synthèse serveur, couverture. L’incomplétude reste secondaire ; une synthèse absente n’affiche pas zéro problème. | [Desktop](domains-1056.png), [320 px, EN sombre](domains-en-dark-320.png) |
| #594 | Trois URL récentes distinctes, préremplissage sans lancement, historique propre à chaque URL. | [Desktop](known-urls-1056.png), [390 px, EN sombre](analysis-en-dark-390.png) |
| #595 | Formulaire et panneau de périmètre/quota sur deux colonnes ; empilement mobile. Champs nombre/profondeur alignés, hauteur 44 px. | [Desktop](domain-new-1056.png), [390 px](domain-new-en-dark-390.png), [768 px](domain-new-en-dark-768.png), [desktop sombre](domain-new-en-dark-1056.png) |
| #596 | Bandeau de consommation indépendant sous le profil, offre et disponibilité réelles. L’adresse de connexion reste en lecture seule. | [Desktop](account-1056.png), [390 px](account-en-dark-390.png) |
| #597 | Mois lisible, liens par URL et identifiants techniques repliés. Limites non exposées explicitement indisponibles. | [Journal desktop](usage-ledger-1056.png), [journal mobile](usage-en-dark-390.png) |
| #598 | Pictogrammes SVG, identité cliquable, aide persistante sur desktop et accessible dans le menu mobile, footer hiérarchisé et retour au site. | [Desktop](integrations-1056.png), [menu 320 px](menu-en-dark-320.png) |

## Parcours exécutés

- Les six pages en français clair à 1056 et 390 px ; leurs contenus modifiés en anglais sombre à 390 px. Contrôles complémentaires à 320 px pour les domaines/menu, et 768 px pour le formulaire de domaine.
- Préremplissage réel de `https://atelier.example/collections`, sans déclencher d’analyse ; ouverture de son historique et vérification de l’URL correspondante.
- Ouverture du compte depuis l’identité ; liens quota et retour au site localisés.
- Menu mobile ouvert, fermeture par Échap, retour du focus au bouton Menu ; détails d’intégration ouverts au clavier, focus visible dans le journal et le footer.
- Mesures DOM sans débordement horizontal du document aux tailles contrôlées ; le tableau du journal conserve son défilement interne accessible. Extraits dans [checks.json](checks.json).
- Aucun crédit utilisé, aucune découverte, modification de profil ou analyse soumise en production. Les états indisponibles, vides et en cours sont également couverts par les tests de composants.

Les captures sont des vues du viewport, parfois après défilement pour montrer le
panneau concerné. Elles ne prétendent pas couvrir toute la page en une image.
La vérification porte sur l’UI et ses lectures privées avec fixtures, pas sur les
autorisations de production ni une certification WCAG.

## Données et coût des lectures

La liste des domaines reste une lecture légère. Une synthèse existante est chargée
à l’apparition de sa carte dans le viewport ; son tableau canonique `commonFindings`
fournit le nombre de règles sans recalcul de scoring. Le hook existant gère
l’annulation, les erreurs, la visibilité et le polling des lots actifs. Cela ajoute
une lecture de synthèse par carte visible (pas de modification du contrat serveur).

L’API de quota n’expose actuellement ni les pages autorisées par lot ni le nombre
de lots simultanés. L’interface ne reproduit donc pas les valeurs fictives 50/1 de
la maquette. Le formulaire conserve ses validations existantes et la confirmation
du coût à partir de la sélection.

## Reproduire

Depuis la racine du dépôt, PowerShell :

```powershell
$env:ARGOS_PREVIEW_PORT='3038'
node .agents/skills/argos-visual-review/scripts/preview-backend.mjs
```

Dans un autre terminal, depuis `apps/console-web` :

```powershell
$env:API_BASE='http://127.0.0.1:3038'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3039
```

Le serveur de fixtures écoute uniquement sur loopback et refuse toute écriture.
Ouvrir `/account/domains`, `/account/analyses/new`, `/account/domains/new`,
`/account/settings`, `/account/usage`, `/account/integrations` et leurs variantes `/en`.
