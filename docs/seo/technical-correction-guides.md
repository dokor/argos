# Guides de correction LCP, CSP et HSTS — #302, #303, #304

Premières versions et traductions : 16 octobre 2026. Lecture technique par
comparaison au code Argos et aux références officielles ; aucune relecture
humaine ni validation de vocabulaire Search Console n’est revendiquée.
La PR reste en brouillon pour cette relecture avant publication.

| Sujet | Français | Anglais |
|---|---|---|
| LCP | `/guides/lcp-lent` | `/en/guides/slow-lcp` |
| CSP | `/guides/content-security-policy` | `/en/guides/content-security-policy` |
| HSTS | `/guides/hsts` | `/en/guides/hsts` |

Les pages utilisent un composant serveur commun, avec texte principal dans le
HTML initial, un H1, title/description, canonical propre, OG/Twitter, alternates
réciproques et entrées de sitemap. Les ressources, liens de correction des
rapports et liens entre guides utilisent les routes localisées. Le calcul du
score et les contrôles techniques ne changent pas.

## Vérification éditoriale technique

- LCP : [définition et seuils web.dev](https://web.dev/articles/lcp),
  [optimisation web.dev](https://web.dev/articles/optimize-lcp),
  [décomposition Chrome](https://developer.chrome.com/docs/performance/insights/lcp-breakdown)
  et [traces DevTools](https://developer.chrome.com/docs/devtools/performance).
  Distinction labo/terrain, p75 mobile/desktop, arbre TTFB/découverte/transfert/rendu.
  La démonstration locale possède des mesures réelles sur une page fictive,
  sans rapport privé ni domaine client. Les valeurs ne promettent aucun gain.
- CSP : [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP),
  [Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only),
  [script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src),
  [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
  et [W3C CSP3](https://www.w3.org/TR/CSP3/).
  Exemple Report-Only sans endpoint fictif, inventaire, violations et tests de
  régression, nonces/hash, limites du meta et de unsafe-inline. L’heuristique
  `SecurityHeaderValidation` est décrite sans promesse d’absence de XSS.
- HSTS : [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security),
  [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797) et
  [liste de préchargement](https://hstspreload.org/).
  Préconditions HTTPS, max-age court puis progressif, portée des sous-domaines,
  limites du retrait, pas de preload par défaut. Argos reconnaît un max-age
  positif et le contexte HTTPS ; cela ne valide pas tout le périmètre du site.

Références consultées le 16 octobre 2026. Les mots-clés des issues restent des
hypothèses : l’accès à Search Console n’était pas disponible dans cette tâche.
La relecture humaine doit confronter les formulations aux requêtes réelles et
confirmer les exemples avant mise en ligne. Les guides et leurs liens seront
publics et indexables une fois la PR relue, fusionnée et déployée par l’opérateur.

Preuves de rendu et de mesure : `outputs/ui-review/premium-guides/README.md`.
