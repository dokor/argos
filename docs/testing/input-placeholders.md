# Inventaire des aides de saisie — #658

| Champ | Exemple / indication | Format accepté |
|---|---|---|
| Audit public et analyse connectée d'un site | `https://www.exemple.fr/page` | URL HTTP(S), validation existante |
| Ajout d'une URL suivie | Même exemple URL | URL HTTP(S) |
| Découverte d'un domaine | `www.exemple.fr` | Hôte exact ; le normaliseur accepte aussi HTTP(S) à la racine (#681) |
| Mes sites | Rechercher un site ou un domaine | Texte, 200 caractères |
| URL suivies d'un site | Rechercher une URL | Texte, 200 caractères |
| Vue d'ensemble / pages d'un domaine | Rechercher une URL | Texte, 2048 caractères |
| Liste de domaines | Rechercher un domaine | Texte, 253 caractères |
| Comptes admin | Rechercher un nom ou un e-mail | Texte, 100 caractères |

FR/EN centralisés dans `input-hints.ts`. Les champs public existants restent
traduits par `auditForm.urlPlaceholder`. Les labels visibles, aides et erreurs
sont conservés. Pas de valeur initiale ajoutée ni d'appel déclenché par un
exemple. Dates, nombres, mots de passe et champs déjà univoques sont exclus.
Les filtres d'analyses admin restent dans le périmètre distinct de #655.
