export const queueCopy = {
  fr: {
    title: "File d’attente", intro: "Observer les travaux admis et repérer les traitements à vérifier.",
    scope: "Compteurs globaux par unité : les URL d’un lot sont incluses dans les analyses, pas additionnées aux lots. Les découvertes terminées en attente de sélection sont exclues.",
    types: { DISCOVERY: "Découvertes de domaines", BATCH: "Lots de pages", RUN: "Analyses d’URL" },
    type: "Type de tâche", allTypes: "Tous les types", submitted: "Soumission", started: "Démarrage", waiting: "Attente observée", elapsed: "Durée écoulée", notStarted: "Non démarré", unknownStart: "Non renseigné", sinceSubmission: "Depuis la soumission",
    sort: "Trier par", sorts: { oldest: "Soumission la plus ancienne", newest: "Soumission la plus récente", status: "Statut", started: "Démarrage le plus ancien" },
    updated: "Observation du", global: "État global des files", tasks: "Travaux en attente ou en cours", empty: "Aucun traitement ne correspond à ces filtres.",
    hierarchy: "Les URL sont regroupées sous leur lot. Le filtre « Analyses d’URL » affiche aussi les URL des lots.",
    units: "URL sélectionnées", urls: "URL du lot", queued: "en attente", running: "en cours", back: "Retour à la file d’attente", detail: "Détail du traitement", identifiers: "Identifiants techniques", batch: "Lot", run: "Analyse", previous: "Page précédente", page: "Page", period: "Dates de soumission en UTC", unavailable: "Ce traitement n’est plus disponible.",
    help: "Lecture seule. Le statut est une observation, sans garantie d’activité ni délai estimé. Actualisez pour suivre les transitions.",
    threshold: "Le diagnostic « À vérifier » utilise le seuil de reprise des analyses : {minutes} min depuis le démarrage. Un bail expiré concerne la découverte ; la réconciliation concerne les compteurs du lot.",
    diagnostics: { OBSERVED: "État observé", TERMINAL: "Terminé", CANCEL_REQUESTED: "Annulation demandée", INCONSISTENT: "État incohérent à vérifier", LEASE_EXPIRED: "Bail expiré · reprise à vérifier", EXPIRED: "Découverte expirée", RECONCILIATION_PENDING: "Réconciliation du lot attendue", STALE: "À vérifier · seuil de reprise dépassé", REQUEUED: "Remis en file après tentative" },
  },
  en: {
    title: "Processing queue", intro: "Inspect admitted work and identify processing that needs attention.",
    scope: "Global counts use separate units: batch URLs are included in analyses, never added to batches. Completed discoveries awaiting selection are excluded.",
    types: { DISCOVERY: "Domain discoveries", BATCH: "Page batches", RUN: "URL analyses" },
    type: "Task type", allTypes: "All types", submitted: "Submitted", started: "Started", waiting: "Observed wait", elapsed: "Elapsed time", notStarted: "Not started", unknownStart: "Not recorded", sinceSubmission: "Since submission",
    sort: "Sort by", sorts: { oldest: "Oldest submission", newest: "Newest submission", status: "Status", started: "Earliest start" },
    updated: "Observed at", global: "Global queue status", tasks: "Queued or running work", empty: "No processing matches these filters.",
    hierarchy: "URLs are grouped under their batch. The “URL analyses” filter also shows URLs belonging to batches.",
    units: "selected URLs", urls: "Batch URLs", queued: "queued", running: "running", back: "Back to processing queue", detail: "Processing details", identifiers: "Technical identifiers", batch: "Batch", run: "Analysis", previous: "Previous page", page: "Page", period: "Submission dates in UTC", unavailable: "This task is no longer available.",
    help: "Read only. Status is an observation, with no guarantee of activity or estimated completion time. Refresh to follow transitions.",
    threshold: "“Needs attention” uses the analysis recovery threshold: {minutes} min since start. An expired lease concerns discovery; reconciliation concerns batch counts.",
    diagnostics: { OBSERVED: "Observed status", TERMINAL: "Finished", CANCEL_REQUESTED: "Cancellation requested", INCONSISTENT: "Inconsistent state · check required", LEASE_EXPIRED: "Expired lease · check recovery", EXPIRED: "Discovery expired", RECONCILIATION_PENDING: "Batch reconciliation pending", STALE: "Needs attention · recovery threshold exceeded", REQUEUED: "Requeued after an attempt" },
  },
} as const;
export type QueueType = keyof typeof queueCopy.fr.types;
