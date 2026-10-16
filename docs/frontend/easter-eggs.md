# Easter eggs Argos — issue #25

Les effets sont uniquement de la présentation, en français et en anglais. Ils ne
modifient ni la validation des URL, ni l’anti-robot, ni les appels d’audit, ni les
scores, ni les constats. Aucun événement analytique ni stockage n’est ajouté.

| Proposition | Déclencheur | Emplacement et résultat |
| --- | --- | --- |
| 1 · Miroir | Saisir le domaine public d’Argos, avec ou sans protocole | Sous le champ des formulaires public et connecté : « Qui audite l’auditeur ? Bien vu. », avec un regard animé du logo. |
| 2 · Géants | Saisir un domaine reconnu de Google, Wikipédia, GitHub ou Amazon | Même emplacement, une réplique par marque ; une saisie ne lance jamais d’audit. |
| 4 · Cent yeux | `↑ ↑ ↓ ↓ ← → ← → B A`, hors champ de saisie, sans pause de plus de 3 s entre touches | Douze yeux décoratifs apparaissent dans la fenêtre et suivent le pointeur. Le message disparaît après 5 s ; Échap ou le bouton nommé le ferme immédiatement. |
| 5 · Inspecteur | Ouvrir la console sur un document chargé | Un accueil localisé et le lien public du dépôt, une fois par document, y compris en React Strict Mode. Aucune détection de DevTools. |
| 6 · 42 | Le score global disponible est exactement le nombre `42` | Une phrase sous la note ; aucun arrondi utilisé pour le déclenchement, aucun changement de calcul. |

La reconnaissance des marques utilise le hostname parsé, avec une limite de
2 048 caractères, uniquement en HTTP(S) et sans identifiants. Les racines sont
`google.com/fr/co.uk/de`, `wikipedia.org`, `github.com` et
`amazon.com/fr/co.uk/de`, ainsi que leurs vrais sous-domaines. `google.com.evil.test`
et une marque contenue dans un chemin ou une query ne déclenchent rien. Argos
reconnaît `argos.lelouet.fr` et le hostname de `NEXT_PUBLIC_SITE_URL`.
Cette reconnaissance ne remplace jamais les validations SSRF du BFF et de Java.

Les messages d’URL et l’apparition des yeux utilisent des régions de statut
polies. L’effet ne déplace pas le focus à l’ouverture, ne bloque aucun clic ou
raccourci et ignore les champs, zones éditables, répétitions, compositions et
touches modifiées. La fermeture restitue le focus si son bouton le détenait.
`prefers-reduced-motion` désactive les animations et le suivi du pointeur, y
compris lors d’un changement de préférence. Les couleurs utilisent les tokens
Argos ; aucune dépendance n’est ajoutée.

## Maintenance

Le code est regroupé dans `src/components/easter-eggs/` et
`src/lib/easter-eggs.ts`, les textes dans `easterEggs` des dictionnaires FR/EN.
Les points d’intégration sont `SiteDocument`, `AuditForm`, le formulaire connecté
`AnalysisForm` et `ReportHero`. Les retirer supprime les effets sans modifier le
pipeline d’audit. Le musée du Web de 1999 (proposition 3) est hors périmètre.

## Vérifications locales du 16 octobre 2026

- Suite frontend complète : 116 fichiers et 1 040 tests réussis, plus les trois
  tests du validateur éditorial et sa vérification FR/EN. Après un dernier
  ajustement de restitution du focus lors d’une seconde activation, les 17
  tests du composant ont été rejoués avec succès.
- Lint : aucune erreur ; un avertissement préexistant dans `ReportPriorityList`.
- Build Next.js de production, dont la vérification TypeScript : réussi.
- Les tests couvrent les domaines trompeurs, la saisie sans appel d’audit,
  l’envoi normal, la console unique, les séquences interrompues, les champs
  éditables, la fermeture, les délais, le focus et la préférence d’animations.
- Les rapports utilisés pour la revue visuelle sont des fixtures fictives en
  lecture seule. Le score 42 provient d’une variante locale de la fixture
  complète ; aucun site tiers n’a été audité pour cette revue.
- Navigateur : accueil FR sombre à 1 280 px, accueil EN clair à 390 px,
  accueil FR sombre à 320 px, rapport 42 FR à 390 px et EN à 768 px.
  Répliques des quatre marques, Konami, ignorance du code dans le champ,
  fermeture par Échap et Entrée, restitution du focus : vérifiés.
  Aucun débordement horizontal observé sur ces écrans. La réduction des
  animations est vérifiée par les tests et les règles CSS ; elle n’a pas été
  émulée dans le navigateur. Aucun lecteur d’écran réel n’a été utilisé.

Les captures et les notes détaillées de la revue sont conservées localement
dans `outputs/ui-review/issue-25/` (répertoire ignoré par Git).
