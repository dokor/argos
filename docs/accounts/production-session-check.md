# Vérifier les sessions de production sans SSH

Le workflow manuel `production-sessions.yml` utilise le runner Docker de production
et les secrets existants du compte dédié `ARGOS_CI_EMAIL` / `ARGOS_CI_PASSWORD`.
Il ne s'exécute en production que depuis `main` dans `dokor/argos`. Il partage
la concurrence du déploiement pour éviter une modification d'image pendant la mesure.
Les PR exécutent uniquement des tests isolés sur Ubuntu, sans secrets ni runner de production.

Après fusion du workflow, lancer avec le SHA des images applicatives à contrôler :

```sh
gh workflow run production-sessions.yml --ref main \
  -f revision=05d1755b3a66884ffb42da146921123264855fcd \
  -f apply_24h=true
```

Le contrôle vérifie les révisions réellement attachées à `api-backend` et
`console-web`. Une sonde Java temporaire lit `AccountSettings` depuis le JAR,
les bibliothèques, le montage et l'environnement du backend déployé ; seules
les quatre durées sont retournées. Aucun endpoint public n'est ajouté.

Si nécessaire et si `apply_24h=true`, seuls `account.session-ttl` et
`account.idle-ttl` sont surchargés à 24 h dans le fichier monté. Une copie privée
0600 de `prod.conf` est conservée dans son répertoire avant remplacement ;
propriétaire et permissions du fichier actif sont conservés. Le backend est
recréé avec la même image, sans rebuild ni modification des autres services.
Si la sonde de configuration échoue après ce changement, la sauvegarde est
restaurée et le backend recréé. Un échec navigateur conserve une configuration
24 h déjà vérifiée et signale précisément la phase en échec.

Un navigateur isolé, limité en ressources, utilise ensuite le flux BFF normal
du compte CI. Le contrôle observe le renouvellement réel après dix minutes sur
la page publique, vérifie l'accès authentifié, supprime uniquement son cookie
d'accès pour simuler une reprise, et vérifie le renouvellement avec la preuve
HttpOnly restante. L'échéance absolue doit rester identique. La session de test
est déconnectée à la fin ; aucun audit de site n'est créé.

L'artefact `production-sessions.json` ne contient que SHA, durées, booléens et
phase éventuelle en échec. Il exclut identifiants de compte, tokens, fichiers de
configuration, mots de passe, DOM et captures. Les sauvegardes restent sur le serveur.
