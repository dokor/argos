# Essai de CSS Cleaner sur Argos

Le 2 novembre 2026, la CLI a été exécutée sur les sources de `apps/console-web`
depuis une archive installée dans un consommateur propre. Le rapport est partiel,
avec des candidats de nettoyage exploitables et des limites de parsing identifiées.

## Versions et périmètre

| Élément | Référence |
| --- | --- |
| Argos audité | `2f2d20214ddf838a7d2e6cd30837d85aaad988d4` |
| CSS Cleaner | `0.1.0`, commit `92756cbe23d39503504ff9c5c87f91da5655eb6d` |
| Exécution | Node.js `24.22.1`, archive construite avec pnpm `11.25.0` |
| Archive testée | SHA-256 `761fa01f2f56760b61857894e96a3d67a65eef21fd72c2dce8d1d6ec06d8d56f` |
| Sources JS/JSX/TS/TSX | 411 fichiers |
| Styles | 96 SCSS Modules, 3 SCSS globaux, 1 CSS global |
| Définitions | 2 714 occurrences, 1 065 identités de classe distinctes |
| Usages extraits | 1 531 statiques, 22 dynamiques |

La configuration [css-cleaner.config.json](../../apps/console-web/css-cleaner.config.json)
limite l’analyse à `src/`, écarte les tests et déclare l’alias `@/*` de `tsconfig.json`.
Les styles Sass à indentation n’apparaissent pas dans ce périmètre réel.

## Rapport observé

| Diagnostic | Occurrences | Confiance élevée | Confiance faible |
| --- | --- | --- | --- |
| Classes probablement inutilisées | 154 | 47 | 107 |
| Classes utilisées introuvables | 46 | 0 | 46 |
| Usages dynamiques | 22 | 0 | 22 |
| Avertissements d’analyse | 173 | 0 | 173 |

Les 154 diagnostics d’inutilisation correspondent à 88 identités distinctes.
Les 47 occurrences de confiance élevée correspondent à 18 identités, réparties
entre `PrivateDiagnostic.module.scss` et `PrintableReport.module.scss`.
Les comptes portent sur les emplacements signalés et peuvent donc répéter une classe.

Les avertissements comprennent 171 constructions Sass non évaluées, principalement
`@use` et `@include`, et deux fichiers rejetés par le parseur. Les 46 références
introuvables comprennent 30 occurrences issues de ces deux fichiers et sept classes
`ge-*` définies dans une chaîne CSS de `global-error.tsx`. Cette chaîne intégrée au
composant sort du périmètre actuel des fichiers CSS/SCSS analysés.

## Vérifications manuelles

| Cas | Constat et suite proposée |
| --- | --- |
| `PrivateDiagnostic.module.scss` | Le composant utilise seulement `s.secondary`. Les 17 autres identités signalées sont des candidates à examiner lors d’un nettoyage ciblé. Les sélecteurs groupés et les règles responsive doivent être relus ensemble. |
| `PrintableReport` et `.evidence` | Le composant utilise `className="evidence"`, tandis que le style définit une classe locale de module dans `.document .evidence`. Le rapprochement met en évidence une incohérence de portée. Un correctif candidat consiste à utiliser `className={s.evidence}` après validation du rendu imprimé. |
| `global-error.tsx` | Les sept classes `ge-*` sont présentes dans sa chaîne CSS interne. Les diagnostics de faible confiance nécessitent une revue contextualisée. |
| Autres références de faible confiance | Les noms `hero`, `eyebrow`, `scoreBlock`, `summary`, `criticalVerdict`, `verdict` et `limit` restent à examiner dans leurs modules et composants respectifs. |

Les fichiers vérifiés sont [PrivateDiagnostic](../../apps/console-web/src/components/account/PrivateDiagnostic.tsx),
[PrintableReport](../../apps/console-web/src/components/report/PrintableReport.tsx),
[son module](../../apps/console-web/src/components/report/PrintableReport.module.scss)
et [global-error](../../apps/console-web/src/app/global-error.tsx).

## Défaut de parsing reproduit

`EasterEggs.module.scss` et `AuditProgressView.module.scss` compilent avec Dart Sass
`1.107.1`, mais CSS Cleaner les rejette au niveau des étapes en pourcentage de leurs
animations. Le cas minimal suivant compile et provoque le même rejet de l’analyseur.

```scss
.visible { animation: pulse 1s; }
@keyframes pulse {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
```

La couverture du module devient `unreadable` et ses définitions disparaissent du
rapprochement. Le correctif est suivi dans [CSS Cleaner #21](https://github.com/dokor/css-cleaner/issues/21).

## Contrôles effectués

- Installation de l’archive avec les seules dépendances d’exécution et les scripts
  d’installation désactivés, puis exécution de la CLI installée.
- Deux rapports JSON identiques à données identiques.
- Sorties terminal, JSON et Markdown, dont écriture Markdown dans un fichier.
- Mode CI à code `0` sur l’état initial. La politique actuelle déclenche le code `1`
  uniquement pour une classe manquante de confiance élevée et conserve les
  avertissements dans un rapport partiel.
- Ajout temporaire de sondes dans une copie isolée du frontend. Une classe manquante
  déclenche le code `1`, une classe réellement inutilisée est signalée à confiance
  élevée, les branches conditionnelles et les lectures indirectes sont conservées,
  les motifs dynamiques proposent les deux variantes attendues et `composes` réduit
  la confiance de sa portée.
- Retrait des sondes, puis égalité exacte avec le JSON initial.
- Compilation Sass réussie des deux fichiers rejetés par l’analyseur.

La validation réalisée couvre l’audit statique et la compilation Sass de ces deux
modules. Le build Next.js et la validation visuelle d’éventuelles corrections de
styles restent à réaliser. Cette PR livre la configuration ainsi que les
observations du pilote.

## Rejouer l’audit

Ces commandes POSIX supposent Node.js 24 et pnpm 11.25.0. Depuis la racine d’Argos,
préparer un répertoire temporaire et construire la version évaluée.

```sh
ARGOS_ROOT="$PWD"
AUDIT_DIR="$(mktemp -d)"
git clone https://github.com/dokor/css-cleaner.git "$AUDIT_DIR/css-cleaner"
git -C "$AUDIT_DIR/css-cleaner" checkout 92756cbe23d39503504ff9c5c87f91da5655eb6d
cd "$AUDIT_DIR/css-cleaner"
pnpm install --frozen-lockfile
pnpm pack --pack-destination "$AUDIT_DIR"
mkdir "$AUDIT_DIR/consumer"
cd "$AUDIT_DIR/consumer"
printf '{"private":true}\n' > package.json
npm install --omit=dev --ignore-scripts --no-audit --no-fund "$AUDIT_DIR/css-cleaner-0.1.0.tgz"
node node_modules/css-cleaner/dist/cli/index.js scan "$ARGOS_ROOT/apps/console-web" --format json --output "$AUDIT_DIR/argos.json"
node node_modules/css-cleaner/dist/cli/index.js scan "$ARGOS_ROOT/apps/console-web" --format markdown --output "$AUDIT_DIR/argos.md"
node node_modules/css-cleaner/dist/cli/index.js scan "$ARGOS_ROOT/apps/console-web" --format terminal --fail-on-missing
```

Le commit audité fige les sources, tandis que la configuration de cette branche
fixe le périmètre. Une exécution sur un autre état d’Argos doit actualiser les comptes
et conserver les avertissements pour permettre leur comparaison.
