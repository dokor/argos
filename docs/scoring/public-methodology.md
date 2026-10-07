# Maintenance de la page « Méthode du score »

La route publique `/methodologie-score` décrit la policy active `DefaultScorePolicy`
(v11 lors de l'issue #300) et le calcul de `ScoreService`. Les rapports historiques
gardent leur version et leur empreinte de scoring.

Lors d'une modification de `DefaultScorePolicy.VERSION`, de ses poids, de
`ScoreService` ou de `MeasurementCoverageService` :

1. Mettre à jour la version et les explications dans
   `apps/console-web/src/app/methodologie-score/page.tsx`.
2. Recalculer l'exemple à partir des clés et poids du catalogue actif ;
   vérifier les cas de module et de domaine indisponibles.
3. Vérifier que titre, description et sources externes restent exacts, puis
   relancer le build frontend et contrôler le HTML pré-rendu.

Avant de figer une nouvelle formulation SEO du titre et du H1, confronter les
hypothèses de mots-clés de l'issue #300 aux requêtes Search Console réelles.
Aucun volume de recherche n'a été supposé pour la version initiale.

L'exemple public de rapport prévu par l'issue #69 n'a pas encore de route.
À sa publication, ajouter un lien réciproque entre ce rapport et la méthodologie.
Une éventuelle version anglaise de la méthode devra avoir sa propre URL,
ses métadonnées et son `lang` dans le HTML initial.
