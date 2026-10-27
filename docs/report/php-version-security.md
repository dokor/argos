# Version PHP et risques de sécurité

Le module TECH utilise uniquement une version PHP explicitement exposée dans
`Server`, `X-Powered-By` ou `X-PHP-Version` de la réponse courante. La détection
fonctionne avec WordPress, Drupal, Joomla et les autres CMS lorsque cet indice est
présent, ainsi que sur les sites PHP sans CMS reconnu. Aucun endpoint de diagnostic
(`phpinfo`, administration, etc.) n’est sondé.

Le CMS ou un cookie PHP ne permet pas de déduire la version du moteur. Une version
absente, contradictoire, de préversion ou non reconnue ne produit pas d’alerte de
sécurité inventée. Une version partielle (`7.4`) permet de reconnaître une branche
en fin de support, mais pas de conclure sur les CVE de son correctif précis.

- `tech.security.php_eol` : branche qui ne reçoit plus de correctifs de sécurité
  du projet PHP. Une branche encore suivie pour la sécurité seule reste maintenue.
- `tech.security.php_cves` : version exacte comprise dans les plages d’au moins
  un avis PHP officiel non retiré. Ce signal exige une vérification de la version
  réellement exécutée, des extensions, de la configuration et des correctifs
  rétroportés par l’hébergeur. Il ne prouve pas une exploitation possible.

Ces deux diagnostics apparaissent dans les constats de sécurité du rapport, avec
la version observée, les CVE, les sources de détection et les dates du référentiel.
Ils utilisent l’applicabilité `VISIBLE_DIAGNOSTIC`, à poids nul. Ils ne modifient
pas le score ni son dénominateur de couverture. L’avertissement distinct de
divulgation de version conserve son comportement existant.

L’évaluation est recalculée à chaque audit, même si les signatures CMS proviennent
du cache. Les faits et les dates du catalogue sont conservés avec le constat ; un
rapport historique n’est pas réévalué à sa lecture.

## Actualiser le référentiel

Le fichier `apps/api-backend/src/main/resources/tech/php-security.json` est embarqué
dans le backend : aucun appel réseau supplémentaire pendant l’audit. Il s’agit
d’un instantané daté, pas d’une garantie d’exhaustivité des vulnérabilités.

1. Vérifier les dates de support sur [PHP Supported Versions](https://www.php.net/supported-versions.php)
   et [PHP Unsupported Branches](https://www.php.net/eol.php). Modifier les dates
   et `supportVerifiedAt` si nécessaire ; ajouter les nouvelles branches.
2. Exécuter `node scripts/update-php-security.mjs` depuis la racine. Le script
   récupère les [avis officiels php/php-src](https://github.com/php/php-src/security/advisories)
   via l’API GitHub publique paginée, exclut les avis retirés et refuse une plage
   inconnue ou un catalogue vide. Il préserve les dates de support.
3. Examiner le diff. Les bornes supérieures seules sont limitées à leur branche
   PHP, afin qu’un correctif 8.3 ne soit pas appliqué à 8.2. Les bornes explicites,
   inclusives et exclusives, ainsi que les versions exactes sont conservées.
4. Exécuter `node --test scripts/update-php-security.test.mjs`, les tests Java et
   les tests frontend, puis livrer le nouvel instantané en PR.

Pour régénérer depuis une réponse API archivée, passer son chemin JSON en argument
du script. Ne pas ajouter le contenu intégral des avis au dépôt.

La fixture fictive `/report/review-php-fixture` permet de vérifier les deux
avertissements dans le serveur de revue visuelle habituel, en français et en anglais.
