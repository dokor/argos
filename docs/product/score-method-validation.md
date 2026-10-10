# Validation de la méthode du score — 10 octobre 2026

Source : DefaultScorePolicy.VERSION = 12 et ScoreService. Aucun changement du barème.

Le tableau public utilise runtime.console.errors (5), runtime.js.errors (6), http.security.hsts (8), http.security.csp (10), html.title (4), html.meta.description.present (3), html.images.alt_coverage (4) et html.lang (2). PASS = poids, WARN = moitié, FAIL = zéro pour ces contrôles discrets.

Calcul reproductible : Math.round(((8/11)+(8/18)+(5.5/7)+(6/6))*25) = 74. Lighthouse indisponible est exclu des dénominateurs ; les quatre domaines restent mesurables. La couverture compare les poids mesurés au catalogue attendu, sans assimiler cette simulation réduite à une couverture complète.

Lors de toute modification du barème : vérifier version, poids, règles continues, redistribution des domaines et cet exemple. Les anciens rapports conservent leur version. Ancre stable : /methodologie-score#resume ; détail : #calcul. Traduction complète et données éditoriales dans #390/#389.
