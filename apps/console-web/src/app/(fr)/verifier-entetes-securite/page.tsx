import TopicAuditPage, { type TopicAuditContent } from "@/components/marketing/TopicAuditPage";
import { siteUrl } from "@/lib/i18n/metadata";
export const metadata = { title: "Vérifier les en-têtes de sécurité d’une page", description: "Analysez CSP, HSTS et les autres en-têtes observés sur une URL avec Argos : preuves, corrections contextualisées et limites.", alternates: { canonical: siteUrl + "/verifier-entetes-securite" }, openGraph: { title: "Vérifier les en-têtes de sécurité", description: "Réponse HTTP, constat et correction à tester sur une URL publique.", url: siteUrl + "/verifier-entetes-securite" } };
const content: TopicAuditContent = {
  "route": "/verifier-entetes-securite",
  "title": "Vérifier les en-têtes de sécurité d’une page",
  "lead": "Examinez la réponse HTTP d’une URL et les protections qu’elle annonce, pour préparer une correction adaptée.",
  "scope": "Cette entrée lance l’audit Argos existant. Un en-tête absent est un constat technique ; il ne prouve pas à lui seul une vulnérabilité exploitable.",
  "measures": [
    {
      "title": "CSP et HSTS",
      "text": "Les contrôles HTTP relèvent Content-Security-Policy et Strict-Transport-Security. Leur présence n’établit pas que la politique est adaptée ni que toutes les réponses du site sont protégées."
    },
    {
      "title": "Autres en-têtes",
      "text": "Le catalogue examine notamment X-Frame-Options, X-Content-Type-Options, Referrer-Policy et Permissions-Policy, ainsi que les attributs de cookies observés."
    },
    {
      "title": "HTTPS et TLS",
      "text": "L’URL finale, la connexion et les résultats TLS disponibles complètent les constats HTTP. Les services externes peuvent être indisponibles ; le rapport doit se lire avec sa couverture."
    }
  ],
  "example": {
    "title": "Exemple : une CSP absente sur la réponse",
    "conditions": "Réponse fictive d’une page publique atelier.example en HTTPS. Aucun site réel ni test d’intrusion.",
    "before": "HTTP/2 200\nContent-Type: text/html\nX-Content-Type-Options: nosniff\n# Content-Security-Policy absent",
    "interpretation": "Le contrôle http.security.csp indique l’absence de l’en-tête sur la réponse observée. Cela ne constitue pas une démonstration de XSS ni une recherche exhaustive de failles.",
    "correction": "Inventorier scripts, styles, images et connexions nécessaires. Préparer une CSP adaptée, tester en mode Report-Only dans un environnement maîtrisé, puis vérifier les parcours avant de l’appliquer.",
    "verify": "Contrôler les réponses et erreurs navigateur après déploiement. Pour HSTS, vérifier le HTTPS des domaines concernés avant includeSubDomains ou preload ; ne pas copier une politique universelle."
  },
  "limits": "Argos ne fournit ici ni pentest, ni recherche exhaustive de vulnérabilités, ni audit Supabase/RLS. Les protections doivent correspondre au fonctionnement réel du site. Une note élevée ne certifie pas sa sécurité.",
  "links": [
    {
      "href": "/guides/checklist-audit-site-web#https-entetes",
      "label": "Checklist : HTTPS et en-têtes"
    },
    {
      "href": "/methodologie-score#resume",
      "label": "Lire le score Sécurité et la couverture"
    },
    {
      "href": "/exemple-rapport",
      "label": "Voir comment lire un constat et sa preuve"
    }
  ],
  "sources": [
    {
      "href": "https://owasp.org/projects/secure-headers-project",
      "label": "OWASP : Secure Headers Project"
    },
    {
      "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP",
      "label": "MDN : concevoir et déployer une CSP"
    },
    {
      "href": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security",
      "label": "MDN : HSTS, sous-domaines et conditions"
    }
  ]
};
export default function Page(){ return <TopicAuditPage content={content} />; }
