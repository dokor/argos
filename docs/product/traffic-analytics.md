# Fréquentation Argos — décision #659 (16 octobre 2026)

Décision avant implémentation : étendre les compteurs internes de #42 avec une
finalité audience distincte et un consentement séparé. Aucun fournisseur ni SDK
supplémentaire, aucun suivi des sites audités. Collecte désactivée par défaut.

| Approche | Coût et maintenance | Données et limites | Arbitrage |
|---|---|---|---|
| Plausible / Umami | Abonnement ou serveur et mises à jour ; script léger, intégration SPA | Vérifier configuration, identifiants, hébergement et transferts ; « sans cookie » ne prouve pas une exemption | Utile pour un besoin plus large, superflu pour ce MVP |
| Matomo | Serveur, stockage, mises à jour et configuration plus importants | Paramétrage fin ; exemption dépend de la configuration et du pays | Charge disproportionnée ici |
| GA4 | Licence standard sans coût direct, intégration et gouvernance supplémentaires | Identifiants, consentement, sous-traitants et transferts à examiner | Besoin publicitaire absent |
| Journaux serveur | Pas de script, coût de traitement/rotation | Préchargements/bots, navigation SPA incomplète ; IP et chemins privés à purger | Insuffisant pour les pages vues SPA |
| Compteurs internes existants | Pas de licence, quelques requêtes agrégées, maintenance dans Argos | Couverture limitée aux navigateurs consentants ; pas d'identité ni parcours individuel | Retenu |

## Consentement et données effectives

La décision est de demander le consentement pour la mesure d'audience en France
et en Belgique, sans revendiquer l'exemption française. La CNIL conditionne
l'exemption à la finalité, à l'anonymisation, à l'absence de recoupement et à la
configuration effective ; l'APD belge demande le consentement pour les cookies
analytiques, y compris internes. Sources officielles consultées le 16 octobre :
[CNIL](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience),
[APD](https://www.autoriteprotectiondonnees.be/citoyen/faq/si-vous-souhaitez-installer-etou-lire-des-cookies-de-mesure-daudience-encore-connus-comme-cookies-statistiques-ou-analytiques-devez-vous-obtenir-le-consentement-de-lutilisateur-de-votre-site-internet-ou-de-votre-application).

La préférence audience et le marqueur booléen de visite sont des cookies internes
HttpOnly, SameSite Strict, de session. Aucun identifiant aléatoire, IP, empreinte,
compte, appareil ou pays dans les compteurs. Pas de stockage local. Une visite
est la première page publique consentie de la session du navigateur ; plusieurs
onglets simultanés peuvent surestimer légèrement ce compteur. Ce n'est ni une
personne, ni une session de 30 minutes. Aucun visiteur unique n'est annoncé.
Une page vue correspond à une navigation rendue sur une route publique autorisée,
sans requête, fragment, token, ni route dynamique. Les zones privées et admin
sont exclues. Les sources sont uniquement des catégories fermées : direct,
moteur, référent, campagne, interne ; les valeurs UTM et domaines référents ne
quittent jamais le navigateur. Un UTM non vide devient seulement « campagne ».

Refus par défaut, tout accepter/refuser et personnalisation sans présélection.
Préférences accessibles en permanence lorsque la mesure est configurée ; retrait
immédiat pour les futures requêtes, suppression du marqueur de visite. Aucune
corrélation avec les attributions produit. Agrégats UTC conservés 90 jours et
purgés par le même travail horaire que #42. Base : consentement pour la mesure,
préférence nécessaire à la mémorisation du choix. Hébergement principal existant
en France ; aucun nouveau destinataire ni transfert introduit par cette collecte.
Les journaux techniques et sauvegardes restent soumis à l'inventaire #384.

Activation : `TRAFFIC_ANALYTICS_ENABLED=true` au BFF, `ADMIN_API_TOKEN` serveur,
et `traffic-analytics.enabled=true` côté Java. Les deux drapeaux sont nécessaires.
Le retrait d'un drapeau coupe la collecte ; les statistiques existantes restent
lisibles par les admins. Rien n'est activé ni déployé par cette PR.

## Lecture

Administration → Statistiques → Trafic : périodes 7/30/90 jours, regroupement
jour/semaine/mois UTC, pages populaires et acquisition. Les périodes incluent le
jour courant, incomplet. Bots usuels filtrés au BFF, préchargements et polling
non instrumentés. Un bot simulant un navigateur humain reste possible. Refus,
bloqueurs, erreurs réseau et désactivation réduisent la couverture ; aucun
historique avant activation, aucune extrapolation au trafic total.

Documentation des solutions examinées : [Plausible](https://plausible.io/data-policy), [Umami](https://docs.umami.is/docs/faq), [Matomo](https://matomo.org/faq/general/faq_18254/), [Google Analytics](https://support.google.com/analytics/answer/12017362). Les garanties marketing ne constituent pas une décision juridique pour Argos.
