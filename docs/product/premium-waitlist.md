# Liste d’attente Premium — #73

Le formulaire public de l’accueil (`#premium`, FR/EN) recueille un intérêt pour
les futures offres Premium, un éventuel accès anticipé ou une réduction, sans
garantie de date, d’accès ou de prix. Le consentement est une case obligatoire,
non cochée. L’action ne crée ni compte, ni abonnement newsletter.

## Données et choix du lot

- Table dédiée `ARG_PREMIUM_WAITLIST` (V35), entité `PremiumWaitlistEntry` et
  mapping `QPremiumWaitlistEntry` : email normalisé, langue, date et version du
  consentement, expiration. Aucun lien avec `ARG_NEWSLETTER_SUBSCRIBER`.
- Consentement `premium-2026-10-16`, contact ultérieur uniquement pour cette
  finalité. Aucun envoi ni double confirmation dans ce lot : le message de succès
  confirme la prise en compte de la demande, pas la possession de la boîte mail.
- Conservation : 12 mois calendaires UTC depuis le premier dépôt accepté.
  Un doublon ne renouvelle pas ce délai et ne modifie pas la langue initiale.
  Purge horaire, au plus 500 entrées par passage. Les sauvegardes suivent leur
  propre conservation ; une indisponibilité ou un volume élevé peut retarder la purge.
- BFF same-origin `POST /api/premium-waitlist`, puis même chemin côté Java.
  Validation email, consentement et langue à ces deux frontières. Réponse 200
  identique pour nouveau/doublon, SQL atomique protégé par index unique.
- Aucune adresse dans les logs de cette fonctionnalité. Le BFF ne relaie aucun
  corps d’erreur ni détail d’exception du backend. Les erreurs SQL susceptibles
  de contenir des valeurs liées ne sont pas propagées comme causes.
- Quotas Java par instance : 20 dépôts / 15 min / pair transport, burst de 5
  sur 10 s ; budget global quadruple et burst double. Les proxies configurés de
  confiance partagent le budget global ; les en-têtes IP du navigateur sont ignorés.
  Traefik ajoute un budget par client TCP sur les deux variantes du chemin.

## Suivi et retrait par l’opérateur

L’opérateur traite les demandes via le [contact public](mailto:a.lelouet.freelance@gmail.com).
Un retrait peut être demandé depuis l’adresse inscrite. Ne pas envoyer un lien
de rapport. Aucun portail d’administration ni export public de cette liste n’est créé.

Utiliser l’interface DB autorisée et des paramètres liés, sans email dans
l’historique shell, les tickets ou les journaux. Pour le suivi, sélectionner
uniquement les lignes dont `expires_at > UTC_TIMESTAMP(3)` dans
`ARG_PREMIUM_WAITLIST`. Les distinguer explicitement de la newsletter dans tout
export privé ; conserver la finalité et la preuve de consentement. Une adresse
n’est pas vérifiée par double confirmation : ne pas annoncer ce statut.

Après validation de la demande de retrait, supprimer la ligne par email normalisé
dans cette table uniquement (`DELETE FROM ARG_PREMIUM_WAITLIST WHERE email = ?`).
Ne pas réimporter une sauvegarde ou un ancien export dans une campagne ; supprimer
aussi l’adresse des copies de travail et tenir compte des retraits lors d’une
restauration. Une éventuelle infrastructure d’envoi et ses règles de consentement
demanderont un lot distinct avant toute campagne.

La politique de confidentialité FR/EN expose ces mêmes choix. Le code et la
configuration Traefik sont livrés en PR ; aucun déploiement n’est effectué ici.
