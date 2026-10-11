import TopicAuditPage, { type TopicAuditContent } from "@/components/marketing/TopicAuditPage";
import { siteUrl } from "@/lib/i18n/metadata";
export const metadata = { title: "Test automatique d’accessibilité d’une page", description: "Repérez des signaux automatiques d’accessibilité sur une URL avec Argos et les contrôles humains complémentaires, sans certificat de conformité.", alternates: { canonical: siteUrl + "/test-accessibilite-site-web" }, openGraph: { title: "Test automatique d’accessibilité", description: "Un exemple détectable, sa correction et les vérifications humaines nécessaires.", url: siteUrl + "/test-accessibilite-site-web" } };
const content: TopicAuditContent = {
  "route": "/test-accessibilite-site-web",
  "title": "Test automatique d’accessibilité d’une page",
  "lead": "Repérez des problèmes détectables sur une URL publique et préparez les vérifications humaines qui complètent le rapport.",
  "scope": "Le formulaire lance l’audit Argos existant, dont les contrôles automatiques d’accessibilité disponibles. Il ne délivre pas de certificat de conformité RGAA ou WCAG.",
  "measures": [
    {
      "title": "Alternatives d’images",
      "text": "Le contrôle HTML relève la couverture des attributs alt. Leur présence ne garantit pas que le texte décrit utilement une image, ni qu’une image décorative est correctement traitée."
    },
    {
      "title": "Noms et structure",
      "text": "Les contrôles HTML et les constats Lighthouse disponibles peuvent signaler des liens, champs ou boutons sans nom accessible et des problèmes de structure. Ils ne couvrent pas tous les états interactifs."
    },
    {
      "title": "Score automatique",
      "text": "Le score Accessibilité Lighthouse est un signal d’un outil. Le domaine Accessibilité Argos combine des contrôles pondérés. Aucun de ces scores ne valide les parcours vécus ni la conformité d’un site entier."
    }
  ],
  "example": {
    "title": "Exemple : une image informative sans alternative",
    "conditions": "HTML fictif de la fiche produit atelier.example. Le fragment est affiché comme texte, sans reproduire une image inaccessible dans cette page.",
    "before": "<img src=\"/demo/atelier/sac.svg\" width=\"320\" height=\"240\">",
    "after": "<img src=\"/demo/atelier/sac.svg\" width=\"320\" height=\"240\"\n     alt=\"Sac en toile bleu avec deux anses\">",
    "interpretation": "Le contrôle html.images.alt_coverage constate l’absence d’un attribut alt. Le choix du texte après correction dépend du rôle de cette image dans la page.",
    "correction": "Décrire l’information utile pour une image informative. Pour une image purement décorative, utiliser une alternative vide après avoir vérifié son rôle ; ne pas appliquer automatiquement la même recette à toutes les images.",
    "verify": "Lire la page avec un lecteur d’écran et tester les actions au clavier, le focus, les messages d’erreur et l’affichage agrandi. Contrôler la pertinence des alternatives avec le contenu environnant."
  },
  "limits": "L’automatisation détecte seulement une partie des problèmes. Un score élevé ne démontre ni l’absence de blocages, ni l’inapplicabilité d’un critère, ni la conformité RGAA/WCAG. La ressource dédiée explique le contexte français et européen séparément.",
  "links": [
    {
      "href": "/ressources/accessibilite-numerique",
      "label": "Comprendre l’accessibilité numérique et le contexte réglementaire"
    },
    {
      "href": "/guides/checklist-audit-site-web#accessibilite",
      "label": "Checklist : essayer un parcours au clavier"
    },
    {
      "href": "/methodologie-score#resume",
      "label": "Lire le score et la couverture"
    },
    {
      "href": "/exemple-rapport",
      "label": "Voir ce constat dans le rapport fictif"
    }
  ],
  "sources": [
    {
      "href": "https://www.w3.org/WAI/test-evaluate/tools/",
      "label": "W3C WAI : limites des outils d’évaluation"
    },
    {
      "href": "https://www.w3.org/WAI/tutorials/images/",
      "label": "W3C WAI : alternatives selon le rôle des images"
    },
    {
      "href": "https://www.w3.org/WAI/WCAG22/quickref/",
      "label": "W3C : critères WCAG 2.2"
    }
  ]
};
export default function Page(){ return <TopicAuditPage content={content} />; }
