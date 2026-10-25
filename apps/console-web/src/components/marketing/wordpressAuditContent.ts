import type { DiagnosticContent } from "./diagnosticPages";
import type { Lang } from "@/lib/i18n/routes";

const sources = [
  { href: "https://wordpress.org/documentation/article/settings-reading-screen/", label: "WordPress — Settings → Reading / Search Engine Visibility" },
  { href: "https://learn.wordpress.org/lesson/troubleshooting-your-site-plugin-and-theme-conflicts/", label: "WordPress — Health Check / Troubleshooting" },
  { href: "https://developer.wordpress.org/advanced-administration/performance/optimization/", label: "WordPress — Performance / Optimization" },
];

export const wordpressAuditContent: Record<Lang, DiagnosticContent> = {
  fr: {
    metaTitle: "Audit WordPress : vérifier et corriger une page publique",
    description: "Reliez les constats d’un audit WordPress aux réglages d’indexation, au cache, au thème et aux extensions. Procédures et exemple HTML avant/après.",
    eyebrow: "Guide de diagnostic WordPress",
    title: "Audit WordPress : du constat public au réglage à vérifier",
    lead: "Un noindex inattendu, une description qui ne change pas ou une bannière lente : partez du HTML reçu par un visiteur, puis remontez au réglage WordPress concerné. Ce guide vous aide à choisir une vérification et à valider sa correction.",
    scope: "Choisissez une page de service, un article et, si nécessaire, une fiche WooCommerce. Notez les URL, le thème, les extensions concernées, la date et l’état du cache. Les opérations dans l’administration sont à réaliser par vous ou votre prestataire ; Argos observe uniquement une URL publique à la fois, sans accès wp-admin ni extension à installer.",
    cta: "Analyser ma page WordPress",
    checksTitle: "Quatre constats, quatre procédures WordPress",
    checks: [
      {
        title: "Une page destinée à Google contient noindex",
        text: "Ouvrez le code source de l’URL en visiteur non connecté et recherchez meta robots. Examinez aussi X-Robots-Tag dans les en-têtes. Conservez la directive exacte et l’URL finale : un réglage d’administration seul ne décrit pas la réponse reçue.",
        next: "Dans Réglages → Lecture, contrôlez « Demander aux moteurs de recherche de ne pas indexer ce site ». Si l’exclusion est involontaire, corrigez-la ; vérifiez ensuite le réglage de la page dans l’extension SEO, le thème et la configuration serveur. Purgez les caches concernés et relisez la réponse anonyme. Gardez les exclusions voulues, notamment en préproduction. La disparition de noindex ne garantit pas l’indexation.",
        link: { href: "/analyse-seo-page", label: "Identifier les signaux SEO dans la réponse publique" },
      },
      {
        title: "La description enregistrée ne s’affiche pas",
        text: "Comparez la meta description dans le HTML initial avec la valeur enregistrée pour cette même page. Vérifiez l’URL finale, la langue et l’existence de plusieurs balises avant de conclure à un cache périmé.",
        next: "Enregistrez la page, puis identifiez les couches actives : extension de cache, hébergement et CDN. Purgez l’URL concernée avec votre prestataire et rechargez en visiteur non connecté. Si l’écart persiste, examinez quel thème ou quelle extension produit la balise ; ne cumulez pas deux producteurs SEO. Validez le texte dans une réponse fraîche plutôt que dans l’aperçu de l’éditeur.",
        link: { href: "#example-title", label: "Suivre l’exemple de description périmée ci-dessous" },
      },
      {
        title: "La bannière principale apparaît tard",
        text: "Identifiez l’élément LCP dans la trace navigateur avant de toucher aux images. Notez sa requête, ses dimensions et l’éventuel chargement différé. Une image lourde, un HTML tardif et un élément caché par un script appellent des corrections différentes.",
        next: "Retrouvez le bloc ou le modèle du thème qui affiche cette image. Sur une préproduction, testez une taille adaptée et, si cette image est bien le LCP, sa découverte dans le HTML initial sans lazy loading. Comparez plusieurs chargements avec les mêmes conditions et le même état de cache. N’appliquez pas cette priorité à toutes les images.",
        link: { href: "/guides/lcp-lent#diagnostic", label: "Diagnostiquer le délai LCP et comparer avant/après" },
      },
      {
        title: "Une extension ou le thème semble impliqué",
        text: "Un chemin de script contenant wp-content/plugins constitue une piste, pas la preuve d’un conflit ni un inventaire complet. Décrivez d’abord le défaut reproductible : page, action, message et résultat attendu.",
        next: "Sur une copie de préproduction sauvegardée, comparez le défaut avec un thème de référence et réactivez les extensions une à une. Le mode dépannage de Health Check ne change que votre session : un audit public non connecté ne voit pas ce même état. Pour comparer dans Argos, utilisez une préproduction publiquement accessible avec une configuration contrôlée, sans données privées et exclue de l’indexation.",
        link: { href: "/ressources/audit-technique-gratuit", label: "Comprendre le périmètre de l’analyse automatique" },
      },
    ],
    example: {
      title: "Exemple avant/après : une description servie par un ancien cache",
      evidence: "Scénario fictif, sans installation WordPress ni mesure client\nURL : https://atelier.example/services/\nValeur enregistrée : Réparation de vélos à Nantes, sur rendez-vous.\nHTML reçu par le visiteur :\n<meta name=\"description\" content=\"Bienvenue sur notre site.\">",
      action: "Dans ce scénario, la même URL sert une ancienne version. Après avoir vérifié la langue et le producteur de la balise, purgez son cache de page puis celui du CDN s’il est actif. Cette illustration ne prouve pas que le cache est la cause sur votre site.",
      after: "Réponse attendue après correction — illustration\n<meta name=\"description\" content=\"Réparation de vélos à Nantes, sur rendez-vous.\">",
      verify: "Refaites une requête anonyme sur l’URL finale, comparez le HTML initial et vérifiez qu’une seule description correspond au service visible. Conservez les réponses avant/après et rejouez le contrôle après réchauffement du cache. Google peut choisir un autre extrait dans ses résultats.",
    },
    manualTitle: "Terminer l’audit dans WordPress",
    manual: [
      { title: "Rendre les corrections vérifiables", text: "Pour chaque constat, transmettez l’URL, les étapes, la preuve avant correction, le composant modifié et le résultat attendu. Contrôlez le HTML et le parcours après publication ; une modification enregistrée n’est pas forcément celle servie au visiteur." },
      { title: "Vérifier les médias et les formulaires", text: "Contrôlez le texte alternatif du bloc réellement affiché : une valeur de médiathèque peut ne pas être reprise par le thème. Testez les noms des champs, le focus et la confirmation du formulaire au clavier. Vérifiez séparément la réception des demandes avec des données de test.", link: { href: "/guides/checklist-audit-site-web#accessibilite", label: "Rejouer les contrôles d’accessibilité du parcours" } },
      { title: "Confier la maintenance aux personnes disposant des accès", text: "Vérifiez les mises à jour et la restauration d’une sauvegarde dans un environnement adapté. Pour HTTPS et les en-têtes, précisez ce qui dépend de l’hébergeur, du serveur ou d’une extension. Une analyse publique ne contrôle ni vos sauvegardes ni toutes les vulnérabilités." },
    ],
    limits: ["Pas de scan exhaustif des extensions, versions ou failles ; pas d’analyse de la base de données ni de wp-admin. La détection WordPress reste un indice probable.", "Une seule URL à un instant donné. Un module indisponible n’est pas un contrôle réussi. Un constat public ne désigne pas automatiquement le thème, l’extension ou l’hébergeur responsable.", "Les corrections demandent une validation humaine et des accès appropriés. Aucun classement SEO ni gain commercial n’est garanti."],
    sources,
  },
  en: {
    metaTitle: "WordPress audit: check and fix a public page",
    description: "Connect WordPress audit findings to indexing settings, caching, themes and plugins. Follow practical checks and a before/after HTML example.",
    eyebrow: "WordPress diagnostic guide",
    title: "WordPress audit: from public evidence to the setting to check",
    lead: "An unexpected noindex, an unchanged description or a slow banner: start with the HTML a visitor receives, then trace it to the relevant WordPress setting. This guide helps you choose a check and verify the correction.",
    scope: "Choose a service page, a post and, if relevant, a WooCommerce product. Record URLs, theme, relevant plugins, date and cache state. You or your developer carry out admin operations; Argos observes one public URL at a time, with no wp-admin access or plugin to install.",
    cta: "Analyse my WordPress page",
    checksTitle: "Four findings, four WordPress procedures",
    checks: [
      {
        title: "A page intended for Google contains noindex",
        text: "View the URL’s source as a signed-out visitor and find meta robots. Also inspect X-Robots-Tag in response headers. Keep the exact directive and final URL: an admin setting alone does not describe the response delivered.",
        next: "In Settings → Reading, check “Discourage search engines from indexing this site”. Correct it if the exclusion is unintended; then review the page setting in your SEO plugin, theme and server configuration. Purge the relevant caches and reread the anonymous response. Keep intentional exclusions, including on staging. Removing noindex does not guarantee indexing.",
        link: { href: "/analyse-seo-page", label: "Identify SEO signals in the public response" },
      },
      {
        title: "The saved description does not appear",
        text: "Compare the meta description in the initial HTML with the saved value for that same page. Check the final URL, language and duplicate tags before concluding that the cache is stale.",
        next: "Save the page and identify active layers: cache plugin, hosting and CDN. Purge the affected URL with your developer and reload as a signed-out visitor. If the mismatch remains, identify which theme or plugin generates the tag; avoid two competing SEO generators. Verify the text in a fresh response rather than the editor preview.",
        link: { href: "#example-title", label: "Follow the stale-description example below" },
      },
      {
        title: "The main banner appears late",
        text: "Identify the LCP element in a browser trace before changing images. Record its request, dimensions and any deferred loading. A large image, late HTML and an element hidden by a script need different fixes.",
        next: "Find the block or theme template rendering that image. In staging, test appropriate dimensions and, if this image is the LCP, discovery in the initial HTML without lazy loading. Compare repeated loads with the same conditions and cache state. Do not give every image this priority.",
        link: { href: "/guides/lcp-lent#diagnostic", label: "Diagnose LCP delay and compare before/after" },
      },
      {
        title: "A plugin or the theme seems involved",
        text: "A script path containing wp-content/plugins is a lead, not proof of a conflict or a complete inventory. First describe a reproducible failure: page, action, message and expected result.",
        next: "On a backed-up staging copy, compare the failure with a reference theme and reactivate plugins one at a time. Health Check troubleshooting mode changes only your session: a signed-out public audit cannot see that same state. For an Argos comparison, use publicly reachable staging with a controlled configuration, no private data and indexing excluded.",
        link: { href: "/ressources/audit-technique-gratuit", label: "Understand the scope of automated analysis" },
      },
    ],
    example: {
      title: "Before/after example: a description served from an old cache",
      evidence: "Fictional scenario, no WordPress installation or customer measurement\nURL: https://atelier.example/services/\nSaved value: Bicycle repairs in Nantes, by appointment.\nHTML received by the visitor:\n<meta name=\"description\" content=\"Welcome to our website.\">",
      action: "In this scenario, the same URL serves an old version. After checking the language and tag generator, purge its page cache and CDN cache if active. This illustration does not establish caching as the cause on your site.",
      after: "Expected response after correction — illustration\n<meta name=\"description\" content=\"Bicycle repairs in Nantes, by appointment.\">",
      verify: "Make a new anonymous request to the final URL, compare the initial HTML and check that one description matches the visible service. Keep before/after responses and repeat after the cache warms. Google may choose a different search snippet.",
    },
    manualTitle: "Complete the audit inside WordPress",
    manual: [
      { title: "Make corrections verifiable", text: "For each finding, share the URL, steps, evidence before the fix, changed component and expected result. Check HTML and the journey after publishing; a saved edit is not necessarily what visitors receive." },
      { title: "Check media and forms", text: "Inspect alternative text in the block actually displayed: a media-library value may not be used by the theme. Test field names, focus and form confirmation by keyboard. Separately verify delivery of enquiries with test data.", link: { href: "/guides/checklist-audit-site-web#accessibilite", label: "Repeat the journey’s accessibility checks" } },
      { title: "Assign maintenance to people with appropriate access", text: "Verify updates and backup restoration in a suitable environment. For HTTPS and headers, identify what depends on the host, server or a plugin. A public analysis checks neither your backups nor every vulnerability." },
    ],
    limits: ["No exhaustive scan of plugins, versions or vulnerabilities; no database or wp-admin analysis. WordPress detection remains a probable indication.", "One URL at one point in time. An unavailable module is not a passed check. Public evidence does not automatically identify the responsible theme, plugin or host.", "Corrections need human review and appropriate access. No SEO ranking or business improvement is guaranteed."],
    sources,
  },
};
