import TopicAuditPage, { type TopicAuditContent } from "@/components/marketing/TopicAuditPage";
import { siteUrl } from "@/lib/i18n/metadata";
export const metadata = { title: "Test de vitesse d’une page web gratuit", description: "Analysez une URL avec Argos : chargement, constats Lighthouse, unités et limites des mesures de laboratoire.", alternates: { canonical: siteUrl + "/test-vitesse-site-web" }, openGraph: { title: "Test de vitesse d’une page web", description: "Mesures de chargement et corrections à examiner sur une URL publique.", url: siteUrl + "/test-vitesse-site-web" } };
const content: TopicAuditContent = {
  "route": "/test-vitesse-site-web",
  "title": "Test de vitesse d’une page web",
  "lead": "Mesurez le chargement d’une URL et identifiez les ressources à examiner en priorité.",
  "scope": "Une mesure de laboratoire sur une page publique. Les conditions du navigateur et les modules disponibles comptent ; ce test ne mesure pas les visites réelles de vos utilisateurs.",
  "measures": [
    {
      "title": "LCP et FCP Lighthouse",
      "text": "Quand Lighthouse les remonte comme constats, le LCP indique l’apparition du plus grand contenu visible et le FCP le premier contenu affiché. Les valeurs numériques et unités disponibles sont à lire avec le profil de mesure."
    },
    {
      "title": "Chargement navigateur",
      "text": "Le module runtime relève les événements de chargement, les erreurs et requêtes échouées, ainsi que le poids estimé des réponses. Il ne fournit pas un INP de terrain."
    },
    {
      "title": "Scores et temps",
      "text": "Le score Performance Lighthouse est une note sur 100, pas une durée. Le score Performance Argos combine des contrôles pondérés distincts ; ne convertissez aucune de ces notes en secondes."
    }
  ],
  "example": {
    "title": "Exemple : un contenu principal affiché tard",
    "conditions": "Donnée fictive, aucune mesure client. Supposons une exécution Lighthouse de laboratoire sur atelier.example avec un profil de bureau déclaré ; comparez toujours avec le même profil et les mêmes conditions.",
    "before": "largest-contentful-paint\nnumericValue: 2800\nnumericUnit: millisecond\nLCP : 2,8 s",
    "interpretation": "2 800 millisecondes correspondent à 2,8 secondes pour cette exécution. Une mesure isolée ne décrit pas le 75e percentile des visiteurs ni toutes les conditions mobiles.",
    "correction": "Identifier l’élément LCP et sa chaîne de chargement, puis examiner la taille de l’image, les délais serveur et les ressources bloquantes avant de choisir une optimisation.",
    "verify": "Relancer avec la même URL et le même profil, comparer plusieurs mesures et examiner des données de terrain si vous en disposez."
  },
  "limits": "Une exécution peut varier avec réseau, contenu, cache et services disponibles. Argos ne fournit pas ici une collecte CrUX, un INP de visiteurs ou une garantie de rapidité mobile. Un contrôle absent n’est pas un résultat favorable.",
  "links": [
    {
      "href": "/methodologie-score#resume",
      "label": "Comprendre le score et la couverture"
    },
    {
      "href": "/guides/checklist-audit-site-web#performance",
      "label": "Vérifications manuelles de performance"
    },
    {
      "href": "/exemple-rapport",
      "label": "Lire un exemple de rapport commenté"
    }
  ],
  "sources": [
    {
      "href": "https://web.dev/articles/lcp",
      "label": "web.dev : Largest Contentful Paint"
    },
    {
      "href": "https://web.dev/articles/fcp",
      "label": "web.dev : First Contentful Paint"
    },
    {
      "href": "https://developer.chrome.com/docs/lighthouse/performance/performance-scoring",
      "label": "Chrome : méthode du score Performance Lighthouse"
    }
  ]
};
export default function Page(){ return <TopicAuditPage content={content} />; }
