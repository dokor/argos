# Argos — Outil d'audit de sites web

## Type

existing-iteration

## Summary

Argos est un outil d'audit de site web déployé en production sur argos.lelouet.fr.
L'utilisateur soumet une URL et obtient en quelques secondes un rapport scoré (0-100),
structuré et actionnable sur la qualité du site. Le projet est fonctionnel et les
développements actuels portent sur l'amélioration de l'expérience utilisateur,
la persistance des analyses dans le temps, et l'évolution vers une offre SaaS.

## Goals

- Fournir un rapport d'audit complet (8 modules : HTTP, HTML, Runtime, Lighthouse, Observatory, SSL, ZAP, Tech) en moins de 30 secondes.
- Catégoriser les problèmes par sévérité (critique / important / opportunité) avec des recommandations actionnables.
- Permettre le suivi des évolutions d'un domaine dans le temps (persistance ARG_DOMAIN / ARG_DOMAIN_ANALYSIS).
- Rendre l'outil utilisable sans expertise technique.
- Ouvrir la voie à une offre SaaS (comptes utilisateur, historique, abonnements).

## Audience

- Développeurs web et tech leads cherchant un diagnostic rapide de la qualité d'un site
- Agences web auditant les sites de leurs clients
- Propriétaires de sites non-techniques voulant comprendre les problèmes prioritaires
- Administrateur (dashboard interne) gérant les audits et abonnements newsletter

## Pages

- Landing page publique avec formulaire de soumission d'URL
- Vue de progression en temps réel (polling par module, statut QUEUED/RUNNING/COMPLETED)
- Rapport public scoré avec hero, PriorityCards, ScoreGrid, IssuesByCategory
- Dashboard admin (liste des audits, gestion)
- Page login admin

## Constraints

- Monorepo avec 4 applications : api-backend (Java 21 / Jersey / MariaDB), console-web (Next.js 14), playwright-service (Node.js headless), lighthouse-service (Node.js headless)
- Déploiement Docker + Traefik sur argos.lelouet.fr — pas de downtime acceptable
- Les tokens de rapport sont pré-générés à la création du run (ne pas changer ce mécanisme)
- Toute URL soumise par l'utilisateur doit passer la validation SSRF côté BFF ET backend
- Les logs ne doivent jamais contenir d'URLs brutes (utiliser sanitizeForLog / sanitizeUrl)
- Pas de localStorage côté frontend (non supporté dans l'environnement Next.js)
- Internationalisation FR/EN en place (LangContext + fr.json / en.json) — maintenir la parité

## Success Criteria

- Un utilisateur peut soumettre une URL et obtenir un rapport complet en moins de 30 secondes
- Le rapport est lisible et actionnable sans expertise technique
- Les modules d'analyse sont indépendants : la défaillance d'un module ne bloque pas les autres
- Les analyses d'un domaine sont persistées et consultables dans le temps
- Zéro régression sur les fonctionnalités existantes (rapport en temps réel, scoring, SEO)

## Notes

- Architecture détaillée dans AGENTS.md (stack, routes, DB schema, conventions)
- Scoring : ScorePolicyV1 par checkKey puis préfixe ; catégories prioritaires : performance, security, seo, a11y
- Compteurs ReportHero : source unique = report.issues (pas summary.priorities)
- Migrations Flyway : V1 à V5 en place — toute nouvelle feature DB nécessite une V6+
