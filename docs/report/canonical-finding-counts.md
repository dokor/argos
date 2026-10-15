# Population des compteurs de constats (#582)

Le dashboard, les listes de pages et la synthèse de domaine utilisent la projection diagnostic V2. Les compteurs critiques/importants viennent de `report.issues`, comme `buildReportModel` dans le lecteur : première ligne par identifiant, lignes sans identifiant distinctes, gravités publiées conservées. Les constats Lighthouse agrégés et détaillés sont inclus même à poids nul. Les scores et la couverture pondérée restent indépendants de cette population et ne sont pas recalculés.

Les règles pondérées conservent leurs définitions gelées et leurs états inconnus/non applicables. Les constats détaillés publiés ajoutent les règles nécessaires au filtrage et aux constats communs ; leur définition inclut la version et l’empreinte du barème du rapport. Aucun contrôle non mesuré ne devient une réussite.

## Rapports et lots existants

La migration Java V28 traite tous les rapports par groupes de 20 et remplace ensemble `diagnostic_json`, `critical_count` et `important_count`. Elle utilise le rapport publié et la projection gelée existante, sans dépendre de `result_json`, d’un catalogue courant, d’une nouvelle analyse ou d’un rescoring. Elle est reprenable : les lignes V2 déjà écrites sont ignorées. Une donnée de rapport absente ou illisible produit des compteurs inconnus, jamais un zéro inventé. Les anciennes relations aux lots restent intactes et les lectures, tris et filtres SQL utilisent ces colonnes actualisées.

V28 ne modifie aucune table ni entité QueryDSL. La migration V27 de remise à zéro antérieure reste inchangée ; ses tests sont explicitement bornés à cette version, afin que leur contrat ne dépende pas du nombre de migrations suivantes.

## Vérification

Suite Java complète puis tests ciblés de synthèse et compteurs ; parité avec la fixture historique réellement utilisée par `reportModel.test.ts` ; rapport contenant agrégats et détails Lighthouse dupliqués ; stabilité des scores et de la couverture. Le test MariaDB `CanonicalCountsMigrationIT` vérifie les projections existantes, l’absence de score brut et une seconde exécution. Il est ajouté à la sélection CI MariaDB. Aucun serveur MariaDB local n’était disponible pendant la correction ; son exécution réelle relève de cette CI.
