# Révision des quatre services — #259

Les images finales portent `org.opencontainers.image.revision`. Les workflows
transmettent `github.sha` via l'argument de build `ARGOS_REVISION`, propagé par
Compose. Une construction manuelle sans argument reste `unknown` : elle ne donne
aucune preuve de révision. Les images existantes doivent être reconstruites lors
d'un déploiement autorisé pour porter ce label ; aucun déploiement n'est exécuté ici.

Pour une construction manuelle, utiliser un checkout propre de la révision choisie,
fixer `ARGOS_REVISION` au SHA complet de ce checkout et conserver images/digests.
Le label est une déclaration du build, pas une signature ni une garantie contre
un opérateur malveillant. Ne pas déclarer le SHA de main pour des sources modifiées.

Sur l'hôte Docker autorisé, avec Node disponible :

```sh
node scripts/release/inspect-runtime.mjs --expected-sha SHA_COMPLET --output runtime-observation.json
```

Le collecteur exécute uniquement `docker container inspect`, `docker image inspect`
et `docker stats --no-stream`. Il utilise les IDs d'images réellement attachées
aux conteneurs, jamais les tags mutables. Il détecte un changement de conteneur ou
de démarrage pendant l'observation. Chaque commande a une limite de 10 secondes.
La sortie conserve uniquement service, IDs, SHA, architecture, état, santé Docker,
OOM/restarts et échantillon CPU/mémoire. Aucun environnement, montage, configuration,
log, sortie stderr ou credential n'est publié. Ne pas publier les JSON inspect bruts.

Exit 0 signifie observation collectée avec révisions concordantes, **pas un GO**.
Exit 1 signale une preuve manquante/divergence ; exit 2 un argument ou fichier invalide.
Une santé absente reste UNVERIFIED ; api-backend/console-web n'ont actuellement
pas de healthcheck Docker. La santé applicative/DB authentifiée doit être vérifiée
séparément par l'exploitant, sans exposer les credentials du monitoring.

Ce point de mesure ne prouve ni pic RAM/CPU, seuil de charge, audit fonctionnel,
rotation des secrets, disponibilité des tiers, restauration ni rollback. Répéter
la collecte pendant un audit contrôlé et garder les preuves privées expurgées.
Il n'ajoute ni endpoint public ni validation automatique d'accessibilité.
Le fichier de sortie doit être nouveau : aucun fichier existant n'est écrasé.
