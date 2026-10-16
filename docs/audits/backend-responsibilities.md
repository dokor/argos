# Diagnostic backend et responsabilités

## Référence et méthode

Diagnostic actualisé le **16 octobre 2026** pour [#128](https://github.com/dokor/argos/issues/128), avant les changements de [#475](https://github.com/dokor/argos/issues/475), sur `main` **d54374f43bbacffd26171bc96e01b9c7bd7e9970**. Périmètre : `apps/api-backend`, frontières REST/BFF et contrats associés, sans inspection de production. Lecture ciblée des services identité/session, autorisations, création/claim/progression des audits, publication/lecture/partage des rapports, DAO, configuration et workflows. Les conclusions de sécurité portent sur ces chemins lus ; ce document n'est pas une attestation exhaustive.

Inventaire reproductible : `rg --files apps/api-backend/src/main/java -g '*.java'` donne **289 fichiers Java**, entités et Q* compris ; `src/test/java` en contient **133**, fixtures et IT compris. Ces nombres ne mesurent ni complexité ni couverture.

`mvn --batch-mode verify`, exécuté sur cette révision avec Microsoft JDK 21.0.11 : **925 tests, 0 échec, 0 erreur, 1 ignoré** (test optionnel ZAP, daemon absent), build et distribution réussis. Le profil MariaDB et les parcours navigateur ne font pas partie de cette commande. JaCoCo 0.8.15 produit `target/site/jacoco/jacoco.xml` : **7 455 / 11 694 lignes (63,75 %)** et **4 944 / 8 232 branches (60,06 %)**, classes `db/generated` exclues. Mesure locale unitaire, sans seuil ajouté ; l'ancien « ~40 % » n'est pas une mesure actuelle. Logs et rapports restent dans les sorties locales/artefacts CI, pas dans les sources. Reproduire avec les commandes du [backend](../../apps/api-backend/README.md) et de [MariaDB](../testing/mariadb.md).

## Réconciliation du livrable de juillet

La [PR #238](https://github.com/dokor/argos/pull/238) est **fermée sans fusion** (`merged=false`, vérifié le 16 octobre). Son commit est `3c959ebe963f1a68cfa5d325de0865e909c3d49a`. Le [commentaire de fin d'audit](https://github.com/dokor/argos/issues/128#issuecomment-4887307287) annonce ce document et les 21 chantiers ; il ne prouve pas sa fusion.

Le document a ensuite été récupéré par `f7ad9e7f`, puis déplacé par `e32f9901`. Il est maintenant dans l'[archive de juillet](../archive/backend-audit-2026-07.md). L'ancien chemin `docs/audits/2026-07-backend-audit.md` absent de main s'explique par ce déplacement. L'archive reste historique ; le présent diagnostic fixe les décisions de refactoring actuelles.

## Cartographie actuelle

| Responsabilité | Entrées et collaborateurs | Invariants / observation |
| --- | --- | --- |
| Identité | `AccountAuthWs` → `AccountAuthService`, `AccountOAuthService` → `AccountOAuthClient` ; `AccountDao` | Auth classique et Google/GitHub/LinkedIn, comptes PENDING/ACTIVE/SUSPENDED/ARCHIVED. Les helpers email/nom sont dans `AccountAuthService`, pourtant utilisés par OAuth et les profils : couplage inutile à l'orchestration d'authentification. |
| Session et accès | `AccountPermissionProvider`, `AccountSessionService`, `AccountCsrf`, `AdminService.requireAdmin` | La session est revalidée dans la transaction métier ; le rôle et la propriété restent contrôlés côté serveur. Le credential admin historique `AdminReadAccess` est dans `webservices`, mais importé par deux services analytics : dépendance inversée réelle, distincte des comptes ADMIN. |
| Création et exécution d'audit | `AuditsWs` → `AccountRunsService` / `AuditService` ; `AuditQueueService`, `AuditRunService`, `AuditProcessorService` | Public sans compte maintenu, preuve de rattachement distincte du lien rapport, SSRF répétée, admission/consommation côté serveur. La séparation commande/requête admin existe déjà (`AuditQueryService`) ; les lectures personnelles de `AccountRunsService` sélectionnent encore toute l'entité run, dont `result_json`/credentials internes inutiles. |
| Rapport et partage | `ReportPublishService`, `ReportReadService`, `ReportSharingService`, `AccountReportIntroductionService` | Publication + COMPLETED + comptage sur une connexion ; rétention et hash de capacité. Le partage mélange validation, contrôle de propriété, orchestration et SQL JDBC ; extraire sa persistance sans déplacer la transaction ni changer les droits. |
| Analyse et score | `AuditModule`, `AuditProcessorService`, `AuditDeadline`, executors bornés, `DefaultScorePolicy`, compositeur et projections | Huit modules déclarés, HTTP d'abord, SSL/Observatory en parallèle, échecs dégradés ; score et restitution déjà décomposés. Le processeur garde beaucoup de collaborateurs : pas de généralisation plugin supplémentaire justifiée par cet audit. |

## Roadmap historique #217–#237, état vérifié le 16 octobre

Les **21 issues sont fermées, motif `completed`** via l'API GitHub. Cet état ne vaut pas validation opérationnelle. Chaque ligne distingue le mécanisme observé et la preuve disponible dans le dépôt ; les tests nommés sans suffixe IT ont été exécutés par le `verify` ci-dessus. Les IT sont présents et exécutables par la CI MariaDB, **non exécutés localement pour ce diagnostic**. Aucune issue de remplacement n'est créée.

| Issue / priorité historique | Actualité du constat et preuve dans le code | Dépendances / limites actuelles |
| --- | --- | --- |
| [#217](https://github.com/dokor/argos/issues/217) P1 SSRF | `UrlNormalizer` résout tous les hosts ; `HttpModuleAnalyzer` revalide chaque saut ; proxy egress épinglé. `UrlNormalizerTest`, `HttpModuleAnalyzerTest`. | Configuration effective du proxy et contrôles Raspberry : #488. Ne pas confondre validation syntaxique et transport protégé. |
| [#218](https://github.com/dokor/argos/issues/218) P1 accès | `AuditsWs` exige `AdminReadAccess` pour les lectures admin ; statut par capacité, sessions et ownership pour comptes. `AuditAccessHttpTest`, `AccountAdminAccessTest`. | Dépend de #226 ; accès par ID n'est jamais une permission. Credential historique encore utilisé par analytics serveur, pas à supprimer dans ce lot. |
| [#219](https://github.com/dokor/argos/issues/219) P1 secrets | Config externe, validation au démarrage et workflow Gitleaks ; `ConfigurationServiceTest`. | [Registre](../security/secret-remediation.md) : rotation attestée par l'opérateur le 7 octobre, pas revérifiée ici ; décision sur l'historique toujours séparée. |
| [#220](https://github.com/dokor/argos/issues/220) P1 mémoire | `BoundedBodyHandlers`, `ExternalHttpClient` et limites clients. `BoundedBodyHandlersTest`, `ExternalHttpClientTest`. | Limites/configuration réelles et mémoire du Pi à mesurer (#488/#212). |
| [#221](https://github.com/dokor/argos/issues/221) P1 HTML | Le processeur retire le body après construction du contexte HTTP, avant sérialisation. `AuditProcessorServiceTest`. | Garder le contexte transitoire pour HTML/Tech et la sanitation des sorties. |
| [#222](https://github.com/dokor/argos/issues/222) P1 listes | Projections admin dans `AuditDao`, score dénormalisé et `ReportGlobalScoreMigrationIT`. | Les nouvelles listes personnelles ont réintroduit un SELECT d'entité : lot #475 ci-dessous, sans remettre en cause la correction admin historique. |
| [#223](https://github.com/dokor/argos/issues/223) P1 budget | `AuditDeadline`, `AuditModuleExecutor`, budget collecte et délais HTTP. Tests de deadline/executor ; [contrat](../analysis/deadline.md). | Précondition du parallélisme #236/#212 ; aucune garantie de délai production déduite du test local. |
| [#224](https://github.com/dokor/argos/issues/224) P1 DB | Profil `mariadb-integration`, `AuditClaimIT`, fixture MariaDB jetable et workflow 11.4. | Infrastructure présente ; pas de DB locale dans cette exécution. |
| [#225](https://github.com/dokor/argos/issues/225) P1 catalogue | `AuditModule` enum, ordre unique et switch explicite exhaustif du processeur. `AuditProcessorServiceTest`. | L'abstraction plugin incomplète de juillet a été retirée ; #230/#231/#235 ne sont plus bloqués par elle. |
| [#226](https://github.com/dokor/argos/issues/226) P2 capacités | Empreintes seules, lien pré-généré ; `ReportCredentialMigrationIT`, tests de lecture/partage. | Expiration + contrôles de lecture #218 ; ne pas régénérer le token à publication. |
| [#227](https://github.com/dokor/argos/issues/227) P2 limites | `PublicWriteLimiter`, filtres publics, anti-bot et `AccountRateLimiter` ; tests de filtres et `NewsletterPrivacyIT`. | Admission/quotas serveur ; audit public conservé. Aucun quota commercial inventé. |
| [#228](https://github.com/dokor/argos/issues/228) P2 atomicité | `ReportPublishService.completeAndPublish` utilise la même transaction et le claim worker ; DAO find-or-create idempotents. `AuditPublicationIT`, `AuditClaimIT`. | Usage compté sur rapport produit ; préserver l'ordre des verrous et l'idempotence. |
| [#229](https://github.com/dokor/argos/issues/229) P2 JSON | Cache auto-réparé dans `DomainAnalysisService`, clients JSON tolérants aux champs additionnels. Tests des clients/cache. | `DomainAnalysisConcurrencyIT` valide les courses en CI DB ; formats publics indépendants. |
| [#230](https://github.com/dokor/argos/issues/230) P2 transport | `ExternalHttpClient` commun, configuration centralisée, erreurs sans corps distant. `ExternalHttpClientTest`. | Transport de page SSRF et clients de services configurés ont des contrats distincts. |
| [#231](https://github.com/dokor/argos/issues/231) P2 indisponibilité | `ModuleOutcome`, `CollectorFailure`, politique des contrôles de collecte. Tests d'orchestration et score. | Les statuts de collecte/provenance restent distincts des constats métier. |
| [#232](https://github.com/dokor/argos/issues/232) P2 pools | Grizzly core 4/max 24/file 64, Hikari max 6 dans la configuration versionnée ; tests de configuration. | Valeurs de référence, pas dimensionnement prouvé du Raspberry (#212). |
| [#233](https://github.com/dokor/argos/issues/233) P2 tests frontières | Tests HTTP Jersey, auth interne, publication, lecture et tokens présents et exécutés pour les unitaires. | IT #224 et E2E contrôlés complètent ; ne pas réaffirmer « aucun test d'intégration ». |
| [#234](https://github.com/dokor/argos/issues/234) P2 responsabilités | `AuditService` création, `AuditQueryService` lecture, `AuditQueueService` exécution et `AuditResponseMapper` REST. | Séparation historique acquise ; traiter les nouvelles dérives comptes/partage dans #475. |
| [#235](https://github.com/dokor/argos/issues/235) P3 helpers | `Urls`, `JsonNodes`, `TechReportValues` et packages `modules/*` normalisés, tests de coercion. | Ne pas remplacer `UrlNormalizer` par un helper d'extraction ; [contrat](../analysis/helpers.md). |
| [#236](https://github.com/dokor/argos/issues/236) P3 progression | Mise à jour ciblée des statuts ; `RemoteModuleExecutor` borné SSL/Observatory ; `AuditRunProgressIT`. | Dépend #223/#224 ; mesure avant/après sur cible reste #212, pas nouvelle concurrence navigateur. |
| [#237](https://github.com/dokor/argos/issues/237) P3 couverture | JaCoCo en verify et artefact CI ; `SchedulerJobsTest`, `ConfigurationServiceTest`. | Baseline mesurée ci-dessus ; aucun seuil arbitraire ni ratio historique repris. |

Le reaper reste couvert par #127/#211 et `StuckAuditRunReaper`, sans nouveau doublon. Les réserves de sortie #259/#488 sont indépendantes de la clôture technique de ces 21 issues.

## Décisions et séquencement pour #475

| Priorité actuelle | Point observé → changement borné | Preuve attendue / dépendance |
| --- | --- | --- |
| P2, lot identité | Extraire validation email/nom de `AccountAuthService` vers `AccountIdentityValues` ; OAuth et REST consomment le contrat de valeur. | Emails invalides/normalisation, noms invalides et mêmes codes d'erreur ; suite comptes/OAuth. Aucun changement des méthodes de connexion. |
| P2, lot accès | Déplacer `AdminReadAccess` vers `services.security` ; analytics n'importe plus `webservices`. | Tests HTTP anonyme/credential invalide/valide ; tests analytics/admin. Pas de nouvelle autorisation. |
| P2, lot audit | Extraire les lectures personnelles dans un DAO dédié et ne sélectionner que les champs exposés et l'auditId nécessaire à la navigation. | Tri/limite, propriétaire étranger/absent, forme JSON, absence de lecture des blobs/credentials. La session reste validée dans la transaction. |
| P2, lot rapport | Extraire les requêtes de partage dans `ReportSharingDao` ; le service conserve la politique, les transactions et le contrôle du résultat propriétaire. | Propriétaire/tiers, rotation/révocation, expiration, accès détail authentifié et conservation du verrou run avant écriture. |
| P2, exploitation existante | #488, puis #94 et mesures #212. | Recette cible/observabilité/mémoire et délais réels ; aucune optimisation spéculative dans #475. |
| P3, à réévaluer | Gros processeur/compositeur et SQL dispersé dans autres services comptes/connectés. | Ne pas lancer de réécriture globale : choisir un cas concret et ses régressions à chaque évolution métier, sous l'epic #474. |

Ordre : diagnostic #128 relu, extractions #475 réversibles, tests ciblés puis `mvn verify`, CI MariaDB pour les changements de requêtes. La PR de refactoring doit référencer cette décision et publier les résultats réellement obtenus. Les deux PR peuvent viser main séparément : celle d'audit ne contient aucun code applicatif.

Les contrats sont conservés : API same-origin, audit sans compte, rôles/offres séparés, contrôles propriétaires serveur, SSRF BFF + backend, tokens hashés, rapport partiel compté une fois et échec sans rapport non compté. Aucune migration, facturation, plafond chiffré ou attribution premium n'est nécessaire. Aucun test navigateur, contrôle de production ni recette humaine n'est revendiqué par le diagnostic.
