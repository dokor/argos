export const analyticsCopy = {
  fr: {
    title: "Mesure produit", back: "Retour à l’administration", intro: "Uniquement les audits créés après accord explicite. Une ligne correspond à une analyse, jamais à une personne. Les états sont actualisés ; les cohortes récentes restent incomplètes.",
    period: "Période glissante UTC", days: "jours", refresh: "Actualiser", loading: "Chargement…", error: "Métriques indisponibles. Réessayez.", denied: "Un compte Argos administrateur vérifié est nécessaire.", signIn: "Se connecter", unavailable: "Indisponible",
    collection: "Collecte", enabled: "autorisée côté backend", disabled: "désactivée côté backend", cap: "Échantillon limité aux 100 000 analyses les plus anciennes de cette période.", cohort: "Cohorte des audits consentis",
    counts: { accepted: "Créés", started: "Démarrés", completed: "Terminés", failed: "Échoués", pending: "En attente / en cours", viewed: "Rapports affichés", completedViewed: "Terminés et affichés" },
    dedup: "Les rapports affichés sont dédupliqués par analyse, même après un rafraîchissement. Aucune conversion visite → rapport ni amélioration causale n’est déduite.",
    delays: "Délais", measure: "Mesure", sample: "Échantillon", excluded: "Exclus", median: "Médiane", queue: "File", processing: "Traitement", total: "Création → fin", table: "Tableau de mesures",
    delayHelp: "Traitement et création → fin : uniquement les analyses terminées. Dates absentes ou inversées exclues. Percentiles par rang le plus proche, sans interpolation.",
    sources: "Sources", source: "Page / langue / emplacement", events: "Événements publics", emptySources: "Aucune source pour cette période.", emptyEvents: "Aucun événement pour cette période.",
    eventHelp: "Compteurs d’affichages et de clics, sans identifiant de visiteur. Jours calendaires UTC couvrant la période demandée, distincts de la cohorte glissante des analyses.",
  },
  en: {
    title: "Product measurement", back: "Back to administration", intro: "Only audits created after explicit consent. Each row represents an analysis, never a person. States are updated; recent cohorts remain incomplete.",
    period: "Rolling UTC period", days: "days", refresh: "Refresh", loading: "Loading…", error: "Metrics are unavailable. Try again.", denied: "A verified Argos administrator account is required.", signIn: "Sign in", unavailable: "Unavailable",
    collection: "Collection", enabled: "enabled on the backend", disabled: "disabled on the backend", cap: "Sample limited to the oldest 100,000 analyses in this period.", cohort: "Consented audit cohort",
    counts: { accepted: "Created", started: "Started", completed: "Completed", failed: "Failed", pending: "Queued / running", viewed: "Reports viewed", completedViewed: "Completed and viewed" },
    dedup: "Report views are deduplicated per analysis, including after refresh. No visit → report conversion or causal improvement is inferred.",
    delays: "Delays", measure: "Measure", sample: "Sample", excluded: "Excluded", median: "Median", queue: "Queue", processing: "Processing", total: "Creation → completion", table: "Measurement table",
    delayHelp: "Processing and creation → completion: completed analyses only. Missing or reversed dates are excluded. Nearest-rank percentiles, without interpolation.",
    sources: "Sources", source: "Page / language / placement", events: "Public events", emptySources: "No sources for this period.", emptyEvents: "No events for this period.",
    eventHelp: "View and click counts, without visitor identifiers. UTC calendar days covering the requested period, separate from the rolling analysis cohort.",
  },
};
