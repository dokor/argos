# Guides CLS, refonte et accès des moteurs

Première version des textes français : 2 novembre 2026. La révision technique
compare le contenu aux sources officielles et au périmètre d’Argos ; elle ne
vaut pas relecture humaine avant publication.

| Route | Intention et contenu particulier |
| --- | --- |
| `/guides/cls-eleve` | Diagnostiquer les décalages, choisir une correction et comparer deux démonstrations artificielles avec le même encart différé. |
| `/guides/refonte-site-web` | Préparer la recette avant publication, contrôler la production puis surveiller les résultats ; grille CSV de 18 contrôles à compléter. |
| `/guides/accessibilite-moteurs-ia` | Distinguer accès public, HTML initial/rendu, exploration, indexation, recherche, entraînement et citation. |

## Intégration et langues

Les articles utilisent les layouts français, `PageLink`, `EditorialMeta`, les
dates de `lib/editorial.ts`, les métadonnées localisées et `JsonLd` avec le nonce
de la réponse. Le texte principal est rendu côté serveur. Les références et
descriptions sont déclarées dans `lib/diagnosticGuides.ts`.

Les textes sont français uniquement. Aucune route anglaise ni alternance EN
n’est déclarée. Les ressources anglaises annoncent la langue française et le
sélecteur existant renvoie aux ressources anglaises. Les liens de ressources,
de checklist et `llms.txt` rendent les articles découvrables. Le sitemap
préserve toutes les variantes existantes et ajoute les trois URL françaises.

Les démonstrations `/demonstrations/cls/avant` et `/demonstrations/cls/apres`
portent `noindex` et restent hors sitemap. Elles illustrent une insertion de
128 pixels après 1,2 seconde ; il ne s’agit ni d’un score CLS de production ni
d’un gain client. La grille CSV est encodée en UTF-8 avec BOM et utilise un
point-virgule ; aucun contrôle n’est présenté comme validé.

Le guide de refonte propose un lien contextuel vers la checklist de lancement
de l’auteur sur `antoine.lelouet.fr`, consultée lors de la rédaction. Les autres
références sont les documentations Google, web.dev, Chrome, W3C, OpenAI et la
RFC 9309. Les rôles d’OAI-SearchBot et GPTBot sont séparés ; l’exemple robots.txt
n’applique aucune modification aux règles du site Argos.

## Relecture avant publication

Relecteur humain : en attente. Aucun nom ni date de validation humaine n’est
revendiqué. Relire les trois parcours FR, les titres SEO et les sources,
les tableaux sur mobile et au clavier, la grille CSV et la démonstration.
Confirmer particulièrement la différence entre indexabilité et indexation,
ainsi que le choix illustratif de permissions de recherche/entraînement.

Les validations automatisées et les contrôles navigateur réellement exécutés
sont consignés dans la description de la PR. La fusion et le déploiement
restent des actions distinctes de cette livraison.
