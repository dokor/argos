# Parcours d'authentification

Cette référence regroupe les comportements des écrans FR/EN de connexion,
inscription, récupération, réinitialisation et vérification email. Le
[contrat des comptes](contract.md) porte les règles serveur ; la
[recette commune](../testing/accounts.md) décrit leur vérification.

## Formulaires et reprise

- Un refus de connexion utilise le code public `credentials_invalid`. Il conserve
  la session existante ; les 401 des ressources privées et du renouvellement
  conservent leur comportement d'invalidation. Une personne connectée peut ouvrir
  son espace ou choisir explicitement un autre compte.
- Le nom et le nouveau mot de passe suivent les règles Java : nom de 100 unités
  UTF-16 maximum, non vide, non blanc et sans caractère de contrôle ; mot de
  passe de 15 à 128 points de code. La connexion n'applique pas la politique de création
  au mot de passe saisi. Le serveur reste autoritaire.
- Les aides et erreurs sont reliées aux champs. Une validation locale refusée
  n'envoie pas le formulaire et place le focus sur le premier champ invalide.
- Le champ de mot de passe est masqué au montage. Afficher/Masquer conserve le
  champ natif, la sélection et le focus : celui du champ au pointeur s'il l'avait,
  celui du bouton au clavier. Autocomplete et collage restent disponibles.
- La récupération se trouve dans le bloc mot de passe. Inscription et demande de
  réinitialisation affichent une confirmation conditionnelle, sans révéler
  l'existence d'un compte, et permettent de corriger l'adresse avec restitution
  du focus. L'inscription conserve le nom et l'email, puis efface le mot de passe.
  Les contrôles sont désactivés pendant la requête ; une erreur permet de réessayer.
- Sans jeton ou après son refus, reset et vérification proposent des actions de
  reprise. La consommation exige une confirmation explicite ; aucun GET ne
  consomme le jeton. Le renvoi de vérification passe par Mon compte.
- Un reset réussi efface la session locale et son cookie, en cohérence avec la
  révocation des sessions Java. La récupération ne promet pas d'email à un compte
  disposant uniquement d'une identité externe.

## Langue, destination et confidentialité

`localizedAccountReturn` applique l'allowlist avant et après localisation. Les
identifiants, filtres et retours imbriqués autorisés sont conservés ; une
destination absente ou refusée revient à Mes sites dans la langue courante.

Les liens de langue des écrans d'authentification transportent le contexte et,
si nécessaire, le jeton du fragment détenu en mémoire. Après consommation ou
refus, ce jeton disparaît aussi des liens. Le BFF conserve la destination dans
un cookie HttpOnly et transmet seulement `fr` ou `en` à Java via
`Accept-Language`. Les chemins des emails sont fixes et localisés. Un autre
navigateur conserve la langue de l'email et utilise la destination par défaut.

Les cinq modes FR/EN définissent un titre traduit, `noindex/nofollow` et
`no-referrer`, sans identifiant, email ou jeton dans les métadonnées. Le cadre
partagé conserve marque/retour au site, langue, thème et liens d'aide, contact,
confidentialité et conditions. Les refus OAuth suivent la
[procédure d'exploitation](operations.md).

## Vérification et provenance

Les tests de composants, BFF et Java ainsi que le workflow `Authentication UX E2E`
sont décrits dans [la recette des comptes](../testing/accounts.md). Les simulations
ne prouvent ni l'acheminement SMTP réel, ni une connexion auprès d'un fournisseur
OAuth, ni une conformité WCAG globale.

Les [comptes rendus du 15 octobre 2026](../archive/README.md#authentification-et-comptes)
conservent les résultats, captures et limites des lots #599–#607.
