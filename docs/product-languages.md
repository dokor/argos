# Langues du produit

Argos prend en charge `fr`, `en`, `de`, `es`, `it`, `nl`, `pt`, `pl`, `sv`, `da`, `fi`, `cs`, `sk`, `hu`, `ro`, `bg`, `el`, `hr`, `sl`, `lt`, `lv` et `et`. La liste et les noms natifs sont centralisés dans `apps/console-web/src/lib/i18n/locales.ts`.

## Navigation et rendu

Les URL françaises existantes restent la référence historique. Les autres langues utilisent un préfixe (`/de/account`, `/el/report/…`) et les slugs de la version anglaise. `localizedPath` conserve la destination, les paramètres et les ancres. Les retours après connexion conservent leur liste de destinations autorisées.

Le proxy déduit la langue de l’URL, remplace tout en-tête de langue fourni par le client, puis réécrit les variantes vers les pages partagées du segment anglais. Le serveur charge le catalogue sélectionné avant le rendu ; seul ce catalogue est envoyé au navigateur. Le sélecteur effectue une navigation de document pour renouveler ensemble le layout, les métadonnées et le contexte client. Aucune préférence de langue n’est stockée dans `localStorage`.

Les pages publiques déclarent leurs URL canoniques et les 22 alternatives réciproques. Les comptes et rapports restent exclus de l’indexation et du sitemap. Les erreurs générales disposent d’un petit catalogue autonome, utilisable même si le layout principal échoue.

## Textes et données

`fr.json`, `en.json` et les objets de copie FR/EN restent les sources éditoriales. `localizedCopy` et `localizeValue` traduisent uniquement ces textes rédigés par Argos. Les catalogues additionnels sont indexés par texte source. Le supplément anglais couvre également les guides et démonstrations historiquement disponibles seulement en français.

Ne jamais passer de preuve d’audit, d’URL inspectée, d’extrait de code, de nom d’utilisateur ou de contenu saisi dans `localizeValue`. Ces données conservent leur valeur d’origine. Les nombres, dates et délais utilisent la langue sélectionnée ; les fuseaux métier restent explicites. Le texte des rapports, leur vue imprimable et les instructions exportées suivent la langue courante.

Les e-mails transactionnels utilisent `AccountLanguage` et des ressources embarquées dans le backend. Leur contenu provient des mêmes traductions que le frontend. Les jetons restent dans les fragments des liens de confirmation et de réinitialisation. Le rendu du site et l’envoi d’e-mails n’appellent aucun service de traduction.

## Maintenance

1. Rédiger les textes français et anglais dans la structure existante, sans mélanger données métier et copie traduisible.
2. Exécuter `npm run i18n:extract` depuis `apps/console-web`.
3. Compléter les 20 catalogues dans `src/lib/i18n/catalogues/`. Préserver exactement les variables entre accolades, les noms propres et le sens des consignes de sécurité.
4. Exécuter `npm run i18n:sync-emails` puis `npm run i18n:check`.
5. Vérifier les tests, le rendu avec les libellés longs et les parcours de connexion/rapport concernés.

Le contrôle d’inventaire, la présence de chaque traduction, les variables d’interpolation, la conservation des directives techniques et la synchronisation des e-mails font partie de la suite de tests. Le catalogue d’origine n’est pas une traduction de secours pour une nouvelle langue incomplète.

## État de la relecture linguistique

Les 20 nouveaux catalogues constituent une première traduction automatique. Google Traduction a servi pour une partie des textes publics du produit, après autorisation explicite ; des modèles OPUS et M2M100 exécutés localement ont complété les autres traductions. Aucun rapport, secret ou contenu de compte n’a été transmis. Les guides supplémentaires anglais et les messages de secours ont été rédigés séparément. Les e-mails transactionnels, les principaux libellés de navigation et les mentions de limites des rapports ont été corrigés lors de l’implémentation. Ces corrections, les contrôles structurels et les parcours testés ne remplacent pas une relecture par des locuteurs natifs, notamment pour les textes juridiques, les e-mails de sécurité et les recommandations techniques.

Les traductions sont préparées avant livraison puis enregistrées dans le dépôt. Ni Google Traduction ni les modèles locaux ne sont des dépendances d’exécution d’Argos.
