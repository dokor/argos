# Règles fonctionnelles et calculs

## FUN-01 — Périmètre et identité

Un compte gère ses sites, ses URL, ses découvertes, ses lots et ses runs.
Un hostname technique peut être partagé dans le moteur, jamais les données
privées de deux propriétaires. Les URL utilisent le normaliseur existant ;
ne pas retirer arbitrairement une query significative pour dédupliquer.
Un domaine connecté est identifié par propriétaire + hôte normalisé exact.
Une URL rencontrée dans plusieurs lots est comptée une seule fois dans les
projections du compte, avec sa dernière tentative par date puis ID stable.

## FUN-02 — Trois KPI utiles, même source que les listes

| KPI | Définition | Clic |
|---|---|---|
| URL prioritaires | Nombre d’URL distinctes dont la **dernière tentative** contient au moins un constat mesuré critique ou important | Liste de ces URL, avec domaine et run exact |
| URL sans diagnostic complet | Nombre d’URL distinctes jamais analysées ou dont la dernière tentative est terminale partielle, échouée ou annulée | Liste avec cause et lancement/relance |
| Crédits disponibles | `max(0, limit − used − reserved)` pour la période ; « Illimité » si limit=null | Usage et réservations |

Une URL peut être prioritaire ET incomplète. Les tentatives en cours ont un
bloc de suivi séparé. Une tentative échouée sans résultat est **inconnue**,
pas saine et pas prioritaire sur la base d’un vieux rapport. Le dernier rapport
disponible reste accessible, avec sa date et un libellé distinct. Ne pas
additionner les deux KPI comme des populations disjointes. Pas de moyenne
globale entre sites ou domaine.

Le dashboard expose la date de mise à jour et le périmètre « dernière tentative
par URL ». Sa liste filtrée et ses KPI viennent de la même projection serveur.
Fixture attendue : 15 URL / 9 prioritaires / 3 incomplètes / 68 crédits.

## FUN-03 — Statuts, score et couverture

Séparer `executionStatus` (QUEUED/RUNNING/COMPLETED/FAILED/CANCELED),
`completeness` (FULL/PARTIAL/NONE/UNKNOWN) et qualité de mesure/score.
Un rapport partiel peut être publié et contenir un score qualifié/provisoire.
Un module terminé peut n’avoir rien mesuré. Le pourcentage de modules terminés
n’est pas la couverture pondérée. Afficher modules, contrôles manquants et
motifs ; ne jamais convertir absent/inconnu/non applicable en zéro ou succès.

Les règles du moteur et les versions persistées prévalent :
[couverture](../scoring/measurement-coverage.md),
[comparaison](../scoring/audit-comparison.md). La cible actuelle est V12 et
weighted-coverage-v3 à l’inventaire, pas une version codée en dur dans l’UI.

## FUN-04 — Synthèse d’un lot de domaine

La synthèse porte **uniquement sur le lot sélectionné**, pas un mélange de
rapports historiques. Elle affiche hôte, démarrage/fin, profil réel, limites,
pages découvertes/retenues/exclues, complètes/partielles/échouées/annulées et
en cours. Toute troncature de découverte est visible.

Un problème commun = même `ruleKey` stable + version de définition compatible,
échoué sur au moins **deux pages distinctes** du lot. Plusieurs occurrences
sur une page comptent pour une page ; les occurrences restent détaillées dans
le rapport. Pas de regroupement par texte traduit ni de fusion de règles
différentes « qui se ressemblent ». Une catégorie canonique par règle ;
provenance technique séparée.

Pour chaque problème, fournir gravité, description, impact, piste de correction,
`affectedPages`, `evaluatedPages` et `selectedPages`. Le dénominateur évalué
comprend seulement les pages ayant réellement PASS/FAIL pour **cette règle**.
Les résultats indisponibles/non applicables sont exclus du dénominateur et
expliqués. Afficher par exemple « 6 pages touchées sur 7 évaluées · 8 retenues ».
Ne pas prétendre qu’une correction commune résoudra toutes les occurrences
sans preuve de cause commune. Les listes d’URL sont paginées, les compteurs non.

Ordre des problèmes : nombre de pages affectées décroissant, gravité maximale,
puis ruleKey. Une page issue d’un échec sans rapport ne crée aucun constat.
Fixture Atelier Nova : 3 problèmes communs — CSP 6/7, images 4/7, labels 3/7.

## FUN-05 — Pages les plus problématiques

Classer d’abord par nombre de constats critiques décroissant, puis importants
décroissant, puis URL normalisée ascendante pour un ordre stable. Un score
n’est qu’un départage optionnel **si les mesures sont comparables** ; la V1
utilise le tri précédent sans score. Ne pas faire remonter un zéro artificiel
d’échec au-dessus de constats avérés. Les pages sans mesure apparaissent dans
« Analyses incomplètes », accessible au même niveau.

La table affiche URL, exécution/complétude, score qualifié ou absence, compteurs
critiques/importants, modules/couverture et accès au run exact. Filtrage par
règle, gravité, statut et recherche URL ; tri appliqué avant pagination.
Au clic, le contexte du lot et du filtre est conservé. Les preuves affichées
sont réellement collectées, bornées et assainies (dépendance #538).

## FUN-06 — Découverte et sélection

Hôte exact, http(s), ports 80/443, exclusions de chemins explicites ; robots
respecté en V1, sitemap soumis aux mêmes contrôles de sécurité et de volume.
Valeurs techniques initiales : 50 URL, profondeur 3, durée 60 s, 2 requêtes
concurrentes/hôte ; 1 découverte active/compte. Le serveur retourne les
limites effectives. Hôte externe/sous-domaine exclu et indiqué, jamais suivi
implicitement. Dédupliquer, borner corps/liens/redirections et conserver les
raisons d’exclusion. Découverte sans exécution du moteur d’audit ni crédit.

Le résultat découvert est un snapshot privé expirant après 24 h (proposition
technique). Sélectionner 1–50 URL autorisées du snapshot. Afficher N pages = N
crédits réservés, disponible avant/après. L’admission revérifie propriétaire,
expiration, sélection, validations SSRF et quota ; l’aperçu n’est pas un devis
garanti. Changement de quota : refus explicite, sélection conservée.

## FUN-07 — Quotas et relances

Réserver atomiquement à l’admission. Compter à la publication durable du rapport
(même partiel), libérer si le run termine sans rapport. Worker/requête rejouée
avec même clé n’ajoute rien ; une **relance utilisateur** est un nouveau run,
un nouveau coût et une nouvelle clé. Un lot réserve toutes ses pages ou aucune.

Le mois est celui de publication dans le fuseau configuré, UTC par défaut.
Les réservations actives traversent le changement de période ; elles sont
honorées même si une ancienne admission fait dépasser ultérieurement le plafond.
Ne pas effacer les réservations au premier du mois. Les admissions suivantes
sont bloquées si nécessaire. Plafond null = illimité ; 0 = aucune admission.

L’annulation libère immédiatement les enfants encore en attente via transition
atomique. Pour un enfant en cours, conserver la réservation jusqu’au terminal :
la course publication/annulation a un seul gagnant. Un rapport déjà publié
reste facturé. Afficher le coût final et les crédits libérés, pas « tout remboursé ».

## FUN-08 — Compte et administration

Réutiliser la politique d’authentification, sessions et OAuth existante ;
conserver les protections de dernière méthode et réauthentification récente.
La fermeture utilisateur archive le compte selon la politique existante,
révoque les sessions et empêche les nouveaux lancements ; ne pas annoncer un
effacement physique immédiat si ce n’est pas le contrat réalisé.

L’offre n’est pas le rôle. L’admin peut modifier offre/plafond effectifs d’un
utilisateur standard ou de son propre compte, jamais d’un autre ADMIN, avec
version attendue, motif contrôlé et confirmation.
Refuser un plafond fini inférieur à utilisés+réservés, sous verrou. Journal
append-only auteur/cible/date/motif/avant/après, pas de mot de passe/token/texte
libre. Les valeurs du catalogue d’offres viennent du serveur.

Suspendre un compte standard révoque ses sessions et bloque nouvelles demandes
et renouvellements. Les jobs déjà admis finissent selon leur réservation ;
aucune annulation ou restitution implicite. Interdit sur soi et sur tout ADMIN.
Réactiver n’ouvre pas une session automatiquement. Pas de changement de rôle,
impersonation, paiement, équipes ou gestion multi-clients dans ce lot.
