import TopicAuditPage, { type TopicAuditContent } from "@/components/marketing/TopicAuditPage";
import { siteUrl } from "@/lib/i18n/metadata";
export const metadata = { title: "Analyse SEO technique d’une page gratuite", description: "Vérifiez title, description, structure HTML et signaux d’indexabilité d’une URL avec Argos, sans promesse de classement.", alternates: { canonical: siteUrl + "/analyse-seo-page" }, openGraph: { title: "Analyse SEO technique d’une page", description: "Signaux HTML, preuve avant/après et limites du diagnostic SEO.", url: siteUrl + "/analyse-seo-page" } };
const content: TopicAuditContent = {
  "route": "/analyse-seo-page",
  "title": "Analyse SEO technique d’une page",
  "lead": "Vérifiez les signaux du HTML et de l’indexabilité d’une URL publique, puis préparez les corrections.",
  "scope": "Argos examine une page à la fois. Ce diagnostic ne fournit ni recherche de mots-clés, ni backlinks, ni positions Google, ni audit sémantique global.",
  "measures": [
    {
      "title": "Titre et description",
      "text": "Le contrôle HTML relève le title et une meta description utilisable. Leur présence ne prouve pas leur pertinence éditoriale ni que Google reprendra ces textes."
    },
    {
      "title": "Structure et canonique",
      "text": "Le rapport examine notamment les H1 et la présence d’une URL canonical. Le choix effectif de Google et la cohérence de toutes les pages nécessitent une vérification complémentaire."
    },
    {
      "title": "Signaux d’indexabilité",
      "text": "Les contrôles HTTP et HTML peuvent relever robots.txt, sitemap et directives robots. Un signal détecté ne prouve pas une indexation ni un classement."
    }
  ],
  "example": {
    "title": "Exemple avant/après : une description spécifique",
    "conditions": "HTML fictif de la fiche produit atelier.example, sans donnée client ni rapport privé.",
    "before": "<title>Sac</title>\n<!-- aucune meta description -->",
    "after": "<title>Sac en toile bleu | Atelier Demo</title>\n<meta name=\"description\" content=\"Découvrez le sac en toile bleu Atelier Demo, ses dimensions et son entretien.\">",
    "interpretation": "Le constat automatisé établit que la description manque. Le texte après correction est un exemple éditorial : Argos ne valide pas son efficacité dans les résultats.",
    "correction": "Écrire un titre et un résumé fidèles au contenu de la page, spécifiques et lisibles, puis les publier dans le HTML livré.",
    "verify": "Contrôler le code source, relancer l’audit, puis consulter l’inspection Search Console si vous possédez la propriété. Google peut choisir un autre titre ou extrait."
  },
  "limits": "Un contrôle réussi confirme seulement le signal mesuré. La stratégie éditoriale, la pertinence des requêtes, le crawl global et l’indexation réelle demandent d’autres informations. Aucun trafic ou classement n’est garanti.",
  "links": [
    {
      "href": "/guides/checklist-audit-site-web#html-seo",
      "label": "Checklist : vérifier le HTML et les signaux SEO"
    },
    {
      "href": "/methodologie-score#resume",
      "label": "Comprendre les poids et la couverture du score"
    },
    {
      "href": "/exemple-rapport",
      "label": "Voir la description dans un exemple de rapport"
    }
  ],
  "sources": [
    {
      "href": "https://developers.google.com/search/docs/appearance/title-link",
      "label": "Google : titres des résultats de recherche"
    },
    {
      "href": "https://developers.google.com/search/docs/appearance/snippet",
      "label": "Google : extraits et meta descriptions"
    },
    {
      "href": "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
      "label": "Google : directives robots"
    }
  ]
};
export default function Page(){ return <TopicAuditPage content={content} />; }
