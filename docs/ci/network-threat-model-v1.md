# Frontières réseau et chaîne CI — modèle de menace v1

Contrat de #737, 18 octobre 2026. Complète le
[socle réseau #488](../security/audit-chain-488.md), les [cibles vérifiées](targets.md),
l’[admission](admission.md), les [exports privés](private-exports.md) et les
[erreurs contrôlées](errors.md). Les preuves sont liées au SHA de la PR.
`premium-ci.enabled=false` reste maintenu jusqu’à la recette complète #467.

## Modèle et responsabilités

Les entrées contrôlées par un site, un fork ou un artefact ne constituent jamais
une configuration de confiance. Le client transmet sa clé uniquement à l’origine
Argos configurée ; Java dérive compte, intégration et portée depuis cette clé.
Le worker ne reçoit pas le Bearer. Les collecteurs reçoivent seulement l’URL et
les origines de navigation autorisées par le serveur.

| Frontière / menace | Protection | Preuve automatisée | Responsable |
| --- | --- | --- | --- |
| Client → API : credential envoyé à une cible ou via une redirection | Origine HTTPS de confiance et chemins relatifs contrôlés ; redirections API refusées | ci-boundaries.test.mjs, self-audit.test.mjs | Client #465 / trusted-http.mjs |
| BFF → Java : URL interne ambiguë ou dérivée de la page | API_BASE exclusivement serveur, origine HTTP(S) sans credentials/path/query/fragment ; en-têtes sur liste blanche | ci-machine-proxy.test.ts | BFF / ci-backend-origin.ts |
| Appel direct Java sans clé, oracle d’existence ou propriétaire forgé | Filtre machine, relecture clé/compte/scopes, identité serveur, 401/404 uniformes et no-store | CiKeysIT, CiAdmissionIT | API / CiKeyFilter, CiKeysService |
| Admission puis DNS changé ou réponses mixtes | Vérification de toutes les réponses ; vérification répétée par le proxy au moment de la connexion ; IP littérale vérifiée | UrlNormalizerTest, proxy.test.mjs | Java / audit-egress |
| Preuve de domaine : HTTPS détourné, redirection ou secret transmis | Chemin fixe, TLS avec nom d’hôte vérifié, proxy obligatoire, zéro cookie/Bearer, aucune redirection, 1 Kio et huit secondes maximum | CiProofTransportTest, HttpsTargetProofClientTest, CiTargetsIT | CI / HttpsTargetProofClient |
| Cible → HTTP/robots/sitemap : SSRF ou fallback direct | Normalisation par hop et proxy imposé sans DIRECT ; méthodes/ports et volume bornés | HttpModuleAnalyzerTest, proxy.test.mjs, Docker natif | Moteur / AuditEgress, HttpModuleAnalyzer |
| Cible → navigateur : redirection principale vers une origine non autorisée | Portée exacte persistée ; interception avant navigation, y compris popup ; seconde origine explicitement déclarée | navigation-scope tests, ci-network.mjs | Collecteurs / browser-policy.mjs |
| Sous-ressource, iframe ou worker → privé / cloud / IPv6 / méthode dangereuse | Politique IP commune, pinning, pare-feu UID, GET/HEAD, WebSockets refusés, service workers bloqués | proxy.test.mjs, browser-policy.test.mjs, compteurs Docker zéro | Collecteurs / audit-egress |
| Navigateur compromis ou exécution persistante | Sandbox active, capabilities supprimées, profil/home temporaires, limites RAM/PID, aucun secret/montage hôte de production | Docker AMD64/ARM64, lifecycle.mjs, tests superviseur | Infrastructure / collecteurs |
| Timeout, déconnexion ou annulation d’un download | Fermeture avant libération de capacité ; destruction groupe de processus et dossiers ; rejet de cancel absorbé à la fermeture | lifecycle.mjs HTTP et CI HTTPS, browser-policy.test.mjs | Runtime / superviseur Lighthouse |
| Réponse ou erreur malveillante → sortie CI | Schéma et catalogue stricts, corps/UTF-8/temps bornés, messages reconstruits, aucun texte upstream recopié | ci-machine-proxy.test.ts, ci-boundaries.test.mjs, CiAdmissionIT | API/BFF / contrat #741 |
| Fork/PR/MR → job privilégié | Source main de confiance, aucun pull_request_target/workflow_run privilégié, checkout sans credentials persistés, secrets Argos absents du publisher | ci-boundaries.test.mjs, self-audit.test.mjs | Workflows / clients #465 |
| Substitution d’artefact → écriture Git | ID d’artefact issu du producer de ce run ; hash de fichier reçu hors artefact ; vérification SHA/run/attempt/dépôt ; fichier régulier borné sans symlink | ci-boundaries.test.mjs | trusted-artifact.mjs / publisher |
| Dépendance ou tag d’action mutable | Commits complets pour toutes les actions distantes, versions de référence et registre de pins ; lockfiles npm conservés | ci-boundaries.test.mjs, audits dépendances | Workflows / .github/action-pins.json |
| Publication Git depuis une URL ou commande injectée | Origine GitHub et dépôt fixes pour le contrôle interne ; routes de mutation restreintes ; corps JSON et modèles maîtrisés, aucune interpolation shell de données | ci-boundaries.test.mjs, self-audit.test.mjs | Publisher interne / futurs #738/#739/#740 |
| Doctor/preflight → audit ou vérification payante implicite | Lecture des droits, états et registre ; aucune résolution/cible/preuve/admission/réservation/mutation Git | CiAdmissionIT.doctorPreflightCannotResolveContactVerifyOrAdmitATargetEvenWithHostileUpstreamErrors | API / CiAdmissionService |

Les lectures authentifiées mettent à jour lastUsedAt et consomment les budgets
techniques de trafic ; elles ne réservent ni ne débitent une analyse.

## Refus réseau et TLS

Les barrières Java, BFF, proxy et navigateurs conservent la même politique IP.
Le pare-feu ajoute une barrière indépendante. Outre les plages privées, locales,
documentaires, multicast et de transition IPv6, 168.63.129.16/32 est bloquée :
Microsoft la décrit comme une
[adresse virtuelle de plateforme / WireServer](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16).
Les tests couvrent aussi AWS/GCP link-local, Alibaba dans CGNAT et les métadonnées
IPv6 ULA. Aucune destination interdite ne doit atteindre le connecteur du proxy.

Une validation DNS à l’admission n’autorise pas une résolution ultérieure :
le proxy vérifie à nouveau l’ensemble des réponses et connecte l’IP validée sans
seconde résolution. Échec DNS, proxy absent, tunnel refusé ou certificat invalide
produisent un échec fermé. Aucune recommandation ne doit demander de désactiver
TLS, SSRF, sandbox, provenance ou isolation pour « débloquer » une CI.

Le certificat et le nom d’hôte restent vérifiés dans les clients Java et les
navigateurs. Le test Java utilise un certificat éphémère sur ci.example.com,
un tunnel exclusivement local et une autorité de test ; le client sans cette
autorité doit échouer avant HTTP. Les fixtures natives génèrent une autre CA
éphémère et installent seulement sa base publique NSS dans les homes de test,
suivant le [mécanisme de confiance Chromium sous Linux](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/cert_management.md).
Aucun ignoreHTTPSErrors, --ignore-certificate-errors ou fallback --no-sandbox.
Ces bootstraps et cette CA ne sont jamais copiés dans les images de production.

Les fixtures Docker routent une adresse publique synthétique vers un bridge
interne et ses alias DNS. Les tests CI HTTPS vérifient navigation nominale,
seconde origine explicite, refus de redirections publique non autorisée et privée,
certificat invalide, cookies non réutilisés et absence de credential transmis.
Les compteurs privés, de mutation, d’origine étrangère, de mauvais certificat,
de cookie persistant et de credential doivent rester à zéro. Les deadlines,
déconnexions, processus Chrome et capacité sont exercés en HTTP et CI HTTPS.

Ces fixtures ont révélé un passage non couvert par le routage Playwright :
[seule l’URL initiale d’une chaîne de redirections appelle le route handler](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).
Une garde CDP bloque donc la réponse de redirection principale avant sa suite,
et la première navigation attend son installation, y compris dans un popup.
Une instrumentation indisponible refuse la navigation ; la destination de chaque
Location doit rester dans les origines HTTPS autorisées. Les sous-frames publics
restent soumis au proxy et à la politique IP commune.

## Origines API, artefacts et permissions

Les clients API de contrôle interne gardent leurs origines fixes HTTPS.
trustedEndpoint refuse URL absolue fournie comme chemin, userinfo, échappements
d’autorité, chemin de traversée, CRLF et fragments. Les réponses JSON sont
bornées pendant la lecture, avec échéance couvrant aussi le corps et annulation
du reader. Le BFF autorise explicitement HTTP pour son backend Docker interne :
ce n’est pas un transport vers une cible utilisateur.

Le workflow post-deploy interne conserve deux jobs :

- control : source main du dépôt attendu, contents:read, secrets de connexion Argos
  limités à l’étape de contrôle ; preuve filtrée de 64 Kio maximum ;
- tickets : runner hébergé neuf, même source main et SHA, contents:read + issues:write,
  aucun credential Argos ni permission contents:write/id-token. Il reçoit l’ID et
  le hash de preuve par les outputs de jobs de confiance.

Le hash attendu n’est jamais lu depuis le fichier à vérifier. Avant JSON et toute
écriture Git, le loader refuse fichier absent, symlink, taille excessive,
substitution, contenu UTF-8 invalide, autre dépôt/SHA/run/attempt. Le consumer
télécharge par ID dans l’exécution courante, puis revalide les bytes et la
provenance ; aucun code d’artefact n’est exécuté. L’artefact interne est conservé
sept jours. Le contrôle d’intégrité explicite est bloquant : la vérification du
digest intégrée à download-artifact peut simplement émettre un avertissement
selon la [documentation GitHub](https://github.blog/changelog/2025-03-18-github-actions-now-supports-a-digest-for-validating-your-artifacts-at-runtime/).

Les pins ont été résolus sur les dépôts officiels sans changer les versions
majeures déjà choisies. Toute mise à jour doit faire vérifier le nouveau commit
dans une PR, mettre à jour le registre et les commentaires de version, puis
rejouer les contrôles. Ce choix suit les
[recommandations GitHub pour la chaîne Actions](https://docs.github.com/en/actions/reference/security/secure-use).

## Limites et critères avant ouverture

Le client Premium portable, les modèles GitHub/GitLab et les connecteurs ne sont
pas encore livrés (#465/#738/#739/#740). Le durcissement ci-dessus s’applique au
workflow interne existant ; il ne le transforme pas en client Premium. Les futurs
clients doivent reprendre ces frontières, vérifier l’origine Git issue de leur
configuration de confiance, protéger forks/PR/MR et artefacts de reprise, et
démontrer leurs propres tests négatifs avant #467.

Les fournisseurs SSL Labs/Observatory restent une frontière externe : leurs
connexions sont sous leur contrôle. RemoteScanPolicy refuse les cibles non
publiques et les vérifie de nouveau ; cela ne prouve pas leur pinning interne.
Leur activation globale reste conditionnée à l’acceptation décrite par #488.
Vérifier les garanties et données transmises avant toute ouverture client.
Ce lot ne présente pas cette délégation comme une connexion isolée par Argos.

Une CI verte n’atteste pas le kernel/Raspberry, les règles réellement déployées,
les logs/APM, le paiement ou les dépôts clients. #467 doit conserver les contrôles
du [runbook hôte](../security/raspberry-audit-validation.md), la matrice BFF/Java,
les scans de secrets synthétiques et les plafonds mesurés en topologie réelle.
Le navigateur et son kernel ne constituent pas une VM ; CONNECT chiffre le
contenu, et le proxy ne garantit pas qu’un GET public soit sans effet de bord.
Zéro scan de tiers n’est nécessaire aux fixtures de ce lot. Aucun déploiement,
fusion, activation commerciale ou test de production n’est revendiqué.
