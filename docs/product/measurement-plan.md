# Plan de mesure produit — #42, lot 1

Préparé le 10 octobre 2026. Responsable proposé : opérateur Argos (Antoine LE LOUËT), qualification et choix d'outil restant à valider. Aucune collecte nouvelle n'est activée par cette PR. La collecte désactivée constitue le fonctionnement par défaut et conserve tout le parcours d'audit.

## Dictionnaire et cardinalité

| Événement | Déclencheur de référence | Propriétés permises | Déduplication prévue |
|---|---|---|---|
| public_page_view | Chargement d'une route éditoriale publiée | route issue du catalogue local, langue FR/EN | Une fois par navigation ; ne représente pas un visiteur unique |
| example_open | Navigation vers l'exemple | langue, origine bornée home/nav/footer/resources | Une fois par navigation, distinct du clic |
| audit_cta_click | Action explicite sur un accès au formulaire | route, langue, placement hero/nav/body/final | Une fois par activation ; un clic n'est pas une soumission |
| audit_submission_accepted | Réponse réussie du BFF après création | route/placement validés, langue | Émission serveur après succès ; unicité interne par run, jamais identifiant de run dans l'analytics |
| audit_submission_rejected | Refus effectif BFF | route, langue, catégorie invalid_url/rate_limit/unavailable/unknown | Une tentative ; retry = nouvelle tentative, pas un nouveau succès |
| audit_finished | Transition atomique vers COMPLETED | état terminal, bucket de durée et de couverture | Unicité interne run/événement, indépendamment du polling ou navigateur fermé |
| audit_failed | Transition atomique vers FAILED | catégorie d'échec bornée | Même unicité terminale |
| report_view | Rapport chargé et effectivement affiché | langue, type complete/partial | À définir : observation mémoire par visite tant qu'aucun mécanisme de déduplication qualifié n'est choisi ; jamais compter un poll comme une vue |

Événements d'audit issus du serveur ; affichage et clics issus du client. Les dimensions restent une liste fermée, pas des chaînes issues de la saisie ou de services tiers. Les événements invalides et propriétés inconnues doivent être rejetés par un schéma allowlist. Une erreur de collecte ne bloque aucune fonctionnalité.

Interdits dans payload, URL de collecte, logs et outils : token ou hash du token, runId/auditId exportés, chemin `/report/{token}`, URL/hostname audités, query/referrer libre, email, IP persistée, preuve ou résultat privé, contenu d'erreur brut, identifiant client stable ou fingerprint. Les identifiants internes nécessaires à l'unicité restent dans le système opérationnel autorisé ; leur export ne rend pas une donnée anonyme.

## Délais et dénominateurs

Mesures serveur : file = started_at − created_at ; traitement = finished_at − started_at ; bout en bout technique = publication effective − created_at. Les timestamps absents/incohérents sont exclus de la distribution et comptés séparément ; QUEUED sans fin est un audit encore en attente, pas un succès. L'affichage navigateur dépend en plus du réseau et de la présence de l'utilisateur.

Publier médiane, p90 et p95, période UTC explicite, effectif valide/exclusions, taux de modules indisponibles et proportion d'échecs. Ne pas présenter une moyenne des budgets de modules comme un délai réel. #376 reste sans durée annoncée tant que ces séries sont indisponibles.

Conversion technique = audits terminés / soumissions acceptées dans une cohorte de création arrivée à maturité (indiquer fenêtre et audits encore en cours). Taux de refus = tentatives refusées / tentatives reçues. Consultations / audits terminés n'est pas un taux individuel sans déduplication fiable. Visites → rapport et abandon individuel ne sont pas mesurables par de simples compteurs : ne pas les publier sans mécanisme d'attribution qualifié. Un navigateur fermé ne prouve pas un abandon. Distinguer échec métier, collecte perdue, refus de collecte et utilisateurs exclus.

## Conditions avant instrumentation

Le fournisseur, le stockage, la base de collecte, l'exemption éventuelle et la durée effective ne sont pas déterminés. Proposition à qualifier : compteur agrégé first-party et sans suivi individuel ; agrégats journaliers 90 jours pour un bilan avant/après, événements bruts évités ; ce sont des cibles, pas une déclaration de fonctionnement actuel. Aucune option payante, cookie de mesure, collecte tiers ni localStorage ajouté.

L'[exemption CNIL pour la mesure d'audience](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience), consultée le 10 octobre 2026, dépend des finalités et de la configuration concrète ; un outil sans cookie n'est pas automatiquement exempt. Si consentement nécessaire : ne rien collecter avant accord ; mode refus identique fonctionnellement ; documenter changement/révocation. Mettre à jour #384 et les formulations publiques avant activation. Décision signée par opérateur, durée et purge vérifiées, puis implantation seulement.

## Lot 2 et recette à livrer

Instrumenter les transitions serveur avec unicité transactionnelle, puis navigation/CTA bornés et affichage. Tester retries, refresh, StrictMode, polling, double clic, fermeture navigateur, erreur et refus de collecte ; vérifier absence de données privées dans les requêtes et journaux. Contrôler le mécanisme de purge avec une fixture à durée écoulée. Bilan 28 jours avant/après à effectifs comparables, saisonnalité et incertitudes explicites ; aucune causalité revendiquée sur une variation brute. Search Console complète pages/requêtes sans transmettre de résultats d'audit. #350 reste la mesure des présentations externes.

Le ticket #42 reste ouvert pour ces décisions et le lot 2. Ce plan permet les contenus de #373 sans faire passer une instrumentation projetée pour un outil déjà en production.


## Implémentation du 11 octobre 2026
Le dictionnaire, les fenêtres, limites et consentement réellement implémentés sont décrits dans [product-analytics.md](product-analytics.md). Collecte interne désactivée par défaut ; aucune baseline réelle ni Search Console disponible. Responsable : Antoine Le Louët. Aucun gain annoncé.
