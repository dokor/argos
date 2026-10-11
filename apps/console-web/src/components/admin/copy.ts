export const copy = {
 fr: {
 title:"Administration", intro:"Comptes, consommation et suivi des analyses.", users:"Utilisateurs", runs:"Analyses", events:"Journal des modifications",
 queued:"En attente", running:"En cours", queueHelp:"Volumes globaux, toutes dates et tous utilisateurs. Actualisation manuelle.",
 refresh:"Actualiser", loading:"Chargement…", denied:"Un compte Argos administrateur vérifié est nécessaire.", error:"Le service est indisponible. Réessayez.", empty:"Aucun résultat pour ces filtres.",
 search:"Nom ou email", state:"État", offer:"Offre", all:"Tous", apply:"Appliquer les filtres", next:"Page suivante", first:"Première page", profile:"Consulter", user:"Utilisateur", site:"Site (nom d’hôte exact)", status:"Statut", from:"Depuis (UTC)", until:"Jusqu’au (UTC)", anonymous:"Anonyme",
 date:"Date", actions:"Actions", detail:"Détail", report:"Ouvrir le rapport", back:"Retour à l’administration", used:"Rapports produits ce mois", reserved:"Analyses réservées", limit:"Plafond effectif", unlimited:"Sans plafond", reset:"Prochaine remise à zéro", override:"Plafond individuel", inherit:"Vide : utiliser le plafond de l’offre. Zéro interdit les nouveaux lancements.",
 save:"Enregistrer", confirm:"Je confirme cette modification d’offre et de plafond.", saved:"Modification enregistrée et journalisée.", unchanged:"Aucune modification nécessaire.", recent:"Reconnectez-vous avant de modifier une offre ou un plafond.", signIn:"Se connecter", close:"Fermer", actor:"Auteur", target:"Cible", change:"Offre / plafond individuel", defaultLimit:"Selon l’offre", failed:"L’analyse a échoué. Les états des modules sont disponibles ci-dessous.", attempts:"Tentatives", modules:"Modules", unavailable:"Ce rapport est absent ou a expiré.", invalid:"Vérifiez les filtres et les valeurs saisis.", archived:"Les comptes archivés ne peuvent pas être modifiés.", adminTarget:"La modification d’un autre administrateur n’est pas autorisée.",
 statuses:{ACTIVE:"Actif",PENDING:"À vérifier",ARCHIVED:"Archivé",USER:"Utilisateur",ADMIN:"Administrateur",QUEUED:"En attente",RUNNING:"En cours",COMPLETED:"Terminé",FAILED:"Échec",SKIPPED:"Ignoré",TIMEOUT:"Délai dépassé"}
 },
 en: {
 title:"Administration", intro:"Accounts, usage and analysis monitoring.", users:"Users", runs:"Analyses", events:"Change log",
 queued:"Queued", running:"Running", queueHelp:"Global volumes across all dates and users. Refresh manually.",
 refresh:"Refresh", loading:"Loading…", denied:"A verified Argos administrator account is required.", error:"The service is unavailable. Try again.", empty:"No results match these filters.",
 search:"Name or email", state:"State", offer:"Offer", all:"All", apply:"Apply filters", next:"Next page", first:"First page", profile:"View", user:"User", site:"Site (exact hostname)", status:"Status", from:"From (UTC)", until:"Through (UTC)", anonymous:"Anonymous",
 date:"Date", actions:"Actions", detail:"Details", report:"Open report", back:"Back to administration", used:"Reports produced this month", reserved:"Reserved analyses", limit:"Effective limit", unlimited:"Unlimited", reset:"Next reset", override:"Individual limit", inherit:"Leave empty to use the offer limit. Zero prevents new launches.",
 save:"Save", confirm:"I confirm this offer and limit change.", saved:"Change saved and logged.", unchanged:"No change needed.", recent:"Sign in again before changing an offer or limit.", signIn:"Sign in", close:"Close", actor:"Actor", target:"Target", change:"Offer / individual limit", defaultLimit:"Offer default", failed:"The analysis failed. Module states are shown below.", attempts:"Attempts", modules:"Modules", unavailable:"This report is missing or expired.", invalid:"Check the filters and values entered.", archived:"Archived accounts cannot be changed.", adminTarget:"Changes to another administrator are not permitted.",
 statuses:{ACTIVE:"Active",PENDING:"Unverified",ARCHIVED:"Archived",USER:"User",ADMIN:"Administrator",QUEUED:"Queued",RUNNING:"Running",COMPLETED:"Completed",FAILED:"Failed",SKIPPED:"Skipped",TIMEOUT:"Timed out"}
 }
};
export type AdminCopy = typeof copy.fr;
