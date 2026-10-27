# Réactivation encadrée de SSL Labs et MDN Observatory

## Décision et périmètre

Les collecteurs peuvent fonctionner avec les API officielles existantes : SSL Labs v3 et MDN Observatory v2. Le 15 octobre 2026, depuis l'environnement de développement, une analyse du seul domaine Argos a abouti à `READY`, grade `A+`, `isPublic=false` chez SSL Labs et `score=80`, `grade=B+`, 11 tests réussis et 1 échoué chez Observatory. Ces appels ne prouvent pas la connectivité depuis le backend de production et n'ont pas modifié sa configuration.

Le 15 octobre 2026, l'exploitant a explicitement accepté que Qualys et MDN contrôlent leurs propres connexions aux sites analysés et autorisé l'activation par défaut dans la PR #640. Le Compose fournit donc `ARGOS_EXTERNAL_SCANS_ENABLED=true` par défaut ; une valeur explicite `false` permet de désactiver les deux collecteurs. Les clients et le monitoring lisent la même configuration et seule la valeur exacte `true` active les collecteurs. Hors Compose, une variable absente ou inconnue reste désactivée. Cette approbation n'autorise ni fusion ni déploiement ; cette PR ne constitue pas une validation de production.

## Deux frontières réseau distinctes

1. **Argos vers les fournisseurs** : seuls `https://api.ssllabs.com/api/v3` et `https://observatory-api.mdn.mozilla.net/api/v2` sont admis. Un override HOCON HTTP, privé, autre hôte/port/chemin, contenant des identifiants, paramètres ou fragments est refusé. La validation TLS standard reste active et aucune redirection de l'API n'est suivie, y compris pour POST.
2. **Fournisseur vers la cible** : le fournisseur résout le DNS et effectue ses propres connexions. Argos ne peut ni épingler ses adresses, ni vérifier chaque redirection à sa place. Les contrôles d'admission locaux ne prouvent pas l'absence de rebinding ou de SSRF dans l'infrastructure du fournisseur. L'activation repose donc sur la confiance explicite accordée aux services publics Qualys et MDN ; elle ne permet pas d'héberger un scanner arbitraire sur les réseaux internes Argos.

Le code public MDN vérifie les noms et leur résolution, refuse les adresses IP littérales, mais son retriever gère indépendamment les redirections. Aucune garantie de filtrage réseau de son infrastructure déployée n'est déduite de ce code. SSL Labs documente son service comme une évaluation des serveurs SSL publics. Si une garantie de connexion épinglée de bout en bout est exigée, les API distantes ne conviennent pas : il faut un chantier séparé de collecteurs auto-hébergés dans un réseau isolé derrière le proxy contrôlé. Ne pas substituer silencieusement ce mode.

## Garde-fous implémentés et conservés

- Nom DNS ASCII canonique, au plus 253 caractères. Pas d'IP littérale, port même standard, identifiant, chemin, query, fragment, encodage ambigu ou point final. Les IDN doivent déjà être fournis en punycode.
- Validation publique partagée avant soumission, y compris les noms réservés et l'ensemble des réponses A/AAAA. Une résolution mixte public/privé ou échouée est refusée. SSL Labs revalide à chaque sondage. Les caches DNS du système/JVM et la résolution indépendante du fournisseur ne constituent pas un épinglage.
- Seul le nom d'hôte est envoyé. Aucun chemin de page, query, cookie, jeton de rapport ou identifiant de compte. Les informations de confidentialité FR/EN existantes décrivent cette transmission aux services de mesure.
- SSL Labs utilise `startNew=on` au premier appel puis suit la progression sans ce paramètre, sans `fromCache`, avec `publish=off` et sans `ignoreMismatch`. Cela désactive l'affichage sur les tableaux publics SSL Labs, pas toute conservation chez le fournisseur. Les statuts loggés ou placés dans les erreurs sont bornés.
- Observatory utilise uniquement POST `/scan?host=…`, sans rescan forcé ni route `/tests` retirée. Les résultats sont ceux du domaine, pas du chemin privé d'une page.
- Budgets globaux et de modules conservés : pool distant de 2 tâches et file de 2, budget distant par défaut 2 minutes, SSL Labs 90 secondes, HTTP 30 secondes et corps borné. Les admissions d'audits existantes restent applicables. HTTP 429 n'est pas réessayé en boucle : il reste `PROVIDER_RATE_LIMITED`.
- Les protections SSRF du proxy épinglé, les réseaux des navigateurs et l'isolement de ZAP ne changent pas. Aucune mesure absente ne devient un succès ou une faute du site.

## Validation lors du déploiement autorisé

Avant le déploiement autorisé, vérifier que `prod.conf` ne surcharge pas les deux endpoints vers une ancienne URL ou un proxy : ces configurations échouent désormais à la construction du client. Ne pas partager le fichier complet ni ses secrets.

Lors d'un prochain déploiement autorisé séparément, le Compose interpolera `ARGOS_EXTERNAL_SCANS_ENABLED` avec un défaut `true` (variable absente ou vide). Une valeur `false` déjà présente dans l'environnement Compose ou son `.env` reste prioritaire : la vérifier avant livraison. Pour désactiver durablement les collecteurs, conserver `ARGOS_EXTERNAL_SCANS_ENABLED=false` dans l'environnement Compose persistant. La prise en compte exige de recréer le backend par la procédure habituelle ; aucun changement de pare-feu, ouverture de port ou accès Internet supplémentaire de ZAP n'est nécessaire. Aucun déploiement n'est effectué dans cette PR.

Puis :

1. Relever le label OCI `org.opencontainers.image.revision` et l'unique variable `ARGOS_EXTERNAL_SCANS_ENABLED` du conteneur.
2. Consulter `/api/monitoring/collectors` avec l'authentification interne existante : `enabled=true` et `NOT_OBSERVED` avant le premier audit, puis l'état observé. Les compteurs sont locaux au processus.
3. Rejouer une seule page de démonstration et relever son run, ses logs `module_completed`/`module_failed` et sa couverture. Les collectes doivent être réellement mesurées ; délai ou quota ne permettent pas de conclure à un défaut de la cible.
4. Si le fournisseur exige une nouvelle authentification, renvoie 429 ou n'achève pas son scan dans le budget, conserver `UNAVAILABLE` et son code précis. Ne pas désactiver TLS, suivre une redirection ou lancer des scans forcés pour contourner l'échec.
5. Revenir à `ARGOS_EXTERNAL_SCANS_ENABLED=false` dans l'environnement Compose persistant, puis recréer le backend pour désactiver les deux collecteurs. Le monitoring doit revenir à `DISABLED / POLICY_DISABLED`.

## Sources examinées

- [SSL Labs API v3](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md) : cache, publication, statut et limites d'évaluation.
- [SSL Labs API v4](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v4.md) : nécessite un enregistrement et un email d'organisation ; aucune inscription ni migration automatique dans cette PR. Le test réel v3 a abouti.
- [MDN API v2](https://github.com/mdn/mdn-http-observatory/blob/main/README.md), [validation de cible](https://github.com/mdn/mdn-http-observatory/blob/main/src/api/v2/utils.js), [connexions et redirections](https://github.com/mdn/mdn-http-observatory/blob/main/src/retriever/session.js).
