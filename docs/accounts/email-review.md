# Recette visuelle — e-mails et informations légales, 16 octobre 2026

Données fictives uniquement pour les e-mails : domaine réservé `argos.example`,
destinataires `.invalid`, codes synthétiques. Les captures légales montrent les
informations publiques confirmées par l’opérateur dans cette tâche.

## Rendu effectivement examiné

| Surface | Langues, thèmes et largeurs |
|---|---|
| Les six e-mails | FR/EN, 320 px, préférence système sombre ; titres, code, texte complet, liens et actions contrôlés |
| Vérification d’adresse | FR, 1440 px, rendu clair de secours |
| Réinitialisation | EN, 390 px clair et 768 px sombre |
| Confidentialité | FR, 390 px sombre ; EN, 390 et 768 px clair |
| Informations de service | FR, 1440 px clair/sombre ; EN, 320 et 768 px clair |

Recette dans le navigateur intégré ; pages légales sur le build de production
Next local. Le rendu clair des e-mails a été examiné sur une copie temporaire
dont la media query sombre est désactivée : mêmes styles inline que le modèle,
sans simuler un client mail ni changer le HTML versionné.

Les 12 e-mails à 320 px ne débordent pas horizontalement. Leurs actions
principales mesurent 52 px de haut, ou 76 px lorsque le libellé occupe deux
lignes. Le code long reste entier et copiable. Le modèle sans bouton de
confirmation d’identité ne comporte pas de lien de consommation du code.

Les pages légales contrôlées ne débordent pas ; leurs sections utilisent des
séparateurs et des paragraphes, avec une graisse calculée de 650 pour les h2.
Le sommaire se replie en une colonne sur mobile. Le changement FR→EN conserve
la page équivalente et le thème. Le thème a été basculé par son contrôle réel.
L’ouverture de l’ancre anglaise des journaux à 390 px place le titre à 160,5 px,
sous la navigation dont le bas est à 121 px ; la marge d’ancrage est de 136 px.
Les ancres sont des liens natifs, utilisables au clavier.

## Preuves

- [Vérification FR, 1440 px clair](email-previews/screenshots/email-verify-fr-1440-light.png)
- [Réinitialisation EN, 390 px clair](email-previews/screenshots/email-reset-en-390-light.png)
- [Alerte de retrait EN, 320 px sombre](email-previews/screenshots/email-method-removed-en-320-dark.png)
- [Informations légales EN, 768 px clair](email-previews/screenshots/legal-en-768-light.png)
- [Confidentialité EN, ancre des journaux à 390 px](email-previews/screenshots/privacy-en-390-light.png)

Les autres captures locales sont sous `outputs/ui-review/`. Aucun jeton réel
ni donnée de compte n’y figure.

## Vérifications automatisées et limites

- `mvn test` : 906 tests, aucun échec, 1 ignoré (`ZapDaemonTest`, daemon absent).
- Nouveau modèle MIME : 4 tests réussis ; 12 variantes sérialisées et relues,
  chemins localisés, texte exploitable, échappement, durées configurées.
- Frontend ciblé : 204 tests réussis, contrôles éditoriaux FR/EN réussis.
- Lint : aucune erreur ; un avertissement préexistant dans `ReportPriorityList`.
- Build de production : réussi, types et routes publiques FR/EN inclus.

Les parcours Java avec MariaDB ne sont pas exécutés ici ; leurs captures ont
été adaptées au nouveau message, et leur compilation est vérifiée. La recette
ne couvre pas un zoom navigateur réel à 200 %, les lecteurs d’écran ou les
moteurs Gmail/Outlook/Apple Mail. Les `.eml` exportés sont prêts pour cette
recette externe ; la délivrabilité OVH n’a pas été testée. Ces vérifications ne
constituent ni une certification WCAG ni une validation juridique exhaustive.

Pour #384, le statut EI, le SMTP, les fournisseurs de connexion et la
conservation des sauvegardes/journaux ont été confirmés et intégrés. Les
compléments restants sont identifiés dans l’[inventaire factuel](../product/privacy-inventory.md),
sans adresse ou immatriculation inventée et sans clôture automatique de l’issue.
