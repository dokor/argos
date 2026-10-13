# Accès aux audits et rapports

Le frontend administratif utilise exclusivement la session de compte Argos ACTIVE ADMIN, vérifiée côté Java. Voir le [contrat d’administration](../accounts/administration-contract.md) et le [retrait historique](../accounts/legacy-admin-transition.md).

| Route | Next/BFF | Java | Credential |
| --- | --- | --- | --- |
| POST /api/audits | validation URL, CSRF si compte personnel | validation URL, droits personnels | public ou session de compte |
| GET /api/audits et /api/audits/* | 410, sans requête upstream | routes opérateur direct sous Bearer conservées | aucun accès navigateur historique |
| GET /api/account/admin/runs et /{id}/report | JWT du cookie, liste blanche | session ACTIVE ADMIN, rôle courant | session de compte |
| GET /api/account/admin/analytics | JWT du cookie, périodes 7/30/90 | session ACTIVE ADMIN, rôle courant | session de compte |
| GET /api/reports/{token} | proxy/SSR | lecture via token opaque | token rapport |
| GET /api/reports/{token}/status | proxy/SSR | progression réduite, sans IDs/blob/erreur | token rapport |

Le polling public utilise le token remis lors de la création. Les rapports administratifs s’ouvrent via `/account/admin/runs/{id}` sans reconstruire ce token. Les lectures privées utilisent `Cache-Control: private, no-store`.

Traefik intercepte /api avec console-web avant api-backend. Les handlers Next ferment les anciennes lectures globales avant le rewrite. Les clients opérateur directs des anciennes routes Java restent soumis à AdminReadAccess ; les cookies du navigateur n’y accordent aucun droit.

Le Bearer serveur `ADMIN_API_TOKEN` / `admin-api.token` reste configuré pour la collecte analytics consentie et les clients opérateur directs. Il est distinct des JWT de compte et des secrets de monitoring. Les headers d’identité ou de rôle du navigateur sont ignorés par le BFF. Les métriques de compte ne transforment jamais un JWT en credential serveur.
