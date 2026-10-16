# Recette #658 / #659 / #662 — 16 octobre 2026

La recette utilise exclusivement les données fictives du backend local en
lecture seule, jamais les rapports d'un utilisateur. Script reproductible :
`scripts/e2e/notifications-traffic.mjs`, avec le frontend sur localhost:3042 et
`ARGOS_PREVIEW_PORT=3043` / `API_BASE=http://127.0.0.1:3043` pour les fixtures.
Les deux drapeaux de mesure et un credential fictif sont configurés uniquement
sur les processus locaux, afin d'examiner la gestion du consentement.

Matrice : 320, 390, 768 et 1280 px ; FR/EN ; clair/sombre, soit 16 combinaisons.
Parcours : Administration → Statistiques → Trafic, regroupement par mois,
compteurs, listes ; ouverture de la cloche et badge, distinctions lu/non lu,
liens et retour du focus avec Échap ; saisie de domaine vide avec label et
exemple ; préférences mobiles avec cases non cochées et refus, sans marqueur de
visite. Aucune erreur JavaScript ni débordement horizontal de page détecté.
Les tableaux à trois colonnes défilent dans leur conteneur ; les tableaux à deux
colonnes gardent leurs valeurs visibles sur mobile. Captures dans
`outputs/ui-review/`, données et matrice dans `notifications-traffic.json`.

Tests de composants : historique silencieux, nouvel événement et polling
dédupliqué, rafales silencieuses, lecture individuelle/globale, chargement/vide/
erreur, badge, navigation, filtre de période, refus/granularité/retrait, absence
de collecte privée ou avant consentement. Les tests du proxy vérifient CSRF,
credential de session et rejet d'un propriétaire fourni dans le corps.

Tests MariaDB réels dans la CI : publication avant/après transition terminale,
rollback atomique, idempotence, lecture isolée par propriétaire et curseur,
rétention, absence de notification par URL d'un lot, stockage des compteurs
audience séparé de la mesure produit, migration et redémarrage. La revue
visuelle n'établit pas à elle seule une conformité WCAG ni une validation de la
configuration des prestataires ou sauvegardes en production.
