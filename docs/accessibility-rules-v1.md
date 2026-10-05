# Matrice accessibilité v1 — #260

Statut : **proposition à valider**, sources consultées le **5 octobre 2026**.
`accessibilityComplianceVersion=1` désigne ce contrat documentaire ; le runtime conserve
`accessibility-compliance-proposal-v1`, `rulesValidated=false`, `risk=UNKNOWN`.
La fusion des PR #264–#266 n'approuve pas à elle seule les règles juridiques.

Périmètre proposé : services web fournis en France, avec contexte UE pour l'EAA.
Un domaine .fr, une langue ou un hébergement ne prouvent pas la juridiction.
Responsable de publication : mainteneur @dokor, après revue par un responsable
juridique/produit à désigner. Aucune activation automatique ni collecte financière.

## Sources et versions

| ID | Source officielle | Version / portée |
|---|---|---|
| EAA | [Directive 2019/882](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882) | 17 avril 2019 ; art. 2, 3, 4, 14, 30–32 |
| FR-EAA | [Code consommation L412-13](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047284913) | version depuis 11 mars 2023 |
| FR-EXIGENCES | [Arrêté du 9 octobre 2023](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000048178413) | exigences fonctionnelles françaises |
| A47 | [Article 47](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048050213) | version depuis 8 septembre 2023 |
| A47-CA | [Décret 2019-768 art. 2](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000038956842) | depuis 26 juillet 2019 ; texte consolidé actualisé 27 août 2026 |
| A47-SANCTION | [Article 47-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048050174) | depuis 8 septembre 2023 ; distinguer I/III/IV |
| EAA-SANCTION | [R451-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048180406/) | depuis 11 octobre 2023 ; I.10 pour prestataires |
| PENAL-PHYSIQUE | [131-13](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417259) | depuis 1 avril 2005 |
| PENAL-MORALE | [131-41](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417342) | depuis 1 mars 1994 |
| GUIDE-EAA | [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite) | aide à la lecture, ne remplace pas les textes |
| RGAA | [Champ et norme](https://accessibilite.numerique.gouv.fr/obligations/champ-application/) et [méthode](https://accessibilite.numerique.gouv.fr/methode/introduction/) | RGAA 4.1.2 ; WCAG 2.1 A/AA ; EN 301 549 V2.1.2 (2018-08) cité par ce référentiel |
| RGAA-EVOLUTION | [Dinum : RGAA 5](https://www.numerique.gouv.fr/actualites/nouvelle-version-rgaa-2026/) | annoncé pour fin 2026 ; pas traité comme déjà publié |
| WCAG-TECH | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | mapping technique partiel v1 de #261 ; distinct du référentiel juridique |

La version EN 301 549 V3.2.1 est un référentiel technique distinct ; ni sa seule
mention ni WCAG 2.2 ne prouvent la conformité à toutes les exigences EAA.
L'édition applicable et son éventuelle harmonisation doivent être revues pour le
service et la date concernés. Les obligations sectorielles (banque, transport,
communications, livres numériques notamment) demandent une revue ciblée.

## Matrice de décision proposée

Chaque ligne hérite de la date de consultation ci-dessus. Les entrées sont des
faits vérifiés humainement avec provenance, date et périmètre ; une observation
HTML ou une simple déclaration reste une hypothèse.

| Règle | Cadre / opérateur | Condition et données requises | Résultat documentaire | Sources |
|---|---|---|---|---|
| EAA-SERVICE | EAA, prestataire | service B2C relevant d'une catégorie visée ; pays, catégorie, destinataires et dates connus | POTENTIALLY_EAA, exemptions/transitions à vérifier | EAA art. 2 ; FR-EAA |
| EAA-COMMERCE | EAA, commerce électronique | contrat de consommation à distance ; prix + CTA seuls insuffisants | hypothèse faible, pas de verdict | EAA art. 3.30 |
| EAA-MICRO | EAA, prestataire de services | effectif < 10 **ET** (CA annuel ≤ 2 M€ **OU** bilan annuel ≤ 2 M€) | exemption EAA vérifiée seulement pour ce cadre/service | FR-EAA |
| A47-PUBLIC | article 47, personne morale publique | identité/statut de l'opérateur et service en ligne vérifiés | POTENTIALLY_ARTICLE_47 | A47 I.1 |
| A47-MISSION | article 47, privé | délégation de service public, ou critères d'intérêt général/contrôle/financement/constitution vérifiés | POTENTIALLY_ARTICLE_47 | A47 I.2–3 |
| A47-ENTREPRISE | article 47, entreprise | CA France des 3 exercices clos précédant l'année ; moyenne > 250 M€ | POTENTIALLY_ARTICLE_47 | A47 I.4 ; A47-CA |
| A47-ASSOCIATION | article 47, organisme privé non lucratif | absence de service essentiel et de service spécifique au handicap vérifiée | exclusion limitée à ce cadre | A47 I |
| CUMUL | deux cadres | conditions évaluées indépendamment | conserver les deux cadres | FR-EAA I (« sans préjudice ») |
| EXCEPTION | cadre concerné | évaluation documentée de charge disproportionnée / modification fondamentale ; obligations résiduelles | ne pas exclure tout le site automatiquement | FR-EAA II ; A47 II ; RGAA |
| TRANSITION | EAA | dates de contrat/produit et nature exactes connues | revue ciblée, jamais exemption globale « ancien site » | EAA art. 32 ; GUIDE-EAA |
| INCONNU | tous | juridiction, statut, catégorie, B2C, finances ou exemption manquants | UNKNOWN pour la décision non démontrable | choix conservateur Argos |
| HORS-CHAMP | périmètre nommé | exclusion/exemption de chaque cadre visé vérifiée, sans conflit | OUT_OF_SCOPE limité au périmètre et à la date ; aucune dispense universelle | choix conservateur Argos |

À 250 M€ exactement, la proposition retient la formulation « excède » d'A47 :
pas d'inclusion par ce seul seuil. Le rapprochement avec « à compter duquel » du
décret fait partie de la revue humaine ; le code existant ne calcule pas ce seuil.
Les finances ne sont jamais inférées du branding, de la taille du site ou scrapées.

Application EAA à partir du 28 juin 2025 : les transitions doivent être examinées
par type de contrat/produit. Un site/application antérieur n'est pas un produit
bénéficiant automatiquement du délai des produits utilisés pour fournir un service.
Les exemptions de contenu ne deviennent pas une exemption d'opérateur.

## Sanctions : conditions documentaires, affichage désactivé

| Régime | Qualité et manquement | Plafond contextuel | Sources |
|---|---|---|---|
| Article 47 | organismes I.1–3 ; obligation I, après procédure et mise en demeure | 50 000 € au plus | A47-SANCTION I–II |
| Article 47 | organismes I.1–4 ; obligations de publication III/IV, après procédure | 25 000 € au plus | A47-SANCTION I–II |
| EAA français, code consommation | personne physique ; infraction effectivement qualifiée de 5e classe, prestataire I.10 notamment | 1 500 € au plus hors régime de récidive | EAA-SANCTION ; PENAL-PHYSIQUE |
| Même contravention | personne morale, responsabilité établie | quintuple du plafond physique (7 500 € hors récidive) | PENAL-MORALE |

Ces plafonds ne sont ni une prédiction ni un devis d'amende. Une entreprise A47
I.4 ne reçoit pas automatiquement le plafond 50 000 €. Les cadres sectoriels,
récidives et cumuls réels ne sont pas calculés ici. Le nombre d'audits Lighthouse
échoués n'est jamais le nombre d'infractions juridiques.

Pour afficher une sanction dans une future version, il faut : règles publiées par
le responsable, juridiction/date et catégorie d'opérateur vérifiées, manquement
juridiquement qualifié, régime exact et procédure applicables, source à jour et
wording validé. Le contrat actuel n'a **aucun champ de sanction** : les montants
restent dans ce document de revue, jamais dans le rapport public.

## Fixtures et contrat avec #262/#263

[qualification-v1.json](../apps/api-backend/src/test/resources/accessibility/qualification-v1.json)
sépare :
- `legalReview` : faits synthétiques et résultat proposé pour une revue humaine ;
- `runtime` : HTML/faits abstraits déjà acceptés par le service #262 et sorties attendues.

Il n'existe pas d'endpoint de questionnaire, de vérification financière ou
d'évaluation juridique complète. Les fixtures ne prétendent pas que le moteur
calcule les seuils : la conversion de faits bruts en faits VERIFIED est une étape
humaine future. Une microentreprise vérifiée ne fournit pas automatiquement
`outsideScope=true` pour tous les cadres.

Provenance : OBSERVED = indice passif ; DECLARED = déclaration non contrôlée ;
VERIFIED = décision humaine étayée, jamais déduite du HTML. Cumul, conflit et
inconnues sont conservés. Les snapshots restent immuables à la lecture.

Le barème 0 / 1–2 / 3–9 / 10+ échecs de #262 est une **proposition de priorité
technique**, sans fondement juridique de probabilité/sanction. Il n'est pas validé
comme mesure du risque réglementaire. La revue doit décider de le remplacer ou
d'en préciser le sens avant toute activation. UNKNOWN/RULES_PENDING reste actif.

Wording de référence à conserver en FR/EN :
« Cette analyse automatisée ne constitue pas un audit complet ni une certification
de conformité. » / “This automated analysis is not a complete audit or a
certification of compliance.”
Hors champ : préciser les cadres et la date examinés. Inconnu : indiquer les
informations manquantes. Ne pas promettre « conforme », « sans risque » ou une amende.

## Publication et maintenance

- [ ] @dokor désigne le relecteur juridique/produit et confirme la juridiction France.
- [ ] Relecteur valide matrice, frontière 250 M€, transitions et référentiels.
- [ ] Relecteur décide du barème de risque et valide le wording FR/EN.
- [ ] Validation nominative/date/sources est consignée dans #260.
- [ ] Une PR séparée et testée active une nouvelle version, sans requalifier les rapports anciens.

Revoir à chaque modification de texte/référentiel, changement de pays/service,
ou avant une activation/publication ; consigner l'ancienne et la nouvelle version.
ADE 1.2.1 : revue Tech Lead, QA et Legal/Compliance ; ce livrable ne vaut pas leur
approbation humaine.
