# Guide rédactionnel FR/EN

Ce guide s’applique aux pages publiques, métadonnées, formulaires, comptes,
administration, rapports, messages d’erreur et vues d’impression. Il accompagne
les fonctionnalités livrées ; il ne fixe aucun tarif ou quota chiffré.

## Écrire pour la personne qui utilise Argos

En français, vouvoyer et donner une action concrète : « Saisissez l’adresse
d’une page publique », « Ouvrir le rapport ». En anglais, employer une phrase
directe et naturelle, sans traduction mot à mot ; préférer l’anglais britannique
(analyse, behaviour) dans les nouveaux textes. Garder les noms des outils et les
identifiants techniques inchangés. Une erreur explique ce qui est connu et
comment poursuivre, sans annoncer une cause inconnue ou révéler un compte.

Éviter slogans vagues, anglicismes inutiles, répétitions et traces de consignes.
Un titre annonce le contenu ; chaque section apporte une information nouvelle.
Ne pas confondre une promesse commerciale avec une mesure technique. Les
exemples fictifs restent explicitement signalés.

## Vocabulaire commun

| Notion | Français | English | Sens |
|---|---|---|---|
| Site suivi | site, nom d’hôte | site, host name | Groupe d’URL du même nom d’hôte ; un sous-domaine est distinct. Le suivi ne prouve pas la propriété du site. |
| Adresse | URL, page publique | URL, public page | Adresse soumise, pas toutes les pages du site. |
| Exécution | analyse | analysis | Une tentative, en attente, en cours, terminée ou échouée. « Audit » reste dans les titres SEO et le diagnostic global ; « run » est technique. |
| Résultat | rapport | report | Résultats publiés d’une analyse, éventuellement partiels. |
| Observation | constat | finding | Problème ou opportunité observé ; garder preuve, identifiant, outil et unités dans le détail technique. |
| Action | correction, priorité | correction, priority | Action à confirmer, distincte du constat. |
| Classement | domaine | domain | Performance, sécurité, SEO, accessibilité ; les outils sont des sources. |
| Note | score | score | Indicateur du périmètre mesuré, sans garantie de conformité, sécurité ou classement SEO. |
| Mesures | couverture | coverage | Part pondérée du barème mesurée ; distincte de la progression et de la confiance d’un constat. |
| Consommation | plafond mensuel | monthly limit | Mois calendaire dans le fuseau affiché ; rapport compté une fois, même partiel ; échec sans rapport non compté. |

L’analyse sans compte reste disponible. Ne pas annoncer de plafond chiffré,
tarif, facturation ou fonctionnalité exclusivement payante sans décision.
L’historique par URL et l’impression PDF existent ; ne pas les présenter comme
des promesses futures. L’impression prête ne signifie pas fichier sauvegardé.
« Privé » doit être expliqué par l’accès au lien ; non-indexation et
authentification sont deux choses distinctes. Voir les contrats de
[contenu public](public-content.md), [consommation](../accounts/usage-contract.md),
[export](../report/pdf.md) et [conservation](../report/retention.md).

## Revue avant publication

Pour chaque PR modifiant un texte visible, le rédacteur identifie les routes,
langues, états et sources changés dans le dossier de livraison. Un relecteur
humain vérifie avant publication : exactitude par rapport au comportement,
fluidité FR/EN, termes communs, absence de répétitions et de consignes résiduelles,
titres SEO, métadonnées, liens localisés, données sensibles, texte sur mobile,
thèmes et navigation clavier. Les textes techniques conservent leurs preuves et
leurs unités. Une relecture par un agent ne vaut pas validation humaine.

Le contrôle `npm run check:editorial` vérifie les clés FR/EN, textes non vides,
variables d’interpolation et quelques marqueurs explicites de brouillon.
`npm run check:editorial -- --inventory ../../outputs/editorial-inventory.json`
exporte toutes les routes et des chaînes candidates du code pour la revue.
Les candidats incluent aussi des littéraux techniques ; ils ne constituent ni
une liste exhaustive des textes rendus ni une preuve de traduction complète.
La relecture doit aussi examiner les dictionnaires, contenus dynamiques et PDF.
L’outil ne détecte pas automatiquement toutes les formulations artificielles.

Consigner le nom du relecteur, la date, les parcours réellement relus et les
réserves dans la PR. Si la validation humaine reste en attente, l’indiquer
explicitement ; ne pas publier en la déclarant réalisée.
