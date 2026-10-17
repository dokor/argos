# Navigation Analyses et Domaines — issue #660

Le shell connecté partage un composant `NavigationGroup` : le libellé parent
navigue vers l’accueil de la section et le bouton adjacent déplie ses liens.
La navigation conserve l’ordre de tabulation natif des liens et boutons.

| Entrée | Destination FR | Destination EN |
| --- | --- | --- |
| Analyses / Historique des analyses | `/account/sites` | `/en/account/sites` |
| Nouvelle analyse | `/account/analyses/new` | `/en/account/analyses/new` |
| Domaines / Mes domaines | `/account/domains` | `/en/account/domains` |
| Analyser un domaine | `/account/domains/new` | `/en/account/domains/new` |

L’historique réutilise la liste des sites suivis, puis leurs URL et le lien vers
`/account/urls/{id}/history`. Cette issue n’ajoute pas de nouvel historique.

## États et accessibilité

- L’arrivée directe ou le rafraîchissement ouvre le groupe de la route active.
- Un repli manuel est conservé sur la page courante. Une nouvelle route dans
  cette section rouvre le groupe ; les autres groupes conservent leur état.
- Cet état appartient au shell React partagé, sans stockage persistant.
- Le groupe actif utilise la couleur de marque ; le lien courant reçoit en plus
  un fond et `aria-current="page"`. Une page de détail marque son point d’entrée
  par `aria-current="location"`. Si le groupe actif est replié, son parent
  porte ce dernier repère.
- Chaque bouton expose `aria-expanded` et `aria-controls`. Les listes repliées
  sont masquées avec `hidden`, y compris pour la navigation clavier.
- La barre réduite conserve des boutons indépendants de 44 px et des icônes
  pour les sous-liens. Les infobulles apparaissent au focus ou au survol et
  peuvent être masquées avec Échap ; elles ne sont pas nécessaires à l’ouverture.
- Sur mobile, le menu reste dans le flux de la page. Les sous-liens ferment
  le menu après navigation ; Échap restaure le focus sur le bouton Menu.

## Recette reproductible

Depuis `apps/console-web`, lancer les tests concernés :

```powershell
npm exec vitest run src/components/connected/AccountShell.dom.test.tsx src/components/connected/AccountMenu.dom.test.tsx src/components/connected/ClarteNavigation.dom.test.tsx
```

Lancer le frontend local sur le port choisi. Le script intercepte les appels
du compte avec les fixtures existantes ; aucun backend n’est nécessaire pour
cette recette. Depuis la racine du dépôt :

```powershell
$env:CONNECTED_BASE_URL='http://127.0.0.1:3020'
node scripts/e2e/navigation-submenus.mjs
```

Le script couvre les largeurs 320, 390, 768 et 1440 px, FR/EN et les deux thèmes,
avec une identité fictive administrateur ou non. Il vérifie les quatre liens,
les parents, Entrée/Espace/Tab/Échap, le repli manuel, les changements de route,
le rafraîchissement, les cibles de 44 px et les débordements. Les captures et
résultats axe sont enregistrés dans `outputs/ui-review/navigation-submenus/`.
La recette fait également partie du groupe `public` de la CI de revue visuelle.
Ces données fictives ne démontrent pas les autorisations du backend de production
et les contrôles automatisés ne valent pas une certification d’accessibilité.
