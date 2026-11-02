import Link from "@/components/PageLink";
import { diagnosticGuides } from "@/lib/diagnosticGuides";
import GuideArticle from "@/components/guides/GuideArticle";
import { guideMetadata } from "@/components/guides/guideMetadata";
import s from "@/components/guides/GuideArticle.module.scss";

const guide = diagnosticGuides.crawlers;

export const metadata = guideMetadata(guide);

export default function CrawlGuidePage() {
  return (
    <GuideArticle guide={guide} contents={[
      { id: "etapes", label: "Distinguer accès et visibilité" },
      { id: "reponse", label: "Lire la réponse publique" },
      { id: "html", label: "Vérifier le contenu HTML" },
      { id: "robots", label: "Interpréter les règles robots" },
      { id: "usages-ia", label: "Choisir les usages IA" },
      { id: "validation", label: "Confirmer les observations" },
    ]} related={[
      { href: "/guides/refonte-site-web", label: "Vérifier ces règles après une refonte" },
      { href: "/guides/checklist-audit-site-web#indexabilite", label: "Reprendre les contrôles d’indexabilité de la checklist" },
      { href: "/ressources/audit-technique-gratuit", label: "Comprendre le périmètre de l’audit technique Argos" },
    ]}>
      <section id="etapes" aria-labelledby="etapes-title">
        <h2 id="etapes-title">Accessible, indexée et citée sont trois choses différentes</h2>
        <p>Un assistant ne cite pas votre page simplement parce qu’elle répond dans votre navigateur. Il faut distinguer <strong>l’accès à l’URL</strong>, la possibilité d’en lire le contenu, son éventuelle indexation et sa sélection pour une réponse. Ces étapes dépendent du service et de la question posée.</p>
        <p>Ce guide sert à rechercher des obstacles techniques sur une page publique. Il ne mesure pas sa notoriété et ne calcule pas un score de « visibilité IA ». Ici, l’accessibilité désigne l’accès des robots au contenu ; <Link href="/ressources/accessibilite-numerique">l’accessibilité numérique pour les personnes</Link> est un autre sujet à vérifier.</p>
        <div className={s.note}><p>Pour les expériences génératives de Google Search, les pratiques SEO habituelles restent pertinentes. Un fichier <code>llms.txt</code> ou un balisage spécial n’y donne pas de bonus : Google indique ne pas les utiliser à cette fin. D’autres services peuvent avoir leurs propres usages. <a href="https://developers.google.com/search/docs/fundamentals/ai-optimization-guide">Recommandations officielles Google</a>.</p></div>
      </section>

      <section id="reponse" aria-labelledby="reponse-title">
        <h2 id="reponse-title">1. Vérifier ce que reçoit un visiteur non connecté</h2>
        <p>Choisissez une page destinée à être publique. Ouvrez-la dans une fenêtre privée, puis examinez la requête du document dans l’onglet Réseau. Notez URL initiale, redirections, URL finale, statut et contenu retourné.</p>
        <ul>
          <li>Une erreur <code>401</code>, <code>403</code> ou <code>5xx</code> doit être examinée dans son contexte. Un blocage peut être intentionnel.</li>
          <li>Un statut <code>200</code> peut accompagner un écran de connexion, un challenge anti-robot ou un message d’erreur. Vérifiez le corps de la réponse.</li>
          <li>Comparez l’accès depuis vos outils avec les journaux du serveur ou du CDN. Une requête réussie depuis votre poste ne prouve pas qu’un robot reçoit la même réponse.</li>
        </ul>
        <p>Pour conserver une preuve sur une URL que vous administrez, remplacez l’adresse d’exemple dans cette commande. Elle suit les redirections et enregistre séparément en-têtes et corps :</p>
        <pre><code>{`curl -sS -L -D entetes.txt -o page.html https://example.com/service`}</code></pre>
        <p>N’envoyez ni cookie de connexion ni jeton privé pour simuler un accès public. Si le pare-feu semble impliqué, identifiez la règle et le robot concerné avant de modifier la protection. Changer seulement l’en-tête User-Agent d’un test ne reproduit pas l’identité réseau d’un véritable robot.</p>
      </section>

      <section id="html" aria-labelledby="html-title">
        <h2 id="html-title">2. Comparer le HTML initial et la page rendue</h2>
        <p>Dans <code>page.html</code> ou le code source, recherchez une phrase du contenu principal, le titre et un lien interne important. Comparez avec le DOM après exécution de JavaScript dans l’onglet Éléments.</p>
        <p>Google peut exécuter JavaScript, mais exploration, rendu et indexation sont des étapes distinctes. Un script bloqué ou une erreur peut empêcher le rendu attendu. Ne supposez pas que tous les assistants disposent des mêmes capacités. <a href="https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics">Fonctionnement du SEO JavaScript selon Google</a>.</p>
        <p>Pour votre diagnostic, notez ce qui manque sans JavaScript et ce qui n’arrive qu’après une interaction. Rendez les informations essentielles et les liens disponibles de façon fiable. Le rendu serveur ou la génération statique peut aider, sans devenir une condition universelle d’indexation.</p>
        <p>Un menu visible dans une capture ne suffit pas : contrôlez que les pages importantes ont des liens utilisables, avec une destination réelle. Un titre, des sections claires et des contenus factuels aident également les visiteurs à comprendre ce que votre page apporte.</p>
      </section>

      <section id="robots" aria-labelledby="robots-title">
        <h2 id="robots-title">3. Lire les règles sans confondre exploration et indexation</h2>
        <p>Ouvrez <code>/robots.txt</code> sur le domaine concerné. Identifiez le groupe correspondant au robot et les règles applicables au chemin. Sa présence ne prouve pas qu’une page est autorisée ; son absence ne signifie pas, à elle seule, que l’exploration est interdite.</p>
        <p><code>Disallow</code> limite l’exploration pour les robots qui respectent le protocole. Il ne protège pas un contenu privé et ne garantit pas qu’une URL disparaîtra des résultats. <a href="https://developers.google.com/search/docs/crawling-indexing/robots/intro">Rôle et limites de robots.txt</a>.</p>
        <p>Inspectez séparément <code>&lt;meta name=&quot;robots&quot;&gt;</code> et l’en-tête <code>X-Robots-Tag</code>. Pour que Google lise un <code>noindex</code>, il doit pouvoir accéder à la réponse qui le contient. <a href="https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag">Directives d’indexation et d’extraits</a>. Une canonique exprime une préférence de version ; elle ne prouve pas que cette URL est indexée. <a href="https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls">Signaux de canonicalisation</a>.</p>
        <p>Pour une page publique voulue dans la recherche, recherchez les restrictions involontaires et vérifiez les liens de découverte et le sitemap. Conservez les exclusions des pages privées ou sans intérêt pour la recherche.</p>
      </section>

      <section id="usages-ia" aria-labelledby="usages-title">
        <h2 id="usages-title">4. Choisir séparément recherche et entraînement</h2>
        <p>« Autoriser les IA » n’est pas une règle unique. Chez OpenAI, les rôles suivants sont distincts ; ils ne décrivent pas le fonctionnement de tous les fournisseurs.</p>
        <p className={s.tableHint}>Sur petit écran, faites défiler le tableau horizontalement.</p>
        <div className={s.tableWrap} role="region" aria-label="Rôles des robots et usages" tabIndex={0}>
          <table>
            <caption>Des accès différents selon le service</caption>
            <thead><tr><th scope="col">Agent</th><th scope="col">Rôle</th><th scope="col">Ce qu’il ne faut pas en déduire</th></tr></thead>
            <tbody>
              <tr><th scope="row">Googlebot</th><td>Exploration pour Google Search.</td><td>Un accès réussi ne garantit pas l’indexation ou une citation.</td></tr>
              <tr><th scope="row">OAI-SearchBot</th><td>Découverte de contenus pour la recherche ChatGPT.</td><td>Cette permission n’est pas celle de l’entraînement.</td></tr>
              <tr><th scope="row">GPTBot</th><td>Collecte de contenus susceptibles de servir à l’entraînement des modèles OpenAI.</td><td>Le bloquer ne bloque pas automatiquement OAI-SearchBot.</td></tr>
              <tr><th scope="row">ChatGPT-User</th><td>Consultations déclenchées par certaines actions d’utilisateurs.</td><td>Ce n’est pas le robot d’exploration automatique pour la recherche ; robots.txt peut ne pas s’appliquer à ces actions.</td></tr>
            </tbody>
          </table>
        </div>
        <p>Les contrôles de recherche et d’entraînement sont indépendants. Pour un véritable accès privé, utilisez une authentification et des autorisations serveur. <a href="https://developers.openai.com/api/docs/bots">Documentation officielle OpenAI sur les robots</a>.</p>
        <h3>Exemple : autoriser la recherche ChatGPT et refuser GPTBot</h3>
        <p>Voici un exemple pour un site fictif, avec trois zones exclues. Il illustre un choix éditorial, sans le recommander pour tous les sites. Ne remplacez pas votre fichier sans reprendre vos exclusions existantes.</p>
        <pre><code>{`User-agent: *
Disallow: /admin/
Disallow: /compte/
Disallow: /api/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin/
Disallow: /compte/
Disallow: /api/

User-agent: GPTBot
Disallow: /

Sitemap: https://example.com/sitemap.xml`}</code></pre>
        <p>Un groupe spécifique ne reprend pas automatiquement les restrictions du groupe <code>*</code> : elles sont donc répétées pour OAI-SearchBot. Relisez le fichier complet, y compris les autres groupes portant le même nom. <a href="https://www.rfc-editor.org/rfc/rfc9309.html">Règles du protocole, RFC 9309</a>.</p>
      </section>

      <section id="validation" aria-labelledby="validation-title">
        <h2 id="validation-title">5. Confirmer ce qui est observé, sans promettre une citation</h2>
        <p>Pour Google, utilisez l’inspection d’URL de Search Console si vous administrez la propriété. Distinguez la version connue de Google et le test en direct. Pour les autres services, confrontez leur documentation aux accès réellement observés dans vos journaux et aux outils de suivi disponibles.</p>
        <p>Argos repère certains signaux publics : réponse HTTP, structure HTML, présence de directives et ressources de découverte. Il ne simule pas chaque robot, ne valide pas toute votre politique robots.txt et ne connaît ni l’index réel d’un moteur ni ses choix de citation.</p>
        <p>Documentez votre conclusion par étape : « la réponse contient bien le texte », « la règle autorise ce chemin pour ce robot », ou « l’outil du moteur signale cette URL indexée ». Une réponse à une question dans un assistant peut varier ; elle ne constitue pas un test exhaustif de visibilité.</p>
        <p>Après une publication, reprenez ces points dans la <Link href="/guides/refonte-site-web">recette de refonte</Link>, puis suivez les résultats avec les données disponibles. L’accès technique est un préalable possible ; la pertinence, les preuves et l’utilité du contenu restent à travailler.</p>
      </section>
    </GuideArticle>
  );
}
