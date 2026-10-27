# Suivi FCP/TBT simulés — PR #777, 27 octobre 2026

## État livré

**Objectif encore incomplet.** Le code applicatif reste celui de
`6d96ab030931d12dc2fe1fe812a28bb8ad65a9f4`, avec son chargement stable et ses
gains LCP précédents. Aucun nouvel essai applicatif n’est intégré. Ce suivi livre
les outils de comparaison, les mesures, une proposition archivée et la correction
des fixtures PDF. Il ne revendique pas une baisse du FCP/TBT de l’application livrée.

La meilleure piste locale améliore FCP et LCP ensemble, mais ne démontre pas
encore de baisse reproductible du TBT. Elle nécessite une livraison des JS/CSS
précompressés, absente du démarrage de production actuel. La revue automatique
d’autorisation a refusé la modification du démarrage/Docker et une autre proposition
sur les middlewares Traefik, en raison de leurs effets possibles sur le routage,
les caches, les en-têtes et les flux authentifiés ou en écriture. Ces changements
n’ont pas été appliqués. Aucune fusion ni aucun déploiement.

## Comparaison finale contrôlée

Cinq paires alternées sur le même port, ordre avant/après puis après/avant,
Lighthouse **13.5.0**, Edge **156**, mobile **412 × 823**, DPR 1,75,
CPU ×4 et profil réseau Lighthouse enregistré dans le fichier de mesures.
Chaque échantillon démarre un nouveau navigateur avec cache froid. Les deux
serveurs Next sont préchauffés par deux requêtes HTTP ; aucun build ou test
concurrent n’a été lancé pendant cette série finale. Le poste reste partagé.

- Référence : application de `6d96ab03`, build `aPifSf8TuYQlyD_IIamyr`,
  gzip normal de Next à travers un proxy local transparent.
- Prototype : patch archivé, build `Z_jcukXJEaRevbl30Nbph`, proxy local qui
  précompresse uniquement les JS/CSS initiaux avec Brotli qualité 11 avant les
  mesures. Les vingt ressources sont décompressées puis comparées aux octets
  d’origine à chaque préparation. HTML, API et polices restent proxifiés.
- Le h1 « Identifiez les problèmes techniques à corriger en priorité. » reste
  l’élément LCP des traces ; son rectangle observé est conservé.

| Médiane, cinq passages à froid | Référence actuelle | Prototype local | Écart |
| --- | ---: | ---: | ---: |
| LCP simulé | 2 842,95 ms | 2 541,52 ms | −10,6 % |
| FCP simulé | 1 219,41 ms | 1 066,47 ms | −12,5 % |
| TBT simulé | 64,00 ms | 62,14 ms | −2,9 %, non confirmé |
| JS transféré | 179 770 o | 159 709 o | −11,2 % |
| CSS transféré | 27 789 o | 12 779 o | −54,0 % |
| HTML transféré | 39 273 o | 16 850 o | −57,1 % |
| Polices transférées | 29 849 o | 29 849 o | identiques |
| Transfert total | 307 332 o | 248 658 o | −19,1 % |
| CLS | 0,0000963 | 0,0000963 | identique |
| Requêtes en échec | 0 | 0 | aucune |

Le TBT de référence varie de **58 à 65 ms**, contre **58,62 à 66,41 ms** pour
le prototype. Les plages se recouvrent : les 1,86 ms de différence médiane ne
prouvent pas un gain. Le score performance passe de 0,95 à 0,97, mais ne remplace
pas cette conclusion par métrique.

La référence de cette série mesure 2,843 s de LCP, contre 2,269 s dans la série
intégrée précédente, sur le même code applicatif. Les traces et leur simulation
varient entre sessions. Aucun changement d’élément LCP n’est observé dans la série
finale. Il faut comparer les paires contemporaines, sans attribuer au prototype un
gain par rapport à l’ancienne médiane. Aucun nouveau passage avec ralentissement
appliqué ou cache chaud n’a été exécuté pour cette proposition.

Les [données versionnées](homepage-fcp-tbt-2026-10-27.metrics.json) conservent les
dix échantillons, plages, indices CPU, profil, ordre et identifiants de build.
Les rapports Lighthouse complets restent locaux dans
`outputs/fcp-tbt/local-precompressed-prototype-sim/` ; ils ne sont pas des pièces
jointes distantes.

## Proposition examinable, non appliquée

Le [patch de proposition](homepage-fcp-tbt-2026-10-27.prototype.patch) s’applique
sur le code applicatif de `6d96ab03` (`git apply --check` vérifié). SHA-256 :
`e331ff2cc941ea0e10ed2dbf0819494590a3d0a7e9b151890e9ab9801537e630`.
Il contient : dictionnaire partagé typé pour l’enveloppe et catalogues complets
pour les autres routes, chargement différé de la mesure produit, suppression de
règles CSS inactives, extraction CSS Webpack ordinaire et les fichiers Geist Sans
originaux. Aucune fonte modifiée, ni inlineCss, ni CSS `graph`. L’option CSS de Next
est désactivée dans cet essai ; cela ne constitue pas une validation de stabilité
d’une nouvelle configuration de production.

Les essais avec le chargement Next seul n’ont pas conservé le LCP ; ils ne sont
pas intégrés. Les valeurs de la table concernent l’ensemble **patch + livraison
Brotli locale**. Elles ne permettent pas d’attribuer le gain à un changement isolé.

Le [proxy d’expérience](../../scripts/review/local-precompressed-proxy.mjs)
écoute uniquement en boucle locale. Il ne remplace aucun serveur de production.
Il ne constitue pas une implémentation prête à déployer : négociation complète
Accept-Encoding, variantes ETag/304, Range, conservation de Vary, cache et en-têtes
sur toutes les routes doivent être spécifiés et testés avant toute intégration.
Les pages et API devraient rester gérées par Next ; seuls les JS/CSS immuables
seraient concernés par une éventuelle livraison précompressée.

Pour reproduire la comparaison : préparer deux répertoires applicatifs construits,
une référence sur `6d96ab03` et une copie avec le patch appliqué puis `npm run build`.
Conserver leurs dépendances et ressources publiques respectives. Démarrer le backend
fictif de revue sur 3018, renseigner `CHROME_PATH` et au besoin
`ARGOS_LIGHTHOUSE_ROOT`, puis exécuter depuis la racine :

```powershell
$env:ARGOS_LOCAL_PRECOMPRESSED = '1'
node scripts/review/compare-homepage-loading.mjs CHEMIN_REFERENCE CHEMIN_PROTOTYPE outputs/fcp-tbt/reproduction 5 simulate
```

Le script refuse un port déjà occupé et une API hors boucle locale, vérifie les
identifiants de build et arrête les seuls processus qu’il a démarrés. Le mode sans
`ARGOS_LOCAL_PRECOMPRESSED` mesure Next directement. Le mode `devtools` permet de
préparer une future série froid/chaud, sans prétendre qu’elle a été exécutée ici.

## Non-régression observée

Sur le prototype archivé : build de production Webpack avec TypeScript, lint,
**1 526 tests frontend dans 152 fichiers**, structure FR/EN et tests éditoriaux
réussis. Après correction de la fixture, **24 PDF générés et contrats vérifiés** :
FR/EN, synthèse/complet, public/propriétaire/partagé, expiration, compteurs uniques,
aperçus sans token. Les PDF ont utilisé un build distinct avec la même source
frontend et le choix Webpack temporaire du harnais. Pas d’inspection manuelle
exhaustive de toutes les pages PDF.

Revue manuelle dans le navigateur intégré, données fictives :

| Vue/parcours | Couverture effective | Observation |
| --- | --- | --- |
| Accueil FR clair | 390 × 844 et 1280 × 900 | Captures avant/après identiques octet pour octet |
| Navigation cliente | Accueil FR → exemple FR → EN → accueil EN | Contenu complet et langue disponibles |
| Exemple EN | Choix de couverture partielle | Sélection vérifiée ; aucun pourcentage revendiqué |
| Accueil EN sombre | 320 × 844 | Menu, changement de thème, Escape et retour du focus ; pas de débordement |
| Retour utilisateur EN | Ouverture différée, saisie fictive, confirmation, reprise et abandon | Dialogue et focus de retour vérifiés, sans envoi |

Les dimensions DOM de comparaison sont celles de la table ; le moteur de capture
a produit des PNG de 375 × 812 et 1265 × 889. Empreintes :

- Mobile : `5c8af5740fcee616af9883caa6ab13077d0dd976e78756f379ba91e660fb61fb`.
- Desktop : `a9c7d64cce2c7cc84dc1937a038a9df4b9a819624ffee0cc2a630c26446524fe`.

Les captures et le compte rendu sont locaux dans `outputs/ui-review/fcp-tbt/`.
Aucun message console/CSP n’a été observé dans ces parcours. La conservation de
la valeur du brouillon n’a pas été relue manuellement après reprise ; les tests
unitaires couvrent ce comportement. Cet échantillon ne couvre pas toutes les
routes, tous les états de consentement ou les comptes privés réels et ne constitue
pas une certification d’accessibilité. Aucun audit réel ni retour utilisateur envoyé.

Le harnais PDF livré acquitte uniquement le renouvellement d’une session
synthétique et configure l’origine locale au démarrage comme au build. Aucun
contrôle CSRF ou d’accès applicatif, aucune assertion du test n’est affaibli.
Sa relance sur le code stable, avec le build de production Turbopack par défaut et TypeScript, réussit également : **24 exports et tous les contrats vérifiés**. Les 1 522 tests applicatifs avaient déjà passé sur 6d96ab03 ; ils ne sont pas relancés pour ce suivi limité à la documentation, aux outils locaux et à la fixture.

## Suite requise

L’objectif FCP/TBT reste ouvert : autorisation explicite d’étudier la livraison
précompressée dans le démarrage/Docker du frontend, implémentation et tests des
contrats HTTP, nouvelles séries simulées et appliquées, puis amélioration TBT
reproductible. La PR conserve le code stable en attendant ; aucune action sur
Traefik, aucune fusion et aucun déploiement n’ont été effectués.
