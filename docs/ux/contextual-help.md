# Aide contextuelle et retours — #665 / #666

Direction : conserver les intitulés explicites et les décisions visibles ; réserver
le survol aux définitions courtes. Les textes FR/EN sont mutualisés dans
`components/ui/ContextHelp.tsx` et `components/feedback/copy.ts`.

## Inventaire et arbitrage

| Priorité / audience | Écran → élément | Texte / aide retenue |
| --- | --- | --- |
| P1, tous | Progression → statut global et modules | Tooltip sur les badges `ExecutionStatusBadge` : définition de l'état observé, aucune cause inventée. « Terminé » renvoie à la couverture, sans promettre un rapport complet. |
| P1, tous | Progression → nom du module | Tooltip : rôle de HTTP, HTML, navigateur, Lighthouse, Observatory, SSL, ZAP, technologies. |
| P1, tous | Progression → attente, actualisation, relance | Disclosure « Comprendre la progression » : aucun délai ni rang garanti ; actualiser recharge, relancer crée un traitement. |
| P1, connecté | Domaine → hôte, profondeur, limites, sélection | Guide visible existant conservé (découverte gratuite, un crédit par page sélectionnée), complété par « Périmètre et confirmation » : hôte exact, liste bornée, confirmation utilisateur distincte de la file. |
| P1, connecté | Domaine → confirmer / annuler | Coût et sélection restent dans le formulaire existant. L'aide explique que l'annulation ne rembourse pas implicitement les traitements déjà consommés. |
| P1, connecté | Offre et quotas → réservés / débités / libérés | Règles et période existantes visibles, disclosure « Comprendre les crédits » ; pas de date de reset reconstruite dans un tooltip. |
| P1, tous | Footer public et connecté → bug / suggestion | Deux boutons explicites ouvrent `FeedbackButton` et la même implémentation `FeedbackForm`, catégorie modifiable. Aucun doublon dans le menu latéral. |
| P1, lecteur d'un rapport | Retour / faux positif → lien privé | Même modal. Case décochée, explication visible du partage aux admins ; faux positif seulement depuis le constat sélectionné et avec consentement explicite. |
| P2, lecteur d'un rapport | Score, couverture, domaine, sévérité, fiabilité | Disclosure « Score, couverture et sévérité » ; descriptions des catégories et mesures indisponibles existantes conservées. Lien vers la méthode du score. |
| P2, admin | Navigation admin → filtres, états, statistiques, traitement | Disclosure « Lire les données d'administration » ; aucune estimation pour une donnée absente. Les formulaires d'opérations sensibles gardent leurs confirmations visibles. |
| P2, tous | Formulaires publics → vérification anti-robot | État annoncé, recours et contact explicites si script bloqué, expiration ou indisponibilité ; aucune donnée saisie effacée. |

## Primitives et rédaction

`Tooltip` accepte un libellé accessible, un déclencheur descriptif, un texte et un
placement haut/bas. Le bouton fonctionne au focus, au survol et au tap. Échap
ferme sans déplacer le focus ; le contenu survolable reste ouvert sans délai
limite. Le positionnement fixe est borné au viewport et recalculé au scroll et au
redimensionnement. Aucun lien ni contrôle interactif dans un tooltip.

Les explications longues et les liens sont dans `ContextHelp` (`details/summary`),
lisibles au clavier et au toucher. `Dialog` utilise le modal natif, sa couche
supérieure, le confinement du focus, Échap et le retour au déclencheur. Une saisie
non envoyée déclenche une confirmation visible ; le brouillon reste monté si on
reprend sa rédaction. Pendant l'envoi, la fermeture et les doublons sont bloqués.

Ne jamais remplacer un coût, une erreur bloquante, un consentement, un périmètre ou
une conséquence destructive par un survol. Réutiliser les définitions sans
présumer la cause d'une attente, d'un module ignoré ou d'un échec.

## Contrat de feedback

Le stockage `ARG_FEEDBACK`, l'API `/api/feedback`, les protections CSRF/rate limit
et le traitement admin sont conservés. V33 ajoute `urls` (texte facultatif, cinq
URL HTTP(S), 5 000 caractères cumulés, pas de credentials, aucune requête réseau).
Le contexte de page reste un choix facultatif, avec sites, domaines, historique,
offre/consommation et administration. Les URL sont affichées comme texte échappé,
sans lien automatique ni aperçu externe. Conservation identique : 90 jours.

Sans consentement, aucune référence de rapport n'est envoyée, même si la modal a
été ouverte dans un rapport. Avec consentement, le backend résout le token déjà
accessible ou contrôle la propriété du run ; il ne stocke que l'identifiant
interne. Le canal faux positif vérifie toujours la présence du constat exact.

## Recette de compréhension

Vérifier les deux langues et les thèmes à 320/390, 768 et desktop :

1. Distinguer une découverte attendant la sélection d'une analyse en file.
2. Expliquer pourquoi « Terminé » ne garantit pas une couverture complète.
3. Trouver le coût avant de confirmer et la période dans la consommation.
4. Ouvrir un bug depuis le footer sans changer de page, conserver le texte après
   erreur, annuler puis reprendre, envoyer une seule fois.
5. Depuis un rapport, expliquer qui pourra le consulter après avoir coché la case,
   et vérifier qu'une soumission décochée n'envoie aucun identifiant.
6. Ouvrir et fermer l'aide au clavier/toucher, parcourir toute la modal, retrouver
   le focus initial ; tester texte long, zoom et défilement.

Les tests et la revue technique ne remplacent pas une séance avec des utilisateurs
non techniques ; les conclusions de cette séance restent à consigner ici.
