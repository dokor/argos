# #673 — Fiches Lighthouse, lot 2

Suite des [quatre pilotes](issue-673-pilots.md), sur `main` à `21af9599`.
Catalogue `report-content-v8`, 18 octobre 2026. Livraison partielle : ne ferme
pas #673 et ne vaut pas une recette humaine. Aucun rapport de production ni
statistique de fréquence n’a été consulté.

## Diagnostic et choix du lot

Le référentiel existant couvrait 27 des 156 candidats configurés dans Lighthouse
13.5.0 par une fiche spécifique. Le reste recevait un repli explicite. Le diagnostic
sur les polices disposait d’un titre traduit mais annonçait encore un impact non
documenté. Le blocage du rendu partageait sa correction avec le code inutilisé,
alors qu’une ressource nécessaire peut bloquer le premier affichage.

Ce lot privilégie quatre problèmes de chargement avec des actions reproductibles.
Cette priorité est éditoriale, pas fondée sur une fréquence de production mesurée.

| Clé `lighthouse.audit.*` | Données de l’outil à rechercher | Lacune corrigée | Contrôle de la correction |
| --- | --- | --- | --- |
| `font-display-insight` | Police et estimation de temps dans le diagnostic source ; origine/référence assainie éventuellement conservée | Repli remplacé par une recherche de `@font-face`, choix de comportement et contrôle de la police de secours | Texte lisible au chargement, retours à la ligne et boutons préservés |
| `image-delivery-insight` | Image, dimensions, taille et motif d’optimisation dans Lighthouse ; ne pas supposer ces champs conservés par Argos | Fiche spécifique sur dimensionnement, compression et fichier réellement sélectionné | Comparer transferts et qualité sur mobile et écran large |
| `cache-insight` | Réponse HTTP, durée de cache, transfert ; le score ne fournit pas une durée à appliquer | Repli remplacé par une stratégie selon contenu public/privé, adresse versionnée/stable et maîtrise du tiers | Seconde visite puis nouvelle version reçue sans vider le cache |
| `render-blocking-insight`, ancien `render-blocking-resources` | Requêtes dans la trace/cascade ; leur nécessité n’est pas établie par le signal | Guide séparé du code inutilisé ; styles essentiels, dépendances JS et `defer` | Premier affichage et parcours sans contenu dégradé ni erreur de script |

Les trois nouvelles fiches portent la couverture à **30/156 candidats**, avec
126 replis documentés. Les deux clés de blocage du rendu avaient déjà un guide.
L’ancien identifiant reste pris en charge sans lui attribuer la méthode exacte
d’un outil actuel. L’inventaire statique des 75 clés reste inchangé.

## Source, portée et preuves

Sources examinées : modules `core/audits/insights/{font-display,image-delivery,
cache,render-blocking}-insight.js` du paquet Lighthouse installé **13.5.0**, et
`LighthouseModuleAnalyzer.buildAuditChecks()` du backend. La sélection Argos
actuelle exige un mode binary/numeric/metricSavings, un score sous 0,9 et une place
parmi les 12 diagnostics prioritaires. Une configuration de candidat ne prouve
donc pas une émission dans un rapport réel.

Les références des fiches ont été consultées pendant cette passe :

- [Polices — Chrome](https://developer.chrome.com/docs/performance/insights/font-display).
- [Images — Chrome](https://developer.chrome.com/docs/performance/insights/image-delivery).
- [Cache HTTP — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).
- [Ressources bloquantes — Chrome](https://developer.chrome.com/docs/performance/insights/render-blocking).

Les fiches restent des méthodes d’investigation. Elles ne reconstruisent ni URL,
ni chemin, ni sélecteur depuis une origine ou une référence masquée. Le ratio
Lighthouse n’est pas une durée. La note sur la méthode historique reste visible ;
aucun seuil, gain ou version d’outil n’est ajouté aux anciennes mesures.

Les exemples de police et de script sont fictifs, explicitement étiquetés et
échappés. Aucune configuration de cache universelle n’est proposée : elle pourrait
exposer du contenu privé ou empêcher une mise à jour. Les exemples d’images et de
cache sont volontairement absents plutôt qu’inventer des dimensions ou une durée.

## Validation et maintenance

`lighthouseGuides.test.tsx` vérifie les cinq clés dans les deux langues : preuves
absentes, score sans unité, prudence malgré une confiance élevée, immutabilité du
constat, exemples inertes et contenu identique entre fiche web et PDF complet.
Un contrôle interdit les clés de playbook dupliquées, qui masqueraient une fiche.

Vérifications réalisées le 18 octobre 2026 :

- 35 tests ciblés réussis (catalogue, inventaires, guides, détails et nouveau lot),
  plus le test Node de génération de l’inventaire Lighthouse.
- Lint des quatre fichiers TypeScript concernés et contrôle éditorial réussis.
- Build de production Next.js avec webpack, TypeScript et génération statique
  réussis. Le premier essai en sandbox ne pouvait pas télécharger les polices ;
  le second a réussi avec l’accès réseau nécessaire.
- Revue du build sur quatre constats fictifs, dont cache sans preuve : fiches et
  sections de correction/vérification dépliées en FR/EN, thèmes clair/sombre,
  vues à 320, 390, 768 et 1440 px. Mesures de débordement à 320, 390 et 1440 px
  sans débordement du document. Accordéon activé par Entrée, focus visible.
  Captures locales : `outputs/ui-review/issue-673-lighthouse/` (non versionnées).
- La cohérence textuelle PDF est testée via le composant d’export complet ; la
  pagination imprimée n’a pas été revue visuellement dans ce lot.

Régénérer puis vérifier l’inventaire après chaque modification :

```sh
node scripts/report-lighthouse-inventory.mjs
node scripts/report-lighthouse-inventory.mjs --check
node scripts/report-rule-inventory.mjs --check
```

La recette de compréhension reste à effectuer selon le protocole du lot 1 :
propriétaire non technique et développeur/prestataire, reformulation du problème,
de la preuve, de l’action et du résultat attendu, retours puis nouvelle lecture.
Le panel multi-domaines, les règles restantes et la collecte manquante restent
ouverts dans #673 ; ce lot ne modifie ni le scoring ni le DTO des preuves.
