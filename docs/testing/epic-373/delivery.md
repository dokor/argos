# Livraison de la séquence de l’épic #373

28 tickets, une PR par ticket, dans la séquence demandée. Les PR sont empilées : intégrer dans cet ordre ; GitHub peut nécessiter de recibler la suivante sur main après fusion de sa base. Les trois premières ont été fusionnées par l’utilisateur. Aucune fusion effectuée par l’agent.

| Ticket | Travail | PR | Portée |
|---|---|---|---|
| [#70](https://github.com/dokor/argos/issues/70) | Landing audit gratuit | [#396](https://github.com/dokor/argos/pull/396) | Implémentation livrée |
| [#376](https://github.com/dokor/argos/issues/376) | Promesses et délai | [#397](https://github.com/dokor/argos/pull/397) | Implémentation livrée |
| [#387](https://github.com/dokor/argos/issues/387) | Métadonnées accueil | [#398](https://github.com/dokor/argos/pull/398) | Implémentation livrée |
| [#386](https://github.com/dokor/argos/issues/386) | Intentions SEO | [#399](https://github.com/dokor/argos/pull/399) | Implémentation livrée |
| [#42](https://github.com/dokor/argos/issues/42) | Plan de mesure analytics | [#400](https://github.com/dokor/argos/pull/400) | Partielle — ticket reste ouvert |
| [#69](https://github.com/dokor/argos/issues/69) | Rapport exemple | [#401](https://github.com/dokor/argos/pull/401) | Implémentation livrée |
| [#374](https://github.com/dokor/argos/issues/374) | Correction dans aperçu | [#402](https://github.com/dokor/argos/pull/402) | Implémentation livrée |
| [#375](https://github.com/dokor/argos/issues/375) | Navigation publique | [#403](https://github.com/dokor/argos/pull/403) | Implémentation livrée |
| [#377](https://github.com/dokor/argos/issues/377) | Conventions visuelles | [#404](https://github.com/dokor/argos/pull/404) | Implémentation livrée |
| [#385](https://github.com/dokor/argos/issues/385) | Réduction des répétitions | [#405](https://github.com/dokor/argos/pull/405) | Implémentation livrée |
| [#378](https://github.com/dokor/argos/issues/378) | Parcours ressources | [#406](https://github.com/dokor/argos/pull/406) | Implémentation livrée |
| [#379](https://github.com/dokor/argos/issues/379) | Brief PME | [#407](https://github.com/dokor/argos/pull/407) | Implémentation livrée |
| [#380](https://github.com/dokor/argos/issues/380) | Exemple e-commerce | [#408](https://github.com/dokor/argos/pull/408) | Implémentation livrée |
| [#382](https://github.com/dokor/argos/issues/382) | Checklist interactive | [#409](https://github.com/dokor/argos/pull/409) | Implémentation livrée |
| [#300](https://github.com/dokor/argos/issues/300) | Méthode du score | [#410](https://github.com/dokor/argos/pull/410) | Implémentation livrée |
| [#16](https://github.com/dokor/argos/issues/16) | Contact personnel | [#411](https://github.com/dokor/argos/pull/411) | Implémentation livrée |
| [#381](https://github.com/dokor/argos/issues/381) | FAQ décisive | [#412](https://github.com/dokor/argos/pull/412) | Implémentation livrée |
| [#383](https://github.com/dokor/argos/issues/383) | À propos et confiance | [#413](https://github.com/dokor/argos/pull/413) | Implémentation livrée |
| [#384](https://github.com/dokor/argos/issues/384) | Confidentialité et informations légales | [#414](https://github.com/dokor/argos/pull/414) | Partielle — ticket reste ouvert |
| [#347](https://github.com/dokor/argos/issues/347) | Protocole de retours agences | [#415](https://github.com/dokor/argos/pull/415) | Partielle — ticket reste ouvert |
| [#395](https://github.com/dokor/argos/issues/395) | Indexation des rapports privés | [#416](https://github.com/dokor/argos/pull/416) | Implémentation livrée |
| [#391](https://github.com/dokor/argos/issues/391) | Test de vitesse | [#417](https://github.com/dokor/argos/pull/417) | Implémentation livrée |
| [#392](https://github.com/dokor/argos/issues/392) | Analyse SEO | [#418](https://github.com/dokor/argos/pull/418) | Implémentation livrée |
| [#393](https://github.com/dokor/argos/issues/393) | En-têtes de sécurité | [#419](https://github.com/dokor/argos/pull/419) | Implémentation livrée |
| [#394](https://github.com/dokor/argos/issues/394) | Test automatique accessibilité | [#420](https://github.com/dokor/argos/pull/420) | Implémentation livrée |
| [#389](https://github.com/dokor/argos/issues/389) | Provenance éditoriale | [#421](https://github.com/dokor/argos/pull/421) | Implémentation livrée |
| [#388](https://github.com/dokor/argos/issues/388) | Liens vers guides publiés | [#422](https://github.com/dokor/argos/pull/422) | Implémentation livrée |
| [#390](https://github.com/dokor/argos/issues/390) | Guides anglais et liens de langue | [#423](https://github.com/dokor/argos/pull/423) | Implémentation livrée |

Les PR partielles ne ferment pas leur ticket : #42 fournit le plan de mesure, mais pas encore la collecte analytics ; #384 publie les faits vérifiés, mais les informations juridiques obligatoires, la rétention réelle et les paramètres des prestataires en production restent à confirmer ; #347 fournit le protocole de recueil et de consentement, aucun témoignage réel autorisé n’étant disponible. Aucun contact externe n’a été envoyé.

Validation finale : 37 fichiers de tests frontend, 209 tests réussis ; lint et build réussis. Vérifications visuelles et clavier par ticket, thèmes clair/sombre, largeurs 360/390/768/1440 et reflow à 200 %. Pour #390, 64 scénarios de présentation et 8 rendus SSR de guides, liens de langue réciproques, sitemap, repli explicite des pages françaises et checklist anglaise. Pour #395, 12 états de rapports FR/EN vérifiés en HTTP avec métadonnées et en-têtes noindex/nofollow. Checklist également vérifiée à l’impression.

Les résultats détaillés et décisions figurent dans docs/testing/epic-373, docs/product, docs/seo et dans chaque description de PR. La refonte applicative du rapport reste dans l’épic #362. Aucun effet sur le classement Google, aucune durée moyenne d’audit et aucune conformité juridique ou d’accessibilité ne sont revendiqués par ces vérifications.
