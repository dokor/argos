# Argos — Instructions pour Claude Code

> Pour la documentation technique complète du projet (stack, routes, DB, conventions),
> lire **AGENTS.md** en priorité. Ce fichier couvre uniquement les workflows IA.

---

## AI Delivery Engine (ADE)

ADE est installé comme devDependency (`@alelouet/ai-delivery-engine`).
Il transforme le brief Argos en backlog structuré et génère des prompts spécialistes.

```bash
# Depuis la racine du monorepo
npx ade backlog:run brief.md               # génère un backlog depuis brief.md
npx ade prompt:po brief.md                 # génère le prompt PO/PM
npx ade import:po outputs/<fichier>.json   # importe une réponse PO/PM
npx ade backlog:export                     # exporte les items en Markdown
npx ade prompt:specialists                 # génère tous les prompts spécialistes
npx ade prompt:specialist <role> <item.md> # génère un prompt pour un item précis
npx ade specialist:check <response.md>     # valide une réponse spécialiste
npx ade project:status                     # état du projet local
```

Rôles disponibles : `ux-ui`, `frontend`, `backend`, `qa`, `tech-lead`,
`legal-compliance`, `security`, `devops`, `data-analytics`, `customer-success`

---

## Workflow 1 — Enrichissement des issues GitHub

**Déclencheur :** "Parcours les issues et améliore leurs descriptions"

### Étapes

**1. Lister les issues non traitées**
```bash
gh issue list --repo dokor/argos --state open --json number,title,body,labels,url --limit 50
```

**2. Filtrer** celles sans label `backlog-refined` ET sans label `ready-for-dev`.

**3. Pour chaque issue à enrichir :**

a. Analyser le contenu (titre + description existante) et le contexte Argos (AGENTS.md)

b. Identifier le profil le plus pertinent :
   - Backend → Java, API REST, DB, modules d'analyse, scheduler
   - Frontend → Next.js, composants rapport, BFF, i18n
   - Security → SSRF, tokens, headers, ZAP, sanitization
   - DevOps → Docker, Traefik, déploiement, infra/compose/
   - QA → tests Java (mvn test), tests frontend, régressions rapport

c. Générer une description améliorée :
   - Objectif clair (user story ou énoncé technique)
   - Critères d'acceptation (≥3 checkboxes `- [ ]`)
   - Contexte technique (packages concernés, fichiers, contraintes)
   - Labels suggérés

d. Si l'issue couvre plus de 3 jours de travail, la découper :
   ```bash
   gh issue create --repo dokor/argos --title "<titre>" --body "<description>"
   ```

e. Mettre à jour l'issue :
   ```bash
   gh issue edit <NUMBER> --repo dokor/argos --body "<IMPROVED_BODY>"
   gh issue edit <NUMBER> --repo dokor/argos --add-label "backlog-refined"
   ```

**4. Résumer** : issues traitées, labels ajoutés, sous-issues créées.

---

## Workflow 2 — Développement d'une issue

**Déclencheur :** "Prends l'issue <N> et développe-la"

### Étapes

**1. Lire l'issue**
```bash
gh issue view <N> --repo dokor/argos --json number,title,body,labels,url
```

**2. Marquer comme in-progress**
```bash
gh issue edit <N> --repo dokor/argos --add-label "in-progress"
```

**3. Créer une branche**
```bash
git checkout -b feat/issue-<N>-<slug-du-titre>
```

**4. Planifier** (lire AGENTS.md pour le contexte technique Argos)
- Identifier les packages/fichiers à modifier
- Backend : vérifier les migrations Flyway si changement DB
- Frontend : vérifier les impacts i18n (fr.json / en.json)

**5. Implémenter**

Backend Java :
```bash
cd apps/api-backend && mvn test    # valider après chaque changement
```

Frontend Next.js :
```bash
cd apps/console-web && npm run lint && npm run test
```

**6. Générer les reviews spécialistes**
```bash
# Décrire les changements dans un fichier
cat > /tmp/issue-<N>-impl.md << 'EOF'
# Issue #<N>: <Titre>
## Ce qui a été implémenté
<description>
## Fichiers modifiés
<liste>
EOF

# Générer les prompts de review
npx ade prompt:specialist security /tmp/issue-<N>-impl.md outputs/
npx ade prompt:specialist qa /tmp/issue-<N>-impl.md outputs/
npx ade prompt:specialist tech-lead /tmp/issue-<N>-impl.md outputs/
```

Lire les prompts, jouer les rôles, corriger si des points sont soulevés.

**7. Vérification finale**
```bash
cd apps/api-backend && mvn test
cd apps/console-web && npm run lint && npm run test
```

**8. Créer la PR**
```bash
gh pr create --repo dokor/argos \
  --title "feat: <titre court>" \
  --body "$(cat <<'PREOF'
Closes #<N>

## Résumé
<changements en 2-3 lignes>

## Changements
- <fichier> : <ce qui a changé>

---

## Security Review
<findings + corrections>

## QA Review
<cas couverts + risques résiduels>

## Tech Lead Review
<séquençage + architecture>

---
*Généré avec AI Delivery Engine — review humaine requise avant merge.*
PREOF
)"
```

**9. Notifier**
```bash
PR_NUMBER=$(gh pr list --repo dokor/argos --head "feat/issue-<N>-<slug>" --json number --jq '.[0].number')
gh issue comment <N> --repo dokor/argos --body "PR prête pour review : #${PR_NUMBER} — cc @alelouet"
gh issue edit <N> --repo dokor/argos --remove-label "in-progress" --add-label "pr-ready"
```

---

## Workflow 3 — Review et merge (manuel)

@alelouet reçoit la notification, fait la review finale et merge.
**Claude Code ne merge jamais sans validation humaine explicite.**

---

## Convention de labels GitHub

| Label | Signification |
|---|---|
| `backlog-refined` | Issue enrichie, prête pour estimation |
| `ready-for-dev` | Prête à développer |
| `in-progress` | Développement en cours |
| `pr-ready` | PR créée, en attente de review |
| `needs-info` | Informations manquantes |
| `backend` / `frontend` / `security` / `devops` / `qa` | Domaine |

---

## Règles importantes

- **Ne jamais merger sans validation humaine.**
- **Toujours lancer les tests** avant de créer une PR (mvn test + npm test).
- Pour toute migration DB : créer une migration Flyway V(N+1) ET mettre à jour l'entité + classe Q* manuellement.
- Les tokens de rapport sont pré-générés à la création du run — ne pas modifier ce mécanisme.
- Consulter AGENTS.md pour toute question sur la stack, les routes, ou les conventions.
