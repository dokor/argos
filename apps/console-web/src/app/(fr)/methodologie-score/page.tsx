import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import s from "./page.module.scss";

// À mettre à jour avec DefaultScorePolicy.VERSION, ses poids et ScoreService
// lors de tout changement de barème. Les anciens rapports gardent leur version.
const POLICY_VERSION = 11;

const domains = [
  { name: "Performance", description: "Chargement et comportement observé dans le navigateur, avec les mesures Argos et le score Performance de Lighthouse." },
  { name: "Sécurité", description: "HTTPS, en-têtes de protection, certificat et signaux d'outils externes lorsqu'ils sont disponibles." },
  { name: "SEO", description: "Signaux techniques de la page, comme le titre, la description, la structure HTML et les ressources d'indexation." },
  { name: "Accessibilité", description: "Contrôles automatisables sur le HTML et score Accessibilité de Lighthouse ; une revue humaine reste indispensable." },
] as const;

const example = [
  { domain: "Performance", checks: "Erreurs console : PASS (5/5) ; erreurs JavaScript : WARN (3/6)", points: "8 / 11", score: "72,7 %" },
  { domain: "Sécurité", checks: "HSTS : PASS (8/8) ; CSP : FAIL (0/10)", points: "8 / 18", score: "44,4 %" },
  { domain: "SEO", checks: "Titre HTML : PASS (4/4) ; méta-description : WARN (1,5/3)", points: "5,5 / 7", score: "78,6 %" },
  { domain: "Accessibilité", checks: "Textes alternatifs : PASS (4/4) ; langue HTML : PASS (2/2)", points: "6 / 6", score: "100 %" },
] as const;

export default function ScoreMethodologyPage() {
  return (
    <div className={s.page} lang="fr">
      <SiteNav fixedFrench />
      <main lang="fr">
        <header className={s.hero}>
          <div className={s.container}>
            <p className={s.eyebrow}>Méthode de calcul · Barème v{POLICY_VERSION}</p>
            <h1>Comment est calculé le score d&apos;audit Argos&nbsp;?</h1>
            <p className={s.lead}>Le score résume les contrôles techniques effectués sur une URL à un moment donné. Il aide à repérer les points à examiner, sans remplacer la lecture des constats et de la couverture des mesures.</p>
          </div>
        </header>

        <div className={s.container}>
          <nav className={s.contents} aria-label="Sommaire de la méthode">
            <p>Sur cette page</p>
            <a href="#domaines">Les quatre domaines</a>
            <a href="#calcul">Le calcul</a>
            <a href="#exemple">Un exemple chiffré</a>
            <a href="#limites">Les limites</a>
          </nav>

          <section id="domaines" className={s.section} aria-labelledby="domaines-title">
            <h2 id="domaines-title">Quatre domaines, un score global</h2>
            <p>Argos regroupe les contrôles scorables par domaine métier. Les noms des modules et des outils indiquent la provenance des mesures&nbsp;: ils ne créent pas de catégories supplémentaires.</p>
            <div className={s.domainGrid}>
              {domains.map((domain) => (
                <article key={domain.name} className={s.domainCard}>
                  <h3>{domain.name}</h3>
                  <p>{domain.description}</p>
                </article>
              ))}
            </div>
            <p>Quand les quatre domaines sont mesurables, chacun représente 25&nbsp;% du score global. Si un domaine entier ne peut pas être mesuré, sa part est répartie également entre ceux qui restent mesurables.</p>
          </section>

          <section id="calcul" className={s.section} aria-labelledby="calcul-title">
            <h2 id="calcul-title">Comment les points sont attribués</h2>
            <ol className={s.steps}>
              <li><strong>Choisir les contrôles applicables.</strong> Le barème v{POLICY_VERSION} associe à chaque clé connue un domaine et un poids précis. Un constat informatif, un contrôle inconnu ou une mesure indisponible ne retire pas de points.</li>
              <li><strong>Calculer les points.</strong> Un contrôle PASS obtient tout son poids, WARN la moitié et FAIL zéro. Certains contrôles gradués, notamment les scores de catégorie Lighthouse, utilisent leur ratio continu de 0 à 1 au lieu de cette règle par statut. La sévérité affichée ne détermine pas le poids.</li>
              <li><strong>Normaliser par domaine.</strong> Pour chaque domaine mesurable, Argos divise les points obtenus par la somme des poids des contrôles effectivement scorés. La moyenne des domaines mesurables donne ensuite le score global sur 100.</li>
            </ol>
            <div className={s.formula} aria-label="Formule du score">
              <p><strong>Score d&apos;un domaine</strong> = points obtenus ÷ poids des contrôles scorés × 100</p>
              <p><strong>Score global</strong> = moyenne des scores des domaines mesurables</p>
            </div>
            <p>Le rapport indique aussi la couverture des mesures&nbsp;: elle compare les poids mesurés aux poids attendus du catalogue, en excluant les contrôles non applicables. Une couverture insuffisante rend la note provisoire. Si aucun domaine n&apos;est mesurable, la note est indisponible.</p>
          </section>

          <section className={s.section} aria-labelledby="lighthouse-title">
            <h2 id="lighthouse-title">Argos et Lighthouse mesurent des choses différentes</h2>
            <p>Argos collecte ses propres constats HTTP, HTML, navigateur et sécurité. Il importe aussi quatre scores de catégorie Lighthouse quand le module répond&nbsp;: Performance, Accessibilité, Bonnes pratiques et SEO. Chaque score importé devient <em>un contrôle pondéré</em> dans le domaine Argos correspondant&nbsp;; le score global Argos n&apos;est donc pas le score Performance de Lighthouse.</p>
            <p>Par exemple, le score Performance Lighthouse a un poids de 22 dans le domaine Performance Argos. Un résultat Lighthouse de 80/100 apporte 17,6 points sur ces 22, avant les autres contrôles de ce domaine. Lighthouse calcule son propre score Performance à partir de métriques pondérées, selon sa méthode publiée par <a href="https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/" target="_blank" rel="noopener noreferrer">Chrome for Developers</a>.</p>
          </section>

          <section id="exemple" className={s.section} aria-labelledby="exemple-title">
            <h2 id="exemple-title">Exemple chiffré avec un module indisponible</h2>
            <p>Voici une simulation volontairement réduite, fondée sur des clés et poids réels du barème v{POLICY_VERSION}. Elle ne représente aucun site ni rapport client. Supposons que Lighthouse soit indisponible&nbsp;: ses contrôles ne participent pas aux points obtenus ni au dénominateur de chaque domaine.</p>
            <div className={s.tableWrap}>
              <table>
                <caption>Calcul illustratif avec les seuls contrôles indiqués</caption>
                <thead><tr><th scope="col">Domaine</th><th scope="col">Contrôles mesurés</th><th scope="col">Points</th><th scope="col">Score</th></tr></thead>
                <tbody>
                  {example.map((row) => <tr key={row.domain}><th scope="row">{row.domain}</th><td>{row.checks}</td><td>{row.points}</td><td>{row.score}</td></tr>)}
                </tbody>
              </table>
            </div>
            <p className={s.result}><strong>Score global&nbsp;: 74/100</strong> = (72,7 + 44,4 + 78,6 + 100) ÷ 4, arrondi à l&apos;entier.</p>
            <p>Le module Lighthouse indisponible n&apos;est pas assimilé à un échec. Les quatre domaines gardent ici des contrôles mesurés, donc chacun conserve 25&nbsp;% du global. La couverture signale les nombreuses mesures manquantes et rend cette note provisoire. Avec un module différent ou des contrôles supplémentaires, les dénominateurs et la note changeraient.</p>
          </section>

          <section id="limites" className={s.section} aria-labelledby="limites-title">
            <h2 id="limites-title">Ce qu&apos;un score unique ne peut pas garantir</h2>
            <ul className={s.limits}>
              <li>Le résultat décrit une URL et un instant&nbsp;: contenu, réseau, navigateur et services externes peuvent changer les mesures.</li>
              <li>Deux notes sont comparables surtout lorsque la version du barème, son empreinte et la couverture des mesures sont cohérentes. Le rapport conserve ces informations pour expliquer les écarts.</li>
              <li>Une bonne note ne certifie ni la sécurité, ni l&apos;accessibilité, ni le référencement d&apos;un site entier. Les vérifications humaines et les parcours non testés restent nécessaires.</li>
            </ul>
            <p>Pour situer les contrôles cités, consultez les références officielles&nbsp;: <a href="https://owasp.org/projects/secure-headers-project" target="_blank" rel="noopener noreferrer">OWASP pour les en-têtes de sécurité</a> et <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer">W3C pour les WCAG</a>. Le score Argos ne constitue pas une évaluation de conformité à ces référentiels.</p>
          </section>

          <section className={s.next} aria-labelledby="next-title">
            <h2 id="next-title">Approfondir le diagnostic</h2>
            <p>La méthode donne le contexte&nbsp;; les constats détaillés du rapport indiquent quoi vérifier et corriger.</p>
            <div className={s.links}>
              <Link href="/ressources/audit-technique-gratuit">Comprendre l&apos;audit technique</Link>
              <Link href="/ressources/accessibilite-numerique">Vérifier l&apos;accessibilité numérique</Link>
              <Link href="/ressources">Parcourir les autres guides</Link>
            </div>
            <p className={s.cta}>Vous pouvez aussi <Link href="/">lancer un audit gratuit</Link> de votre propre page.</p>
          </section>
        </div>
      </main>
      <SiteFooter fixedFrench />
    </div>
  );
}
