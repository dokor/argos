# Migration vers argos-audit.com

Origine canonique : **https://argos-audit.com**, sans `www`. Cette préparation
n'effectue aucune modification DNS, aucune déclaration Search Console et aucun
déploiement. La fusion sur `main` déclenche le workflow de déploiement : attendre
que les prérequis ci-dessous soient prêts avant de fusionner.

## Comportement livré

- Les routeurs applicatifs Traefik utilisent `argos-audit.com`, avec leurs limites
  API et authentification existantes. Le frontend reste le BFF de `/api/*`.
- `argos.lelouet.fr` et `www.argos-audit.com` restent routés vers Next sur HTTP
  et HTTPS. Leurs routeurs ont la priorité 300, supérieure aux anciens routeurs
  applicatifs (10, 100, 200, 210), notamment pendant le déploiement des services.
- Next renvoie un **308 permanent** vers l'origine HTTPS canonique avant le proxy,
  les handlers et les réécritures API. Le chemin et les paramètres sont conservés,
  y compris les paramètres répétés. Le 308 conserve la méthode et le corps des
  requêtes, contrairement au comportement possible d'un 301/302 avec POST.
- Les quatre anciens raccourcis `/accessibilite-numerique`,
  `/audit-technique-gratuit`, `/audit-site-pme` et `/audit-site-ecommerce` vont
  directement vers leur page `/ressources/...` sur le nouveau domaine.
- Les URL déjà canoniques ne sont pas redirigées. Les redirections de domaine ne
  concernent ni localhost ni les domaines de prévisualisation. Les règles Next
  habituelles de normalisation des slashs restent applicables. Les ressources
  internes `/_next/` restent gérées par Next.
- Le sitemap, robots.txt, les canoniques, hreflang, Open Graph, JSON-LD, les liens
  des exports et `llms.txt` utilisent le nouveau domaine, y compris pour les
  22 langues du produit. Comptes et rapports
  conservent leur `noindex` et restent exclus du sitemap.
- Le Dockerfile reçoit `NEXT_PUBLIC_SITE_URL` **au build** ; Compose fixe la même
  valeur au build et au runtime. Les fichiers `.env*` privés sont exclus de
  l'image. Il faut reconstruire le frontend, pas seulement relancer le conteneur.
- Next reçoit `ACCOUNT_ORIGIN=https://argos-audit.com`. Le Compose Java fixe
  `-Daccount.origin=https://argos-audit.com`, qui prime sur une ancienne valeur
  dans le fichier monté. L'auto-audit et les scripts de contrôle ciblent également
  la nouvelle origine.

## Avant la bascule : DNS et services externes

1. Dans la zone DNS de **argos-audit.com**, créer :

   | Nom | Type | Valeur |
   | --- | --- | --- |
   | `@` | `A` | IPv4 publique actuelle du serveur/point d'entrée Traefik |
   | `www` | `CNAME` | `argos-audit.com.` |

   Un TTL de 300 secondes facilite la préparation. Ajouter un `AAAA` uniquement
   si l'IPv6 sert réellement le même Traefik sur 80 et 443 ; retirer les
   enregistrements de parking ou les anciennes adresses qui entrent en conflit.
   Si des CAA sont configurés, ils doivent autoriser Let's Encrypt. Ne pas utiliser
   la redirection Web du registrar en parallèle des règles de l'application.
2. **Conserver le DNS de `argos.lelouet.fr` et la propriété de `lelouet.fr`.**
   Les trois noms doivent atteindre Traefik. La configuration demande des
   certificats via le resolver existant `le`, y compris pour les deux alias.
   Garder l'état ACME existant et vérifier son renouvellement. L'ancien domaine
   doit avoir un certificat valide avant de pouvoir rediriger une visite HTTPS.
3. Vérifier la configuration globale du proxy, gérée séparément dans
   `dokor/raspberry-infra`. Une redirection HTTP→HTTPS globale à l'entrypoint peut
   ajouter un saut avant celle du domaine ; les labels Argos ne la supplantent pas
   nécessairement. Prévoir son ajustement séparément si le contrôle HTTP constate
   ce saut. Ne pas supprimer les challenges ACME nécessaires aux certificats.
4. Préparer les fournisseurs OAuth utilisés, avec les callbacks exacts :

   ```text
   https://argos-audit.com/api/account/auth/oauth/google/callback
   https://argos-audit.com/api/account/auth/oauth/github/callback
   https://argos-audit.com/api/account/auth/oauth/linkedin/callback
   ```

   Mettre aussi à jour les domaines autorisés et les URL d'accueil, de
   confidentialité et de conditions d'utilisation dans leurs consoles. Pour
   Google, vérifier le domaine selon la procédure demandée par le fournisseur.
   Certains fournisseurs n'autorisent qu'un callback : coordonner leur changement
   avec la bascule. Ne pas supposer qu'un flux OAuth démarré avant celle-ci aboutira.
5. Si Turnstile est activé, autoriser `argos-audit.com` dans le widget Cloudflare
   **et** dans `antibot.hostnames` du fichier Java monté. Pendant la préparation,
   cette liste peut inclure ancien et nouveau nom. Ne pas désactiver l'anti-abus
   pour contourner une configuration incomplète.
6. Aligner les fichiers privés `/srv/configs/console-web/.env.prod` et
   `/srv/configs/api-backend/prod.conf` sur la nouvelle origine (sans publier leurs
   secrets). Conserver `API_BASE` interne, les secrets de session et la base de
   données. Les cookies ne migrent pas entre domaines : les utilisateurs devront
   se reconnecter. Les liens opaques des rapports restent les mêmes ; un accès
   lié à un cookie ou une session pourra nécessiter une nouvelle authentification.
   Les liens email avec fragment `#token=` doivent être testés dans un navigateur ;
   le fragment n'est jamais envoyé au serveur. Une page déjà ouverte sur l'ancien
   domaine doit être rechargée, notamment avant une mutation protégée par CSRF.

## Search Console : préparation puis déclaration

Avant la bascule, vérifier avec le même compte Google la propriété de
`https://argos.lelouet.fr/` (préfixe d'URL à la racine de ce sous-domaine) et celle
du nouveau domaine `argos-audit.com`. Les validations DNS TXT permettent de garder
la preuve de propriété pendant les redirections. Conserver les TXT existants.
Sauvegarder les clics, impressions, pages indexées et principales pages d'entrée
de l'ancien site pour comparer après migration. Vérifier l'absence d'action
manuelle ou de suppression héritée sur le domaine acheté.

**Seulement après déploiement et contrôle des redirections :**

1. Dans la propriété de **argos.lelouet.fr**, ouvrir **Paramètres → Changement
   d'adresse**, choisir le nouveau site et suivre les contrôles de Google.
   Ne pas déclarer le déménagement de tout `lelouet.fr`.
2. Soumettre `https://argos-audit.com/sitemap.xml` dans la propriété du nouveau site.
3. Inspecter la page d'accueil et des pages importantes dans plusieurs langues. Vérifier que
   la canonique choisie correspond à la nouvelle URL et que les pages publiques
   ne portent pas de `noindex`.
4. Suivre l'indexation, les erreurs et les performances **des deux propriétés**
   pendant les semaines suivantes. Une baisse sur l'ancienne propriété est
   attendue : suivre aussi le total des clics sur les deux sites.

Garder les redirections, le DNS et les certificats des anciens liens **au moins
un an**, idéalement durablement. Mettre à jour les liens publics contrôlés
(profils, GitHub, communications, partenaires). Conserver les contenus et les
chemins pendant la migration. Ne pas bloquer l'ancien site avec `Disallow: /`
et ne pas demander sa suppression dans Search Console pour accélérer le transfert.
Une fluctuation temporaire du référencement reste possible ; aucun classement
n'est garanti.

## Validation avant et après déploiement

Contrôles locaux, depuis `apps/console-web` :

```sh
npm ci
npm run lint
npm test
# Construire avec NEXT_PUBLIC_SITE_URL=https://argos-audit.com.
npm run build
npm run check:domain-migration
```

Le dernier contrôle démarre un serveur Next **sur loopback**, utilise des tokens
synthétiques, ne suit jamais les redirections vers Internet et arrête son serveur.
Il vérifie les réponses 308 pour sept méthodes HTTP, chemins, paramètres répétés
et encodés, puis le HTML canonique, le sitemap, robots.txt et les headers privés.
La CI l'exécute également dans l'image construite avec `--network none` et valide
la syntaxe des deux Compose sans lire les fichiers privés de production.

Après la bascule autorisée, vérifier les certificats, puis ces lectures publiques :

```sh
curl -I 'https://argos-audit.com/faq'
curl -I 'https://argos.lelouet.fr/faq?utm_source=migration'
curl -I 'http://argos.lelouet.fr/faq?utm_source=migration'
curl -I 'https://www.argos-audit.com/faq'
curl -I 'https://argos.lelouet.fr/accessibilite-numerique'
curl -I 'https://argos-audit.com/en/faq'
```

Attendre 200 sur les pages canoniques et 308 vers l'URL équivalente HTTPS pour les
alias. Ne pas utiliser `-k` : cela masquerait une erreur de certificat. Tester
ensuite un audit, la connexion, les fournisseurs OAuth actifs, un lien email et
un rapport préexistant avec un compte de recette. Aucun token réel dans un log
public ou une capture publiée. Surveiller aussi l'auto-audit après déploiement.

Avant la fusion, conserver les révisions d'images et la configuration précédente
pour pouvoir restaurer le service en cas d'incident. Une redirection permanente
peut être mise en cache : un retour arrière n'est pas instantané côté visiteurs.
Ne pas alterner les deux destinations ; en cas d'annulation réelle du déménagement,
suivre aussi la procédure Search Console d'annulation.

## Références

- [Google : migration avec changement d'URL](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Google : redirections permanentes, dont 308](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [Search Console : changement d'adresse](https://support.google.com/webmasters/answer/9370220?hl=fr)
- [Next.js : redirections, méthodes et paramètres](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)
- [Next.js : variables intégrées au build](https://nextjs.org/docs/app/guides/environment-variables)
