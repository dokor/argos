# Relances ciblées et hébergement observé

## Décision produit — issues #35 et #46

Une relance produit un **nouveau run et un nouveau rapport autonome** pour la même
URL. Le précédent reste intact. Aucun résultat d'un ancien rapport n'est fusionné
avec les nouvelles mesures. Une relance ciblée compte comme une analyse, avec la
même admission, le même quota et les mêmes permissions qu'une analyse complète.
Le lien d'un rapport partagé reste en lecture seule et n'expose pas cette action.

Le sélecteur « Relancer une mesure » propose l'analyse complète, une des quatre
catégories métier, ou une clé de contrôle figurant dans le rapport. Le catalogue
serveur valide les clés, y compris pour les rapports historiques. En cas
d'indisponibilité de ce catalogue, les relances complète/par catégorie restent
disponibles ; les anciens identifiants inconnus ne sont pas présentés comme
exécutables. Les diagnostics Lighthouse et ZAP utilisent leurs familles dynamiques
bornées (`lighthouse.audit.*`, `zap.alert.*`).

## Contrat de périmètre `audit-scope-v1`

`POST /api/audits` accepte un champ optionnel :

```json
{"url":"https://example.com/page","scope":{"kind":"category","target":"seo"}}
```

- Champ absent, ou `{"kind":"full"}` : les huit modules habituels.
- `{"kind":"category","target":"performance|security|seo|a11y"}`.
- `{"kind":"check","target":"html.title"}` : une clé exacte du catalogue de
  score, ou un diagnostic de famille Lighthouse/ZAP. Les stubs `*.collect` ne
  sont pas des contrôles exécutables.

`GET /api/audits/scope-catalogue` expose les clés exactes exécutables, sans donnée
d'utilisateur. Le navigateur utilise son BFF same-origin, sans URL interne.

Le `DefaultScorePolicy` est la source canonique des catégories et propriétaires.
`AuditScopeCatalogue` traduit ces règles en moteurs. HTTP est une dépendance
systématique : il fournit la destination après redirection, les en-têtes et le
corps courant. Les moteurs collectent à leur granularité actuelle ; seuls les
contrôles retenus sont conservés dans la liste des checks et contribuent au score.
Les données de contexte réellement collectées peuvent toujours alimenter les
mesures observées. Il ne s'agit pas d'une commande arbitraire de sous-module.

| Périmètre | Moteurs exécutés |
|---|---|
| Performance | HTTP, Runtime, Lighthouse |
| Sécurité | HTTP, Lighthouse, Observatory, SSL, ZAP, Tech |
| SEO | HTTP, HTML, Lighthouse |
| Accessibilité | HTTP, HTML, Lighthouse |
| `html.title` | HTTP (contexte), HTML (contrôle) |
| `http.security.csp` | HTTP (source canonique) |
| `lighthouse.audit.color-contrast` | HTTP, Lighthouse |
| `zap.alert.*` | HTTP, ZAP |

Les doublons entre sources d'une catégorie continuent de passer par le merger.
Une relance d'une clé canonique HTTP utilise HTTP ; elle ne déclenche pas ZAP pour
la même clé. Tech contourne son cache de signatures lors d'une relance ciblée.
Une analyse complète conserve le cache existant des seules signatures de stack.

La migration V34 ajoute `ARG_AUDIT_RUN.execution_scope` ; NULL signifie analyse
complète pour les runs historiques. Les modules hors périmètre sont `SKIPPED`,
y compris au redémarrage d'un worker. La version et l'empreinte du score restent
persistées. Le rapport interne conserve `executionScope`, `executedModules`,
`newCheckKeys`, `reusedCheckKeys` (vide) et `partialScope`. Le DTO public expose la
provenance dans `scores.scope`, même pour un résumé public.

Le score est recalculé sur les checks retenus avec le barème courant. La couverture
reste rapportée au catalogue complet : une mesure hors périmètre est absente, sans
zéro artificiel ni succès inventé. Le rapport porte le libellé **Score partiel**.
Une panne conserve le stub technique et une couverture indisponible. Un contrôle
non émis par le moteur reste non mesuré. L'empreinte du périmètre inclut la
sélection : une analyse ciblée ne devient pas comparable à une analyse complète
de la même URL. Le calcul des scores complets reste identique.

## Hébergement : méthode passive `HTTP_HEADERS_V1`

La détection exploite uniquement les en-têtes de la **réponse HTTP finale** déjà
collectée. Elle n'émet **aucune requête DNS/ASN/RDAP/API supplémentaire**, ne
consomme aucun quota de fournisseur, et ne cherche pas à contourner un proxy.
Elle hérite des limites de taille, de durée et des protections SSRF du collecteur
HTTP. Elle est recalculée dans `analyzeCurrentResponse` à chaque analyse Tech,
indépendamment du cache de stack (24 h). Les anciennes entrées de cache n'ont
donc pas besoin d'être enrichies ou invalidées.

| Signal non vide | Interprétation |
|---|---|
| `x-vercel-id` | Plateforme applicative probable Vercel |
| `x-nf-request-id` | Plateforme applicative probable Netlify |
| `cf-ray` ou `server: cloudflare` | CDN/proxy Cloudflare |
| `x-amz-cf-id` | CDN/proxy Amazon CloudFront |
| `server: nginx`, Apache, IP partagée, signaux absents | Hébergeur inconnu |
| Signaux de plusieurs plateformes | Hébergeur indéterminé (conflit) |

Le DTO distingue `applicationHost`, `cdnProxies` et `networkProvider`. Ce dernier
reste inconnu : un en-tête HTTP n'établit pas le propriétaire du réseau. Les
preuves enregistrent la présence du signal, sans conserver d'identifiant de
requête. La confiance est **moyenne**, ces en-têtes pouvant être modifiés,
supprimés ou transmis par un intermédiaire. Une plateforme probable ne prouve
ni l'origine physique ni son emplacement. Cloudflare seul n'est jamais présenté
comme l'hébergeur applicatif. Aucun effet sur le score.

Sources publiques des signatures et limites :
[en-têtes Vercel](https://vercel.com/docs/headers),
[identifiant de requête Netlify](https://answers.netlify.com/t/support-guide-netlify-support-asked-for-the-x-nf-request-id-header-what-is-it-and-how-do-i-find-it/4385),
[en-têtes Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
[en-têtes CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html).

## Vérification

`AuditScopeTest` couvre le catalogue multi-source, le contexte HTTP frais d'un
contrôle HTML, l'exclusion du score hors périmètre, une panne et la comparabilité.
La suite existante `AuditProcessorServiceTest` couvre la relance complète.
`AuditScopeIT` vérifie migration V33→V34, lecture QueryDSL, jeton et progression
après reprise ; `UsageIT` vérifie le quota des relances ciblées sur MariaDB 11.4.
`HostingDetectorTest` couvre CDN, plateformes, serveur partagé, conflit et absence
de données. Les tests frontend couvrent le sélecteur, les erreurs, les preuves
d'hébergement et les garde-fous BFF (CSRF, session, SSRF, quota).
