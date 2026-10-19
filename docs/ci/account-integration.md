# Compte Premium : clés et intégration CI — #464

Le parcours se trouve dans `/account/integrations` et `/en/account/integrations`.
Il reprend les trois sections des maquettes validées : clés API, domaines
autorisés et configuration CI. **`premium-ci.enabled=false` reste la valeur
livrée ; aucune souscription ou ouverture CI n'est activée par cette interface.**

## Autorisation et lectures

La gestion utilise la session vérifiée du propriétaire, via le BFF same-origin
`/api/account/ci/*`. Ce sont des opérations de compte, distinctes de l'API
machine `/api/ci/v1/*`, qui exige toujours sa clé dédiée. Un token machine,
administrateur ou de rapport ne remplace pas une session de compte.

`GET /api/account/ci/status`, sans paramètres, renvoie uniquement :

- `enabled`, `eligible`, l'offre courante et `validUntil` du droit CI ;
- les limites effectives (null lorsque CI est fermé), et la période/fuseau/
  échéance mensuelle ;
- les identifiants publics d'intégration, leur emplacement, et leurs analyses
  comptées dans le mois/réservées, y compris les réservations d'un mois précédent.

La lecture est bornée à 100 intégrations, filtrée par propriétaire et sans
secret, origine de cible, clé, nom de clé ni admission. Elle ne réserve aucun
crédit et ne lance aucune vérification de domaine. Les clés sont paginées par
cinq et les domaines par cent. Le BFF valide les schémas et applique no-store.
Un statut inconnu reste inconnu : les droits ne sont pas déduits du rôle ADMIN,
du quota général, du navigateur ou d'une ancienne réponse.

## Parcours guidé

1. **Domaine** : préparer la preuve HTTPS_FILE après confirmation/réauthentification,
   copier chemin et contenu, publier ce fichier sur l'origine publique exacte,
   puis vérifier. Un renouvellement est explicite ; une révocation invalide les
   anciennes autorisations de ce domaine. Les protections SSRF restent serveur.
2. **Clé** : nommer la clé, choisir un nouvel emplacement ou réutiliser un
   emplacement révoqué/expiré, sélectionner les domaines vérifiés et les scopes.
   Cent origines au maximum par clé ; aucun domaine n'est ajouté implicitement.
   L'expiration facultative est à minuit UTC ; sans date, le serveur fixe au plus
   un an calendaire UTC. Rotation et remplacement conservent l'identité de quota.
3. **Secret CI** : confirmer par mot de passe/code de réauthentification existant,
   puis enregistrer le secret affiché une seule fois dans ARGOS_API_KEY du runner
   protégé. L'ancienne clé en rotation reste valide quinze minutes au maximum.
   Une révocation reste accessible sans droit de nouvelle admission, même CI fermé.
4. **Configuration** : copier le modèle intégral épinglé, configurer la cible
   dans la CI, puis y exécuter `node argos-ci.mjs doctor`. Le navigateur ne reçoit
   pas une clé collée et n'appelle aucune API machine ou Git. READY reste un
   précontrôle sans réservation, pas une garantie de capacité ni de droit Git.

Deux mesures confirmées réservent deux analyses ensemble et s'exécutent en
séquence. Chaque rapport produit, même partiel, compte ; une absence de rapport
libère sa réservation. Les quotas par intégration et du compte sont contrôlés.
La date de renouvellement et la consommation proviennent du serveur.

Le secret n'est placé ni dans une URL, un exemple, un stockage navigateur, une
mesure produit, un export de diagnostic ou un artefact. Quitter/cacher la page
efface son affichage ; une réponse de création arrivée après ce masquage ne le
réaffiche pas. Il n'existe aucune capture automatique du secret. Une copie
volontaire dans le presse-papiers/CI reste sous la responsabilité du client.
Un secret perdu exige lecture de la liste, rotation ou révocation explicite ;
aucune recréation automatique.

## Publication facultative

L'assistant prépare du JSON pour la variable de confiance
`ARGOS_PUBLICATION_CONFIG`, sans changer de variable dans le fournisseur.
DISABLED est le défaut ; PREVIEW exige destination numérique/canonique,
sélection et consentement de visibilité explicites. Les catégories/sévérités,
environnements, labels et plafonds sont bornés par la politique du client.
Une destination publique ne reçoit que la notice générique, sans labels privés.
La liaison à une notice publique existante reste une entrée humaine explicite.

Le vrai plan distant est calculé ensuite par le publisher en lecture seule dans
la CI. Le passage à SYNC est une modification explicite de sa configuration
protégée, après lecture du plan. Aucun toggle du compte ne crée d'issue.
L'interface annonce le registre privé Azure requis, les SAS r/rw, le transfert
chiffré et les droits Git propres à chaque fournisseur. Les credentials Git
restent hors Argos ; aucun élargissement vers un rôle administrateur n'est proposé.

Les modèles intégrés sont générés depuis `clients/ci/templates/*` par
`node scripts/contracts/sync-ci-integration-templates.mjs`. Les tests vérifient
leur égalité exacte ; une mise à jour du client exige de régénérer ce catalogue.
La documentation web publique reste #742 ; en attendant, les liens du compte
pointent vers les guides publics versionnés dans GitHub, sans lien `/docs` cassé.

## Erreurs et validation

Le catalogue #741 fournit code, étape et action FR/EN. Un refus 401 reste
générique et invalide la session ; aucune cause de clé précise n'est inventée.
Un état de mutation ambigu ferme la création, invalide le droit affiché et
propose seulement d'actualiser les lectures, sans rejouer l'écriture.
Le diagnostic volontaire exporte seulement version, code/étape/actionCode,
requestId opaque et délai contrôlé. Aucun envoi automatique de support.

Les recettes de composants couvrent les erreurs/états et les écritures après
réauthentification. CiKeysIT vérifie les droits/quotas du nouveau snapshot,
l'isolation intercomptes et les barrières HTTP sur MariaDB réelle. La recette
`scripts/e2e/connected-ci-integrations.mjs` emploie des réponses navigateur
fictives et un credential de démonstration invalide : elle ne prouve pas
l'autorisation de production ni une recette fournisseur hébergée. Les captures
masquent toujours le bloc du secret, même fictif. Les preuves sont conservées
dans `outputs/ui-review/premium-ci-account/` et les artefacts de revue visuelle.

La recette complète #467, les paiements sandbox #733, l'environnement déployé,
les providers réels et l'ouverture commerciale restent à valider séparément.
