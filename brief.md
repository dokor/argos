# Argos - Outil d'audit de sites web

## Type

existing-iteration

## Summary

Argos est un outil d'audit de site web déployé en production sur argos.lelouet.fr.
L'utilisateur soumet une URL publique et suit la progression jusqu'à la publication
d'un rapport scoré (0-100), avec priorités et couverture des mesures. Le délai dépend
de la file et des services d'analyse ; aucun délai chiffré n'est garanti.
L'audit public fonctionne sans compte. L'espace connecté Clarté propose les détails
des rapports, les sites et URL suivies, l'historique, la découverte, les analyses par
lots, les quotas et les notifications. L'administration utilise les rôles de compte.
Les [contrats actifs](docs/README.md) décrivent les comportements et leurs limites.

## Goals

- Produire un rapport à partir de huit modules : HTTP, HTML, Runtime, Lighthouse, Observatory, SSL, ZAP et Tech, en explicitant les collectes absentes ou partielles.
- Catégoriser les problèmes par sévérité (critique / important / opportunité) avec des recommandations actionnables.
- Permettre le suivi des sites et URL d'un compte, avec historique et relances autorisées par ses quotas.
- Rendre l'outil utilisable sans expertise technique.
- Maintenir des parcours cohérents entre audit public, rapports et espace connecté ; l'[attente Premium](docs/product/premium-waitlist.md) reste distincte d'un abonnement payant.

## Audience

- Développeurs web et tech leads cherchant un diagnostic rapide de la qualité d'un site
- Agences web auditant les sites de leurs clients
- Propriétaires de sites non-techniques voulant comprendre les problèmes prioritaires
- Administrateur disposant du rôle ADMIN pour gérer les comptes, offres, quotas, analyses et statistiques

## Pages

- Accueil, pages d'acquisition, ressources, guides et exemple de rapport publics en FR/EN
- Progression de l'audit par module jusqu'à publication, avec erreurs et finalisation explicites
- Lecteur de rapport commun : synthèse publique, détails authentifiés, rapport propriétaire et partage révocable
- Espace connecté : vue d'ensemble, sites, domaines, découvertes, lots, historique, consommation et compte
- Administration des comptes et analyses, retours privés et statistiques sous session ACTIVE ADMIN

## Constraints

- Monorepo avec quatre applications : api-backend (Java 21 / Jersey / MariaDB), console-web (Next.js App Router / React / TypeScript), playwright-service et lighthouse-service (Node.js headless). Versions exactes dans les manifestes et lockfiles ; commandes dans les README des applications.
- Déploiement Docker + Traefik sur argos.lelouet.fr, sans interruption de service acceptable ; fusion et déploiement nécessitent une demande explicite, distincte de la livraison en PR.
- Les tokens de rapport sont pré-générés à la création du run ; seules leurs empreintes sont stockées. Le partage utilise un credential distinct et révocable. Respecter les [credentials](docs/security/report-credentials.md) et les [contrats de rapport](docs/report/unified-reports.md).
- Toute URL soumise par l'utilisateur doit passer la validation SSRF côté BFF ET backend
- Les logs ne doivent jamais contenir d'URLs brutes (utiliser sanitizeForLog / sanitizeUrl)
- SCSS Modules et tokens sémantiques `--argos-*` ; ne pas réintroduire Tailwind ou shadcn/Radix.
- Ne pas utiliser localStorage côté frontend ; respecter les contrats de cookies, session et consentement.
- Internationalisation FR/EN en place (LangContext + fr.json / en.json) - maintenir la parité

## Success Criteria

- Un utilisateur peut soumettre une URL et suivre la file, les modules et la publication sans confondre progression terminale et réussite des collectes.
- Le rapport est lisible et actionnable sans expertise technique
- Les modules d'analyse sont indépendants : la défaillance d'un module ne bloque pas les autres
- L'historique et les rapports sont accessibles selon les droits, les règles de partage et la rétention applicables ; un lien partagé ne donne aucun droit de propriété.
- Zéro régression sur les fonctionnalités existantes (rapport en temps réel, scoring, SEO)

## Notes

- [AGENTS.md](AGENTS.md) porte les conventions ; le [sommaire documentaire](docs/README.md) oriente vers les références maintenues. Ce brief résume le produit et ne remplace pas les contrats.
- Scoring : `DefaultScorePolicy`, catalogue par clé exacte ; domaines performance, security, seo et a11y. Voir la [méthode](docs/scoring/domain-calibration.md) et la [couverture](docs/scoring/measurement-coverage.md).
- Compteurs : constats uniques de `report.issues` via `buildReportModel` ; priorités : `report.summary.priorities`. Respecter le [modèle de lecture](docs/report/read-model.md).
- Schéma : toutes les migrations Flyway versionnées et les entités/Q* correspondantes font référence. Identifier la version suivante dans les sources SQL et Java, conserver l'historique et mettre à jour les entités après tout changement de schéma.
