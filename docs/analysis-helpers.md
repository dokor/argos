# Helpers et packages des modules — #235

`com.dokor.argos.util.Urls` centralise l'extraction de host pour SSL,
Observatory et les deux services de rapport. Il conserve la sémantique de
`URI.getHost()` (casse, port exclu, crochets IPv6), sans trim ni résolution DNS.
Une URI valide sans host retourne null. Le fallback explicite des rapports ne
s'applique qu'à une URI malformée, comme auparavant.

`UrlNormalizer` conserve sa validation SSRF et sa normalisation. Son extraction
sur une URL déjà validée reste stricte : une erreur de programmation doit y
échouer, plutôt qu'être absorbée par le helper de lecture défensif.

`JsonNodes` sert aux trois analyzers Observatory, SSL et Lighthouse. Les lectures
préservent les différences historiques :

| Lecture | Contrat |
|---|---|
| `text` | absent/null/vide et texte `"null"` → null ; `asText()` pour les scalaires |
| `nonBlankText` | même coercion, mais conserve le texte `"null"` pour Lighthouse |
| `intValue` | `asInt(default)` ; accepte notamment les entiers textuels |
| `firstInt` | premier champ numérique convertible en int ; ignore les entiers textuels |
| `firstText` | premier champ accepté par `text` |

Les conversions de maps Tech restent dans `TechReportValues`, package-private,
utilisé uniquement par `TechReportMapper`. Elles conservent notamment les chaînes
vides et `"null"`, contrairement aux lectures JsonNode ; aucune conversion via
Jackson n'est interposée. Les contrats et le JSON public d'une fixture mêlant
plusieurs types sont testés.

Les classes Lighthouse sont dans `services.analysis.modules.lighthouse` ;
`PlaywrightRuntimeClient` est dans `services.analysis.modules.runtime`. Imports,
injection Guice et tests suivent les packages. Les IDs, clés de checks, payloads
et recommandations sont inchangés. Le test d'orchestration vérifie toujours les
huit IDs dans leur ordre historique ; les tests existants des modules et de
composition de rapport restent exécutés.
