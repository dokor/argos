# Inventaire éditorial — milestone 17

État du dépôt au 12 octobre 2026, départ `c863572`. L’inventaire porte sur les
routes présentes dans le code, sans supposer leur déploiement. Les intentions SEO
restent celles du [contrat public](../seo/public-page-intents.md).

| Page FR | Version EN existante | Revue et traitement |
|---|---|---|
| `/` | `/en` | Raccourcir les répétitions du parcours, du compte facultatif et du CTA final ; conserver le H1 SEO. |
| `/faq` | `/en/faq` | Corriger quotas, historique, comparaison, PDF, conservation et newsletter absente du parcours actuel. |
| `/exemple-rapport` | `/en/example-report` | Les composants partagés reprennent scores, domaines, constats et accords ; exemple toujours fictif. |
| `/ressources` | `/en/resources` | Liens et rôle de répertoire conservés ; footer commun raccourci. |
| `/ressources/audit-technique-gratuit` | `/en/resources/free-technical-audit` | Alignement de la formulation de non-indexation EN sur FR ; périmètre d’une URL conservé. |
| `/ressources/audit-site-pme` | `/en/resources/small-business-website-audit` | Titre « signaux de confiance » concret ; pas de promesse commerciale. |
| `/ressources/audit-site-ecommerce` | `/en/resources/ecommerce-website-audit` | Corriger « un seul URL » ; exemple fictif et limites du paiement conservés. |
| `/guides/checklist-audit-site-web` | `/en/guides/website-audit-checklist` | Le guide distingue contrôles manuels et signaux automatiques ; sources et ancres conservées. |
| `/methodologie-score` | `/en/scoring-method` | Formules, barème et limites conservés ; les libellés du rapport renvoient à la méthode traduite. |
| `/ressources/accessibilite-numerique` | `/en/resources/digital-accessibility` | Retirer la mention « French » du lien de méthode maintenant traduit. Règles juridiques et dates non révisées. |
| `/a-propos` | `/en/about` | Identité, contact et licence conservés ; l’accueil renvoie au créateur sans répéter la description du diagnostic. |
| `/feedback` | `/en/feedback` | Libellé « Description » simplifié ; historique de traitement traduit naturellement. |
| `/analyse-seo-page` | Aucune | Périmètre d’une URL et absence de promesse de classement déjà explicites. |
| `/test-vitesse-site-web` | Aucune | Mesures de laboratoire et limites déjà explicites ; aucun délai chiffré ajouté. |
| `/verifier-entetes-securite` | Aucune | En-têtes et limites du diagnostic déjà explicites. |
| `/test-accessibilite-site-web` | Aucune | Limites automatiques et vérification humaine conservées. |
| `/confidentialite` | Aucune | Contrat de conservation lu pour corriger la FAQ ; page juridique inchangée. |
| `/informations-legales` | Aucune | Identité et informations encore à qualifier conservées. |

Les six pages françaises sans version anglaise restent ainsi identifiées : pas
de faux lien de traduction ni de hreflang ajouté. Les routes, canonical,
métadonnées et intentions de recherche sont préservés.

## Interfaces et sources de textes

- Comptes, consommation et sites : `src/lib/i18n/fr.json` et `en.json`.
  Site = nom d’hôte ; plusieurs URL ; plafond mensuel configurable et mois
  calendaires ; erreurs avec une prochaine action, sans révéler un compte.
- Historique : `components/account/historyCopy.ts` ; analyse relancée par URL.
- Administration : `components/admin/copy.ts` ; « Analyses en cours » identique
  à la consommation personnelle ; offre distincte du rôle.
- Retours : `components/feedback/copy.ts` ; texte et confidentialité conservés.
- Rapports web et impression : dictionnaires, `decisionCopy.ts`,
  `reportReadingCopy.ts`, `findingCatalogue.ts` et `exportCopy.ts`.
  Domaines/constats/scores cohérents, singulier des constats et résumé avec
  libellés neutres, gain théorique expliqué, preuves/identifiants/unités gardés.
  Le catalogue v2 évite de doubler la confirmation sans recommandation détaillée.
- Thème : noms accessibles FR/EN dans les dictionnaires, utilisés sur toutes
  les pages ; auparavant le bouton anglais gardait un nom français.

`npm run check:editorial -- --inventory ../../outputs/editorial-inventory.json`
énumère 62 routes, dont les 30 routes publiques ci-dessus, et les chaînes
candidates des pages, composants et bibliothèques. Ce fichier est régénérable et
reste dans les sorties locales. L’extraction inclut du code technique ; les
chaînes des dictionnaires sont listées séparément par leurs sources. Le contrôle
n’a signalé aucun des marqueurs explicites de brouillon qu’il recherche. Il ne
prouve ni l’absence de toute trace de prompt ni la qualité éditoriale complète.

Voir le [guide de revue](editorial-guide.md) et les
[résultats réels de validation](../testing/editorial-coherence.md).
