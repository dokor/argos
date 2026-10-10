# Provenance éditoriale et dates stables

Dates de première version = première publication du texte dans le dépôt, pas une date de mise en production supposée. Recherche reproductible : git log --follow --diff-filter=A --format="%cs %h %s" -- chemin/page.tsx. Auteur des quatre guides initiaux : alelouet ; identité publique Antoine Le Louët déjà publiée et confirmée.

| Guide | Première version et preuve | Révision substantielle |
|---|---|---|
| Checklist | 2026-10-07 d464c24 (#301) | 2026-10-07, contenu des vérifications ; cases et impression du 10 ne modifient pas les critères |
| Méthode | 2026-10-07 8f80100 (#300) | 2026-10-10 bb3cea1, v12 et résumé |
| Audit technique | 2026-10-06 aeec9b5 | 2026-10-10 1a3ffe7, limites contextualisées |
| Accessibilité RGAA/EAA | 2026-10-06 5ee0fb6 | 2026-10-06, contenu juridique inchangé |
| Vitesse / SEO / sécurité | 2026-10-10 63c8a2b / 7bfdcd0 / cd5259c | même date, versions initiales de cet epic |
| Test accessibilité | 2026-10-11 33f2177 | même date ; fuseau Europe/Paris |

Données communes dans lib/editorial.ts : auteur partagé via À propos, dates explicites, sources et lecture estimée (pas un temps mesuré). EditorialMeta ne lit ni date de build ni date courante. Une révision de typographie, navigation ou instrumentation ne rafraîchit pas le contenu. Modifier revised uniquement avec une explication du changement technique ou éditorial. Les traductions futures peuvent conserver la première version du texte source et consigner séparément leur livraison ; ne pas les présenter comme anciennes traductions.

Références vérifiées lors de cette tâche : Google Search Central, web.dev, Chrome, OWASP, MDN, W3C WAI ; pour le guide français, DINUM RGAA 4.1.2, champ article 47, Légifrance article 47-1, DGCCRF EAA. EUR-Lex fournit le lien de directive mais sa réponse de lecture automatisée était limitée ; aucun changement de ses règles revendiqué. La date de révision juridique reste le 6 octobre. Pas de schéma Article ajouté : les données visibles suffisent, sans assertion supplémentaire.
