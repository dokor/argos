import { wordpressAuditContent } from "./wordpressAuditContent";
import type { Lang } from "@/lib/i18n/routes";

export const diagnosticRoutes = {
  wordpress: "/ressources/audit-wordpress",
  shopify: "/ressources/audit-shopify",
  conversion: "/ressources/pourquoi-mon-site-ne-convertit-pas",
} as const;

export type DiagnosticTopic = keyof typeof diagnosticRoutes;
type ContentLink = { href: string; label: string };
type Check = { title: string; text: string; next: string; link?: ContentLink };
export type DiagnosticContent = {
  metaTitle: string;
  description: string;
  eyebrow: string;
  title: string;
  lead: string;
  scope: string;
  cta: string;
  checksTitle: string;
  checks: Check[];
  example: { title: string; evidence: string; action: string; after?: string; verify: string };
  manualTitle: string;
  manual: { title: string; text: string; link?: ContentLink }[];
  limits: string[];
  sources: { href: string; label: string }[];
};

export const diagnosticPages: Record<DiagnosticTopic, Record<Lang, DiagnosticContent>> = {
  wordpress: wordpressAuditContent,
  shopify: {
    fr: {
      metaTitle: "Audit Shopify : performance et SEO de votre boutique",
      description: "Analysez une fiche produit ou une collection Shopify publique : performance, SEO et accessibilité. Découvrez les limites d’un audit sans accès admin.",
      eyebrow: "Diagnostic Shopify",
      title: "Votre vitrine Shopify, vue depuis une page publique",
      lead: "Une fiche produit peut charger des images, un thème et des scripts d’apps. Argos documente les signaux techniques visibles pour préparer le travail sur votre boutique.",
      scope: "Choisissez une URL de produit ou de collection accessible sans connexion. L’analyse porte sur cette page, sans accès à Shopify Admin ni installation d’app.",
      cta: "Analyser ma page Shopify",
      checksTitle: "Les signaux utiles sur une fiche produit",
      checks: [
        { title: "Performance de la vitrine", text: "Les temps de chargement et les ressources observées donnent un point de départ pour examiner images, thème et scripts tiers. Une mesure de laboratoire ne représente pas tous vos visiteurs.", next: "Comparez plusieurs exécutions sur la même fiche, puis examinez les ressources du thème et les intégrations d’apps avec votre développeur." },
        { title: "SEO de la fiche ou de la collection", text: "Argos examine des signaux HTML comme le titre, la description et les indications d’indexation. Il ne contrôle pas tout le catalogue ni votre position dans Google.", next: "Vérifiez les champs SEO du produit et le HTML publié par le thème ; choisissez séparément d’autres pages représentatives." },
        { title: "Images et contrôles accessibles", text: "Les contrôles automatiques peuvent relever des alternatives manquantes ou des noms de commandes absents. Ils ne vérifient pas qu’un visiteur peut terminer un achat.", next: "Relisez les alternatives des médias produit et testez manuellement variantes, boutons, focus et messages d’erreur." },
        { title: "Protections publiques", text: "Les contrôles disponibles portent sur HTTPS et les protections HTTP visibles. Certaines configurations dépendent de la plateforme et ne sont pas modifiables dans le thème.", next: "Distinguez ce qui relève du thème, d’une app ou de Shopify avant de transmettre une correction à la bonne personne." },
      ],
      example: { title: "Une fiche produit dont l’image n’est pas décrite", evidence: "Illustration fictive, sans mesure de ventes\nPage : une fiche produit Shopify publique\nConstat : une image produit n’a pas d’attribut alt", action: "Ajoutez une alternative utile au média produit et vérifiez que le thème la restitue. Décrivez l’information portée par l’image, sans accumulation de mots-clés.", verify: "Inspectez le HTML rendu pour cette image et relisez le texte dans son contexte. Relancez la même URL ; un constat corrigé ne démontre pas une hausse des commandes." },
      manualTitle: "Poursuivre dans Shopify et dans le parcours d’achat",
      manual: [
        { title: "Thème et apps", text: "Faites l’inventaire dans Shopify Admin. Testez une modification sur une copie de thème avant publication ; la présence d’un script ne prouve pas qu’une app est la cause d’un ralentissement." },
        { title: "Panier et paiement", text: "Vérifiez vous-même l’ajout au panier, les frais de livraison et le paiement avec les outils de test appropriés. Argos n’effectue aucune commande et ne parcourt pas un tunnel authentifié." },
        { title: "Résultats commerciaux", text: "Rapprochez les corrections des données de votre boutique et des retours clients. Les abandons peuvent aussi dépendre du prix, de l’offre ou de la livraison, hors du diagnostic technique." },
      ],
      limits: ["Pas d’accès admin Shopify, d’inventaire exhaustif des apps ni d’analyse privée du code du thème.", "Pas de test de commande, de paiement ou de parcours connecté ; une boutique protégée par mot de passe doit être examinée autrement.", "Argos est un outil indépendant, sans certification ni affiliation Shopify revendiquée. Aucun gain de conversion n’est garanti."],
      sources: [{ href: "https://shopify.dev/docs/storefronts/themes/best-practices/performance", label: "Shopify — bonnes pratiques de performance des thèmes" }],
    },
    en: {
      metaTitle: "Shopify audit: store performance and SEO",
      description: "Analyse a public Shopify product or collection page for performance, SEO and accessibility. Understand the limits of an audit without admin access.",
      eyebrow: "Shopify diagnosis",
      title: "Your Shopify storefront, through one public page",
      lead: "A product page can load images, a theme and app scripts. Argos documents visible technical signals to help you plan work on your store.",
      scope: "Choose a product or collection URL accessible without signing in. Analysis covers that page, without access to Shopify Admin or an app to install.",
      cta: "Analyse my Shopify page",
      checksTitle: "Useful signals on a product page",
      checks: [
        { title: "Storefront performance", text: "Loading times and observed resources provide a starting point for reviewing images, themes and third-party scripts. A lab measurement does not represent every visitor.", next: "Compare several runs on the same product page, then review theme resources and app integrations with your developer." },
        { title: "Product or collection SEO", text: "Argos examines HTML signals such as the title, description and indexing instructions. It does not review your whole catalogue or your Google ranking.", next: "Check product SEO fields and the HTML published by the theme; choose other representative pages separately." },
        { title: "Accessible images and controls", text: "Automated checks can flag missing alternatives or unnamed controls. They do not check that a visitor can complete a purchase.", next: "Review product media alternatives and manually test variants, buttons, focus and error messages." },
        { title: "Public protections", text: "Available checks cover HTTPS and visible HTTP protections. Some settings depend on the platform and cannot be changed in the theme.", next: "Identify whether a finding relates to the theme, an app or Shopify before assigning a correction." },
      ],
      example: { title: "A product page with an undescribed image", evidence: "Fictional illustration, no sales measurement\nPage: a public Shopify product page\nFinding: a product image has no alt attribute", action: "Add a useful alternative to the product media and check that the theme renders it. Describe the information conveyed by the image without keyword stuffing.", verify: "Inspect the rendered HTML for that image and review the text in context. Rerun the same URL; a corrected finding does not demonstrate more orders." },
      manualTitle: "Continue in Shopify and along the purchase journey",
      manual: [
        { title: "Theme and apps", text: "Take an inventory in Shopify Admin. Test changes on a theme copy before publishing; a script’s presence does not prove an app causes slow loading." },
        { title: "Cart and checkout", text: "Check adding to cart, shipping costs and payment yourself with appropriate testing tools. Argos places no orders and does not follow an authenticated checkout." },
        { title: "Business results", text: "Compare corrections with store data and customer feedback. Abandonment can also relate to pricing, the offer or delivery, outside the technical diagnosis." },
      ],
      limits: ["No Shopify admin access, exhaustive app inventory or private analysis of theme code.", "No order, payment or signed-in journey testing; a password-protected store needs a different review.", "Argos is an independent tool and claims no Shopify certification or affiliation. No conversion improvement is guaranteed."],
      sources: [{ href: "https://shopify.dev/docs/storefronts/themes/best-practices/performance", label: "Shopify — theme performance best practices" }],
    },
  },
  conversion: {
    fr: {
      metaTitle: "Pourquoi mon site ne convertit pas ? Pistes de diagnostic",
      description: "Peu de demandes ou de ventes ? Distinguez obstacles techniques, offre et mesure de conversion. Un guide concret et un audit de votre page publique.",
      eyebrow: "Comprendre une faible conversion",
      title: "Pourquoi mon site ne convertit pas ?",
      lead: "Des visites sans demandes ni ventes ne suffisent pas à identifier une cause. Vérifiez d’abord ce que vous comptez, puis confrontez les obstacles techniques aux attentes de vos visiteurs.",
      scope: "Argos peut révéler des freins sur une page publique. Son score technique ne mesure pas votre taux de conversion et ne permet pas de conclure pourquoi une personne abandonne.",
      cta: "Chercher les freins techniques de ma page",
      checksTitle: "Trois hypothèses techniques à examiner",
      checks: [
        { title: "La page tarde à devenir lisible", text: "Des mesures de chargement dégradées ou des ressources en échec sont des indices à examiner. Elles ne démontrent pas qu’une vente a été perdue.", next: "Analysez la page d’arrivée, ouvrez les preuves du rapport et reproduisez le chargement sur un téléphone avant de choisir une correction." },
        { title: "Une action est difficile à utiliser", text: "Des contrôles sans nom accessible ou des problèmes de contraste peuvent compliquer l’usage. L’analyse automatique ne réalise pas l’envoi de votre formulaire.", next: "Parcourez la page au clavier, vérifiez les libellés et testez le formulaire jusqu’au message de confirmation avec des données de test." },
        { title: "Des éléments techniques demandent une vérification", text: "Les erreurs observées dans le navigateur et les signaux de sécurité HTTP aident à orienter une recherche. Ils n’évaluent ni la crédibilité de votre offre ni la confiance ressentie.", next: "Reproduisez le défaut, précisez l’action concernée et faites vérifier la correction dans le parcours réel." },
      ],
      example: { title: "Un bouton difficile à identifier", evidence: "Illustration fictive, sans taux de conversion mesuré\nPage : une page de demande de devis\nConstat : un bouton icône n’a pas de nom accessible", action: "Ajoutez un libellé visible précis ou, si l’icône seule est nécessaire, un nom accessible décrivant l’action. Vérifiez également le focus et les erreurs du formulaire.", verify: "Testez au clavier et avec un lecteur d’écran, puis relancez l’audit. La correction retire un obstacle identifié ; son effet commercial reste à mesurer séparément." },
      manualTitle: "Une démarche pour départager les causes possibles",
      manual: [
        { title: "Définir et vérifier la conversion", text: "Choisissez une action : commande confirmée, demande reçue ou rendez-vous réservé. Vérifiez son enregistrement et évitez de confondre un clic avec une action terminée. Comparez des périodes et des populations cohérentes." },
        { title: "Relire la promesse et l’offre", text: "Le public attiré trouve-t-il ce qui était annoncé ? Faites relire l’offre, le prix, les preuves, la livraison et l’action attendue. Ce sont des hypothèses marketing à confronter aux retours de visiteurs." },
        { title: "Observer le parcours", text: "Faites essayer une tâche précise à des personnes représentatives. Notez les hésitations et les blocages sur mobile, sans transformer une observation isolée en règle générale." },
        { title: "Corriger puis comparer", text: "Priorisez un obstacle documenté, vérifiez sa correction et observez les résultats sur des données suffisantes. Tenez compte des changements de trafic, de saison ou d’offre ; un avant/après seul ne prouve pas une causalité." },
      ],
      limits: ["Argos n’accède pas à vos statistiques de fréquentation, commandes ou prospects et ne calcule pas votre taux de conversion.", "Un score élevé peut coexister avec une offre inadaptée ou un suivi de conversion défaillant. Le SEO concerne aussi l’acquisition ; il ne remplace pas l’analyse du parcours.", "Aucun gain de ventes, de contacts ou de conversion n’est garanti. Complétez le rapport par des données métier et une évaluation humaine."],
      sources: [{ href: "https://support.google.com/analytics/answer/9267568?hl=fr", label: "Google Analytics — définir les événements clés" }, { href: "https://www.w3.org/WAI/test-evaluate/tools/", label: "W3C WAI — portée et limites des outils d’évaluation" }],
    },
    en: {
      metaTitle: "Why is my website not converting? Diagnostic steps",
      description: "Few enquiries or sales? Separate technical obstacles, your offer and conversion measurement. Read a practical guide and audit your public page.",
      eyebrow: "Understanding low conversion",
      title: "Why is my website not converting?",
      lead: "Visits without enquiries or sales do not identify a cause on their own. First check what you count, then compare technical obstacles with what visitors expect.",
      scope: "Argos can reveal obstacles on a public page. Its technical score does not measure your conversion rate or explain why an individual abandons a journey.",
      cta: "Find technical obstacles on my page",
      checksTitle: "Three technical hypotheses to investigate",
      checks: [
        { title: "The page takes time to become readable", text: "Poor loading measurements or failed resources are clues to examine. They do not demonstrate a lost sale.", next: "Analyse the landing page, read the report evidence and reproduce loading on a phone before choosing a correction." },
        { title: "An action is difficult to use", text: "Unnamed controls or contrast issues can make a page harder to use. Automated analysis does not submit your form.", next: "Navigate with a keyboard, check labels and test the form through to its confirmation message using test data." },
        { title: "Technical elements need investigation", text: "Observed browser errors and HTTP security signals can guide investigation. They do not assess your offer’s credibility or perceived trust.", next: "Reproduce the issue, identify the affected action and verify the correction in the actual journey." },
      ],
      example: { title: "A button that is difficult to identify", evidence: "Fictional illustration, no conversion rate measured\nPage: a quote request page\nFinding: an icon button has no accessible name", action: "Add a specific visible label or, when an icon alone is needed, an accessible name describing the action. Also check focus and form errors.", verify: "Test with a keyboard and screen reader, then rerun the audit. The correction removes an identified obstacle; its business impact must be measured separately." },
      manualTitle: "A process to distinguish possible causes",
      manual: [
        { title: "Define and verify the conversion", text: "Choose an action: a confirmed order, received enquiry or booked appointment. Check that it is recorded and avoid confusing a click with a completed action. Compare consistent periods and populations." },
        { title: "Review the promise and offer", text: "Does the audience you attract find what was advertised? Review the offer, price, evidence, delivery and expected action. These are marketing hypotheses to compare with visitor feedback." },
        { title: "Observe the journey", text: "Ask representative people to complete a specific task. Record hesitation and obstacles on mobile without turning one observation into a general rule." },
        { title: "Correct, then compare", text: "Prioritise a documented obstacle, verify the correction and observe results with enough data. Account for changes in traffic, season or offer; before/after data alone does not prove causation." },
      ],
      limits: ["Argos does not access your traffic, order or lead statistics and does not calculate your conversion rate.", "A high score can coexist with an unsuitable offer or broken conversion tracking. SEO also relates to acquisition; it does not replace journey analysis.", "No increase in sales, enquiries or conversions is guaranteed. Combine the report with business data and human evaluation."],
      sources: [{ href: "https://support.google.com/analytics/answer/9267568?hl=en", label: "Google Analytics — define key events" }, { href: "https://www.w3.org/WAI/test-evaluate/tools/", label: "W3C WAI — evaluation tools and their limits" }],
    },
  },
};
