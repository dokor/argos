# Accès aux audits — décision #218

La session admin existante `argos_admin` / `ADMIN_TOKEN` reste vérifiée par Next.
Chaque lecture admin passe par un Route Handler BFF, qui ajoute un Bearer
`ADMIN_API_TOKEN` distinct. Java vérifie ce secret sur chaque endpoint de lecture
admin, avant l'accès aux services/DB. Il ne fait confiance ni au cookie, ni à une
identité fournie dans un header du navigateur. Comparaison en temps constant.
Ce choix maintient l'auth mono-admin actuelle ; OAuth/multi-utilisateur est séparé.

| Route | Next/BFF | Java | Credential |
|---|---|---|---|
| POST /api/audits | validation URL publique | validation URL publique | aucun |
| GET /api/audits | cookie admin + proxy | Bearer serveur obligatoire | admin |
| GET /api/audits/{id}/history | cookie admin + proxy | Bearer obligatoire | admin |
| GET /api/audits/runs/{id} | cookie admin + proxy | Bearer obligatoire | admin |
| GET /api/reports/{token} | proxy/SSR | lecture via token opaque | token rapport |
| GET /api/reports/{token}/status | proxy/SSR | progression réduite, sans token/IDs/blob/erreur | token rapport |

Le polling de soumission publique utilise le token remis lors de la création.
Le dashboard peut consulter un ID numérique après authentification admin.
Le statut public n'écho pas le credential et les routes rapport ne le journalisent
pas. Aucun cache partagé ne doit conserver les lectures privées.

Traefik : console-web-api priorité 200 intercepte /api, devant api-backend priorité
100. Les Route Handlers audit interceptent également le rewrite afterFiles. Même
en cas de routage direct vers Java ou d'accès réseau interne, son contrôle Bearer
reste obligatoire. La config Traefik déployée est à confronter aux compose du dépôt.

Configuration avant déploiement : choisir un secret aléatoire dédié et placer sa
valeur dans `ADMIN_API_TOKEN` du fichier env monté de console-web et dans
`admin-api.token` du prod.conf monté Java (ou environnement Java ADMIN_API_TOKEN).
Aucune valeur par défaut ni secret n'est commité. Sans configuration, les lectures
admin échouent fermées (401 Java / 503 BFF) ; la création reste disponible. Rotation :
mettre à jour les deux services ensemble. Les secrets internes monitoring sont
distincts. TLS extérieur et réseau backend non publié sont requis en exploitation.

Tests : véritables requêtes HTTP sur les resources Jersey (backend direct, cookie
ignoré, Bearer invalide/absent, statut réduit, création publique) et tests de Route
Handlers Next (cookie absent/invalide, credential navigateur ignoré, header serveur,
cache, indisponibilité de config). #227 garde le rate-limit comme sujet distinct.
