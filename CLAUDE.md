# Argos — Instructions pour Claude Code

> Pour la documentation technique complète (stack, routes, DB, conventions),
> lire **AGENTS.md** en priorité. Ce fichier couvre uniquement les workflows IA.

---

## AI Delivery Engine (ADE)

ADE est installé comme devDependency (`@alelouet/ai-delivery-engine`).

```bash
npx ade backlog:run brief.md
npx ade prompt:po brief.md
npx ade prompt:specialist <role> <item.md>
npx ade prompt:specialists
npx ade project:status
```

Rôles : `ux-ui`, `frontend`, `backend`, `qa`, `tech-lead`,
`legal-compliance`, `security`, `devops`, `data-analytics`, `customer-success`

---

## Workflow 1 — Enrichissement des issues GitHub

**Déclencheur :** "Parcours les issues et améliore leurs descriptions"

**1. Lister les issues non traitées**
```bash
gh issue list --repo dokor/argos --state open --json number,title,body,labels,url --limit 50
```

**2. Filtrer** celles sans label `backlog-refined` ET sans label `ready-for-dev`.

**3. Pour chaque issue à enrichir :**

a. Analyser le contenu dans le contexte Argos (consulter AGENTS.md)

b. Identifier le rôle ADE dominant selon les mots-clés du titre/corps :
   - `backend`  → Java, API, base de données, scheduler, module d'analyse
   - `frontend` → Next.js, composant, UI, rapport, BFF, i18n
   - `security` → SSRF, token, vulnérabilité, authentification, headers
   - `devops`   → Docker, Traefik, déploiement, CI/CD, infra
   - `qa`       → tests, régressions, couverture, acceptance
   - `ux-ui`    → expérience utilisateur, design, accessibilité, formulaire
   - `legal-compliance` → RGPD, consentement, mentions légales
   - `tech-lead` → architecture, performance, dette technique

c. Générer une description améliorée en adoptant la perspective du rôle identifié :
   - Objectif clair (user story ou énoncé technique)
   - Critères d'acceptation (≥ 3 checkboxes `- [ ]`)
   - Contexte technique (packages, fichiers, contraintes Argos)
   - Labels suggérés (le rôle identifié + domaine)

d. Si l'issue couvre plus de 3 jours, la découper :
   ```bash
   gh issue create --repo dokor/argos --title "<titre>" --body "<description>"
   ```

e. Mettre à jour l'issue :
   ```bash
   gh issue edit <N> --repo dokor/argos --body "<IMPROVED_BODY>"
   gh issue edit <N> --repo dokor/argos --add-label "backlog-refined"
   ```

**4. Résumer** les issues traitées.

---

## Workflow 2 — Développement d'une issue

**Déclencheur :** "Travaille sur l'issue <N>" ou "Développe l'issue <N>"

### ⚠️ Gate PO/PM obligatoire — à exécuter AVANT tout développement

**1. Lire l'issue**
```bash
gh issue view <N> --repo dokor/argos --json number,title,body,labels,url
```

**2. Vérifier les labels**

- Si l'issue a le label `backlog-refined` ou `ready-for-dev` → continuer au développement.
- Si l'issue N'a PAS ces labels → **STOP. Enrichir d'abord.**

**Procédure d'enrichissement obligatoire (si pas backlog-refined) :**

a. Analyser l'issue dans le contexte Argos (AGENTS.md).

b. Identifier le rôle ADE dominant (backend / frontend / security / devops / qa / ux-ui / tech-lead)
   selon les mots-clés du titre/corps (voir Workflow 1 step 3b).

c. Rédiger une version enrichie en adoptant la perspective du rôle identifié :
   - Objectif clair (une phrase)
   - Critères d'acceptation (≥ 3 checkboxes `- [ ]`)
   - Contexte technique (fichiers concernés, dépendances, migration Flyway si besoin)
   - Risques identifiés (sécurité, régressions, i18n)

d. Mettre à jour l'issue et la labelliser :
   ```bash
   gh issue edit <N> --repo dokor/argos --body "<ENRICHED_BODY>"
   gh issue edit <N> --repo dokor/argos --add-label "backlog-refined"
   ```

e. Une fois l'issue mise à jour sur GitHub, **continuer automatiquement au développement**
   sans attendre de validation manuelle.

---

### Développement

**3. Marquer comme in-progress**
```bash
gh issue edit <N> --repo dokor/argos --add-label "in-progress"
```

**4. Créer une branche**
```bash
git checkout -b feat/issue-<N>-<slug-du-titre>
```

**5. Planifier** (lire AGENTS.md pour le contexte technique Argos)
- Identifier les packages/fichiers à modifier
- Backend : vérifier si une migration Flyway est nécessaire
- Frontend : vérifier les impacts i18n (fr.json / en.json)

**6. Implémenter**

Backend Java :
```bash
cd apps/api-backend && mvn test
```

Frontend Next.js :
```bash
cd apps/console-web && npm run lint && npm run test
```

**7. Générer les reviews spécialistes**

Créer un fichier décrivant l'implémentation :
```bash
cat > /tmp/issue-<N>-impl.md << 'EOF'
# Issue #<N>: <Titre>
## Ce qui a été implémenté
<description>
## Fichiers modifiés
<liste>
EOF
```

Sélectionner les rôles selon le domaine de l'issue :
- **Toujours** : `tech-lead` + `qa`
- Issue `backend`  → ajouter `backend` + `security`
- Issue `frontend` → ajouter `frontend` + `ux-ui`
- Issue `security` → ajouter `security` (prioritaire)
- Issue `devops`   → ajouter `devops` + `security`
- Issue `legal-compliance` → ajouter `legal-compliance`

```bash
# Exemple pour une issue backend :
npx ade prompt:specialist tech-lead /tmp/issue-<N>-impl.md outputs/
npx ade prompt:specialist qa /tmp/issue-<N>-impl.md outputs/
npx ade prompt:specialist backend /tmp/issue-<N>-impl.md outputs/
npx ade prompt:specialist security /tmp/issue-<N>-impl.md outputs/
```

Lire les prompts générés, jouer les rôles, corriger si des points sont soulevés.

**8. Vérification finale**
```bash
cd apps/api-backend && mvn test
cd apps/console-web && npm run lint && npm run test
```

**9. Pousser la branche et créer la PR**
```bash
git push -u origin $(git branch --show-current)
```

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

**10. Review post-PR — Tech Lead + QA sur le diff réel**

```bash
PR_NUMBER=$(gh pr list --repo dokor/argos --head "feat/issue-<N>-<slug>" --json number --jq '.[0].number')

# Récupérer le diff complet de la PR
gh pr diff ${PR_NUMBER} --repo dokor/argos > /tmp/pr-${PR_NUMBER}-diff.md

# Créer le fichier de contexte pour les reviews
cat > /tmp/pr-${PR_NUMBER}-review.md << EOF
# PR #${PR_NUMBER} — Review post-implémentation
Issue : #<N> — <Titre>

## Diff complet
$(cat /tmp/pr-${PR_NUMBER}-diff.md)
EOF
```

Générer les reviews sur le diff réel — mêmes rôles que l'étape 7 (toujours tech-lead + qa, plus les rôles domaine) :
```bash
npx ade prompt:specialist tech-lead /tmp/pr-${PR_NUMBER}-review.md outputs/
npx ade prompt:specialist qa /tmp/pr-${PR_NUMBER}-review.md outputs/
# Ajouter les rôles domaine selon le type de l'issue (backend+security, frontend+ux-ui, devops+security…)
```

Jouer les rôles sur le diff. Deux cas possibles :

**Cas A — Aucun point bloquant** : passer à l'étape 11.

**Cas B — Des corrections sont nécessaires** :
- Corriger le code sur la même branche
- Relancer les tests :
  ```bash
  cd apps/api-backend && mvn test
  cd apps/console-web && npm run lint && npm run test
  ```
- Pousser les corrections :
  ```bash
  git add . && git commit -m "fix: <description de la correction>"
  git push
  ```
- Retourner à l'étape 10 (re-review du nouveau diff)
- La PR reste `in-progress` pendant toute cette phase

**11. Notifier — uniquement quand toutes les reviews passent**
```bash
gh issue comment <N> --repo dokor/argos --body "PR #${PR_NUMBER} prête pour review : cc @alelouet"
gh issue edit <N> --repo dokor/argos --remove-label "in-progress" --add-label "pr-ready"
gh pr edit ${PR_NUMBER} --repo dokor/argos --add-assignee "alelouet"
```

---

## Workflow 3 — Review et merge (manuel)

@alelouet reçoit la notification GitHub (assignation + commentaire), fait la review finale et merge.
**Claude Code ne merge jamais sans validation humaine explicite.**

---

## Convention de labels GitHub

| Label | Signification |
|---|---|
| `backlog-refined` | Issue enrichie automatiquement par Claude Code |
| `ready-for-dev` | Prête à développer (estimée, critères clairs) |
| `in-progress` | Développement en cours |
| `pr-ready` | PR créée, reviews passées, en attente de merge |
| `needs-info` | Informations manquantes |
| `backend` / `frontend` / `security` / `devops` / `qa` | Domaine |

---

## Règles importantes

- **L'issue doit avoir le label `backlog-refined` avant tout développement** (ajouté automatiquement après enrichissement).
- **Ne jamais merger sans validation humaine.** Même si tous les tests passent.
- **Toujours lancer les tests** avant de créer une PR.
- Pour toute migration DB : créer une migration Flyway V(N+1) ET mettre à jour l'entité + classe Q* manuellement.
- Consulter AGENTS.md pour toute question sur la stack, les routes, ou les conventions.
