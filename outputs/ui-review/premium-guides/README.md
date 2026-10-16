# Revue locale Premium et guides — 16 octobre 2026

Build de production Next.js inspecté dans le navigateur Chromium intégré.
Aucun domaine client, rapport privé ou adresse réelle utilisé. L’adresse
`synthetic@example.com` sert uniquement aux tests.

## Vérifications exécutées

- Backend : `mvn test`, 930 tests, 0 échec/erreur, 1 test ignoré faute de service
  ZAP ; `mvn -DskipTests package` réussi. Tests ajoutés pour validation, consentement,
  normalisation, dates de rétention, job de purge, réponses HTTP et limite réelle
  Grizzly/Jersey avec en-têtes IP forgés.
- Frontend : suite complète, 997 tests réussis ; tests ciblés des deux composants
  rejoués après l’ajout de l’exemple LCP et la stabilisation du bouton, 10 réussis.
  `npm run build` réussi. `npm run lint` sans erreur ; avertissement préexistant
  dans `ReportPriorityList.tsx:20` hors de ce lot.
- `PremiumWaitlistIT` ajouté au workflow MariaDB 11.4 : migration réelle,
  huit inscriptions concurrentes, unicité, séparation newsletter, absence de
  renouvellement des doublons et suppression à l’échéance. Pas de MariaDB locale
  disponible ; résultat à lire dans les checks de la PR.

## Revue visuelle réellement effectuée

- 1280 px : guide LCP FR sombre, formulaire Premium FR clair, chargement/succès.
- 768 px : HSTS EN sombre, navigation à deux lignes.
- 390 px : LCP FR et CSP EN sombres, formulaire FR sombre avec erreur de service,
  formulaire EN clair avec chargement/succès et focus clavier.
- 320 px : CSP FR clair, code défilant dans son propre conteneur, tableau de
  mesures LCP FR clair. Aucune largeur de document supérieure à la fenêtre sur
  ces pages modifiées. Titres, paragraphes et listes restent lisibles.
- Ancres de guide : destination à environ 136 px sous le haut de la fenêtre
  mobile, sans titre masqué par la navigation. Graisse des H2 calculée : 650.
- Premium desktop : champ et bouton à 44 px, mêmes x/largeurs avant et pendant
  l’envoi (champ 506,02 px ; bouton 221,98 px). Libellé du bouton stable,
  chargement annoncé dans le statut séparé. Focus clavier visible : outline 3 px.
- Contenu et erreurs FR/EN, noms accessibles, consentement initial non coché,
  champ conservé après erreur et effacé après succès.

Succès/chargement visuels utilisent `backend.mjs`, fixture loopback sans stockage
qui n’accepte que l’adresse fictive. Ils ne constituent pas une recette du backend
de production. L’erreur de service a été vérifiée sans backend. Les tests Java et
la CI MariaDB vérifient les frontières et la persistance séparément. Cette revue
automatisée ne déclare aucune conformité WCAG ni recette humaine.

## Exemple LCP reproductible

Lancer `node scripts/lcp-guide-demo.mjs`, puis comparer
`http://127.0.0.1:3019/before` et `/after`, fenêtre 390 × 844,
aucun ralentissement CPU/réseau, réponses `no-store`. La même image du dépôt
est injectée après 1 000 ms par JavaScript avant correction ; après correction,
elle est présente dans le HTML initial. La priorité de chargement est identique.
L’observer confirme `#hero` comme élément LCP sur les dix passages.

| Variante | LCP des cinq passages (ms) | Médiane |
|---|---|---|
| Avant | 1060, 1052, 1048, 1060, 1048 | 1052 ms |
| Après | 60, 52, 52, 56, 56 | 56 ms |

Le début de requête image passe d’environ 1031–1046 ms à 9–12 ms.
Cette expérience isole un délai artificiel et ne mesure pas le service déployé.

## Captures

- [Premium FR desktop, succès fictif](premium-fr-desktop-success.png)
- [Premium EN mobile, succès et focus](premium-en-390-success.png)
- [HSTS EN à 768 px, sombre](hsts-en-768-dark.png)
- [CSP FR à 320 px, clair](csp-fr-320-light.png)
- [Exemple LCP FR à 320 px](lcp-fr-320-example.png)
