# Pages d’acquisition : contrat éditorial

Routes retenues dans #386. Chaque entrée lance le même audit transversal via AuditForm, BFF same-origin et validations existantes ; aucun nouveau moteur. Contenu SSR et canonique propre ; pas de hreflang vers une traduction absente.

#391 : LCP/FCP proviennent des audits Lighthouse remontés quand disponibles (LighthouseModuleAnalyzer.numericValue/numericUnit), pas d’un runtime LCP absent. Runtime actuel expose timings DOMContentLoaded/load, erreurs et poids estimé. Exemple de 2800 ms fictif, pas une mesure réelle. Aucune collecte CrUX/INP ni rapidité mobile promise.

Guide spécialisé #302 non publié dans le dépôt : aucun lien vers une route absente. Les références web.dev, la checklist, la méthode et la démonstration sont disponibles. #388 activera les destinations spécifiques seulement après publication.
