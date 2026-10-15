# Espacements de l'interface

Inventaire et règles appliqués dans l'issue #140. Les valeurs sont définies dans `apps/console-web/src/styles/_tokens.scss` et utilisées par les modules SCSS des pages et composants.

## Échelle

| Usage | Bureau | Mobile (≤ 640 px, ou seuil propre à la page) |
| --- | ---: | ---: |
| Gouttière de page | 24 px | 16 px |
| Espace vertical d'une section | 64 px | 48 px |
| Rembourrage d'un panneau | 24 px | 16 px |
| Écart courant entre éléments | 8, 12, 16, 24 ou 32 px | même échelle, selon la densité |
| Cible interactive principale | au moins 44 px de hauteur | au moins 44 px de hauteur |

Les puces et filtres secondaires utilisent une cible de 40 px au minimum. Les titres et listes conservent leur rythme typographique ; l'échelle ne remplace pas les marges nécessaires à la lecture de longs articles.

## Inventaire

| Surface | Éléments harmonisés | Exception conservée |
| --- | --- | --- |
| Accueil | navigation, hero, sections, cartes, formulaire | hero plus ample pour la composition avec l'aperçu du rapport |
| Rapport | conteneur, hero, scores, priorités, couverture, progression, erreur et CTA | progression sur fond sombre et graphiques dimensionnés par contenu |
| Dashboard | conteneur, filtres, liste d'audits, cartes KPI | grille adaptable au nombre de colonnes |
| Connexion | conteneur, formulaire, champs et bouton | largeur maximale du formulaire |
| FAQ | hero, contenu, accordéons et CTA | espacement entre groupes de questions |
| Accessibilité numérique | hero, article, sommaire et encarts | rythme des paragraphes et ancrages du sommaire |
| Page introuvable | conteneur et actions | grand code 404 comme élément graphique |
| Navigation et footer partagés | gouttières et disposition mobile | hauteur fixe de la barre de navigation |

Les surfaces sans maquette spécifique gardent leurs tailles de contenu, mais leurs marges et rembourrages extérieurs suivent la même échelle. Les couleurs, la typographie et les points de rupture existants restent ceux des composants.

## Vérification

Contrôler les surfaces affectées en FR/EN, clair/sombre et aux largeurs mobile,
tablette et bureau, avec zoom/reflow et clavier. Rejouer la [recette du header](../testing/public-header.md)
ou celle du [rapport](../testing/report.md) selon le changement. Les captures
avant/après de l'issue #140 restent dans Git ; les nouvelles vont dans outputs
ou dans les artefacts de la PR, avec le SHA et le scénario.
