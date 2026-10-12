# Méthode de design Argos et sélection communautaire

Décision du 13 octobre 2026 : renforcer les deux skills du dépôt avec des instructions écrites pour Argos, à partir des méthodes examinées ci-dessous. Aucun paquet de skills tiers, hook, binaire, MCP ou abonnement n'est installé. Les fichiers externes ne sont pas recopiés ; leurs scripts ne sont pas exécutés.

Le périmètre porte sur la méthode de travail. Il ne constitue pas une refonte de l'interface ni une preuve que le taux de défauts a déjà diminué.

## Ce qui change dans Argos

- [Direction artistique](../../.agents/skills/argos-art-direction/SKILL.md) : contrat de tâche avant le code, distinction accueil/rapport/administration, états et reprise, puis critique du rendu.
- [Repères du projet](../../.agents/skills/argos-art-direction/references/patterns.md) : composants et mixins réels à réutiliser ; les invariants existants du rapport et de géométrie sont conservés.
- [Revue visuelle](../../.agents/skills/argos-visual-review/SKILL.md) : couverture proportionnée, attente d'un état visible, parcours puis composition, correction et revérification.
- [Preuves](../../.agents/skills/argos-visual-review/references/evidence.md) : état et dimensions reproductibles, observations séparées des hypothèses, contrôles non exécutés explicites.
- [Évaluation](../testing/design-skills.md) : cas représentatifs pour vérifier le comportement futur de ces instructions.

L'identité Argos reste définie par le code et les [conventions publiques](public-design.md). Une capture avant modification n'est pas automatiquement une référence approuvée. La prochaine refonte pourra fournir des exemples validés avec leur contexte ; ce travail n'invente pas une validation visuelle passée.

## Les onze propositions

Les décisions ci-dessous portent sur les contenus effectivement consultés. L'activité d'un dépôt ne prouve pas l'efficacité de ses instructions.

| Source examinée | Apport retenu | Adaptation ou exclusion |
|---|---|---|
| [daisyUI](https://daisyui.com/skills/daisyui/) | Documentation par composant et couleurs sémantiques : bon modèle d'organisation. | Pas d'import : son usage cible daisyUI/Tailwind, incompatibles avec la convention SCSS Modules d'Argos. |
| [UI UX Pro Max](https://uupm.cc/) et son [skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/7246805992a42b7bba37d4cac83b01416f0c6c44/.claude/skills/ui-ux-pro-max/SKILL.md) | Choisir une recommandation selon le produit, la stack réelle et le problème précis. | Pas de catalogue de styles/palettes ni moteur Python importé ; la marque et les tokens existent déjà. |
| [Stark](https://github.com/f0d010c/stark/blob/ff94e5b4e1c98d259f3cde9f806406c4528deed4/SKILL.md) | Bref contrat de tâche, parcours et reprise, ressources chargées selon le besoin, preuve après rendu. | Workflow réduit aux surfaces web d'Argos ; pas de routage natif, de commandes ni de bibliothèques d'animation ajoutés. |
| [TypeUI](https://www.typeui.sh/) | Offre de design systems et ressources diffusées via MCP, examinée sur sa page publique. | Le contenu complet des skills n'a pas été audité. Pas d'import, de connexion ou d'achat ; aucune conclusion sur leur qualité interne. |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design/SKILL.md) | Conception liée au sujet, hiérarchie intentionnelle et texte utile à l'action. | Réutiliser l'identité d'Argos au lieu de recréer palette et typographie à chaque écran. |
| [Impeccable](https://impeccable.style/) : [polish](https://github.com/pbakaus/impeccable/blob/245ad82def45831dc56a21b683c7a1ff530b06cc/skill/reference/polish.md), [harden](https://github.com/pbakaus/impeccable/blob/245ad82def45831dc56a21b683c7a1ff530b06cc/skill/reference/harden.md), [critique](https://github.com/pbakaus/impeccable/blob/245ad82def45831dc56a21b683c7a1ff530b06cc/skill/reference/critique.md) | Prioriser les problèmes qui empêchent la tâche, corriger la cause, vérifier états et contenus difficiles. | Pas d'installation globale, de hooks, de détecteur ou de protocole obligatoire à deux agents. La critique locale reste adaptée au périmètre demandé. |
| [OpenAI figma-implement-design](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/figma-implement-design/SKILL.md) | Comparer capture et contexte de la même maquette ; réutiliser les composants du projet. | Conditionnel à une maquette Figma et aux outils accessibles. Pas de connexion Figma nécessaire pour une retouche Argos ordinaire. |
| [Composio webapp-testing](https://github.com/composio-community/awesome-codex-skills/blob/0930e1373789d2eda449039f7ac154b33031de89/webapp-testing/SKILL.md) | Inspecter l'interface rendue avant d'agir ; capturer le résultat et gérer les serveurs de test. | Pas d'outillage Python supplémentaire. Attendre un état UI précis plutôt que généraliser sa prescription `networkidle` aux rapports qui pollent. |
| [Owl-Listener designer-skills](https://github.com/Owl-Listener/designer-skills/tree/9a6930cf84a822eb458624bd11c61aac5bbdf224) : `component-spec`, `state-machine` | Décrire comportement, variantes et transitions des interactions touchées. | Pas d'import de la collection entière ; une correction locale ne déclenche pas un atelier UX complet. |
| [Composio theme-factory](https://github.com/composio-community/awesome-codex-skills/blob/0930e1373789d2eda449039f7ac154b33031de89/theme-factory/SKILL.md) | Collection de thèmes utilisables pour des artefacts autonomes. | Non retenu pour l'application : la sélection de nouvelles palettes/polices contredirait son système visuel établi. |
| [AccessLint](https://github.com/AccessLint/skills/blob/2e9d7336678302d0bc08848e92542560295b34d3/plugins/accesslint/skills/shared/methodology.md) | Séparer détection automatique, inspection et tests humains ; distinguer impact, preuve et incertitude. | Pas de copie de ses fichiers ni d'installation de CLI/MCP. Aucun résultat de scan ne devient une déclaration de conformité. |

## Provenance et conditions de réutilisation

Versions relevées via les API GitHub le 13 octobre 2026. La date est celle du dernier commit du dépôt à cette révision, pas celle de chaque skill ni une garantie de maintenance future. Les liens figés ci-dessus servent à comparer les évolutions.

| Dépôt | Révision | Date du commit | Licence ou conditions repérées |
|---|---|---|---|
| saadeghi/daisyui | `662b54b7533b6b29a8544ee6642a2a109c492b05` | 2026-10-12 | MIT ; page du skill et métadonnées du dépôt |
| nextlevelbuilder/ui-ux-pro-max-skill | `7246805992a42b7bba37d4cac83b01416f0c6c44` | 2026-10-12 | MIT, métadonnées du dépôt |
| f0d010c/stark | `ff94e5b4e1c98d259f3cde9f806406c4528deed4` | 2026-07-26 | Apache-2.0, métadonnées du dépôt |
| anthropics/skills | `dbd4588f9e1033efb41dad4bef2f7947c8993d44` | 2026-10-09 | Apache-2.0, `frontend-design/LICENSE.txt` lu |
| pbakaus/impeccable | `245ad82def45831dc56a21b683c7a1ff530b06cc` | 2026-10-12 | Apache-2.0, métadonnées du dépôt |
| openai/skills | `49f948faa9258a0c61caceaf225e179651397431` | 2026-06-24 | Conditions développeur Figma, `figma-implement-design/LICENSE.txt` lu ; ne pas supposer une licence uniforme du dépôt |
| composio-community/awesome-codex-skills | `0930e1373789d2eda449039f7ac154b33031de89` | 2026-07-26 | Apache-2.0, fichiers `LICENSE.txt` des deux skills lus |
| Owl-Listener/designer-skills | `9a6930cf84a822eb458624bd11c61aac5bbdf224` | 2026-09-05 | MIT, métadonnées du dépôt |
| AccessLint/skills | `2e9d7336678302d0bc08848e92542560295b34d3` | 2026-08-25 | Aucune licence identifiée dans les métadonnées ni fichier LICENSE/COPYING dans l'arbre consulté ; pas de redistribution |
| TypeUI | Page publique consultée, sans révision figée | 2026-10-13 (consultation) | Conditions d'un service ; contenu complet non inspecté |

## Mise à jour

Une nouvelle version externe est une proposition à examiner. Comparer uniquement les fichiers pertinents avec la révision retenue, identifier le défaut concret qu'elle aiderait à éviter, vérifier ses dépendances et ses conditions avant toute copie, puis adapter les instructions et rejouer les scénarios concernés. Mettre à jour cette provenance dans la même PR.

Les règles Argos restent maintenues dans ce dépôt. Elles ne reçoivent pas automatiquement les mises à jour communautaires : ce choix évite les changements de stack ou de workflow implicites. Ne pas accumuler un nouveau paragraphe pour chaque incident si une correction du composant partagé ou d'une règle existante suffit.
