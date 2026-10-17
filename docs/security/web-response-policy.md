# Politique des réponses web et alertes d’auto-audit

Le proxy Next.js génère un nonce aléatoire de 256 bits par réponse HTML et remplace
les éventuels en-têtes CSP/nonce fournis par le client. Il transmet la même CSP au
rendu serveur et au navigateur. Les scripts Next.js, le script de thème et les
données structurées portent ce nonce ; `script-src` n’autorise plus
`unsafe-inline`. Turnstile reste autorisé sur `challenges.cloudflare.com`.
`unsafe-eval` est limité au développement. Les styles inline restent autorisés.

La lecture de `headers()` dans le document commun rend les pages FR/EN dynamiques.
Le HTML porte `Cache-Control: private, no-store` : ne pas remettre en cache une
page avec un nonce réutilisable. Les assets Next.js et les API restent hors du
proxy CSP. Ce choix suit le [contrat de nonce de Next.js](https://nextjs.org/docs/app/guides/content-security-policy)
et implique un rendu serveur à chaque consultation, à surveiller en charge.
Les suites E2E chargent leur copie locale d’axe-core avec l’API d’évaluation
Playwright (`injectAxe`), sans balise inline non autorisée ni désactivation de la
CSP. Les scripts de l’application restent soumis à la politique réelle.

Les liens internes utilisent `PageLink`, sans préchargement spéculatif par défaut :
les pages dynamiques n’ont pas de coque statique à précharger sans annuler des
requêtes RSC. Un chargement à la navigation évite aussi ces rendus serveur inutiles.
`LocalizedLink` désactive toujours le préchargement de `/account` et ses
descendants FR/EN car la destination dépend de la session et peut changer après
hydratation. Les liens publics peuvent explicitement demander un préchargement.
Le collecteur runtime continue à compter les véritables requêtes échouées,
y compris les annulations observées : aucune exemption globale n’est ajoutée.

Le contrôle `ssl.certificate.expiry_days` conserve les jours entiers restants et
la date d’expiration mesurée : PASS au-delà de 30 jours, WARN de 15 à 30 jours
inclus, FAIL sous 15 jours, y compris après expiration. Une mesure absente reste
INFO non scorée. Le seuil évite d’avertir avant la fenêtre habituelle de
[renouvellement Traefik des certificats ACME de 90 jours](https://doc.traefik.io/traefik/v3.3/https/acme/).
Il s’applique à tous les certificats, sans exception pour le domaine Argos, et
ne prouve pas que le renouvellement automatique est opérationnel.
Le contrat de collecte passe à `analysis-measurements-v6` pour ne pas comparer
silencieusement des rapports calculés avec les anciens seuils. Les rapports
déjà publiés restent inchangés.

Les tickets #720, #721 et #722 nécessitent une confirmation par le prochain
auto-audit du déploiement corrigé avant leur fermeture manuelle. Les tests locaux
ne constituent pas une preuve de renouvellement ou de déploiement en production.
