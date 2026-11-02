import Link from "@/components/PageLink";
import { diagnosticGuides } from "@/lib/diagnosticGuides";
import GuideArticle from "@/components/guides/GuideArticle";
import { guideMetadata } from "@/components/guides/guideMetadata";
import s from "@/components/guides/GuideArticle.module.scss";

const guide = diagnosticGuides.redesign;

export const metadata = guideMetadata(guide);

export default function RedesignGuidePage() {
  return (
    <GuideArticle guide={guide} contents={[
      { id: "perimetre", label: "Définir la recette" },
      { id: "avant", label: "Préparer avant publication" },
      { id: "url", label: "Vérifier les anciennes URL" },
      { id: "publication", label: "Contrôler la production" },
      { id: "suivi", label: "Surveiller après publication" },
      { id: "grille", label: "Télécharger la grille" },
    ]} related={[
      { href: "/guides/cls-eleve", label: "Diagnostiquer les décalages de mise en page" },
      { href: "/guides/accessibilite-moteurs-ia", label: "Vérifier l’accès des moteurs et assistants IA" },
      { href: "/guides/checklist-audit-site-web", label: "Reprendre les six vérifications générales d’audit" },
    ]}>
      <section id="perimetre" aria-labelledby="perimetre-title">
        <h2 id="perimetre-title">Définir ce qui doit continuer à fonctionner</h2>
        <p>Une nouvelle maquette peut être validée alors qu’un ancien lien renvoie une erreur ou que le formulaire ne transmet plus les demandes. La <strong>recette technique</strong> consiste à vérifier le site livré avec des résultats attendus, sur les pages et parcours qui comptent pour votre activité.</p>
        <p>Commencez par nommer une personne qui décide de la publication, une personne capable de revenir à la version précédente et les responsables des corrections. Listez les parcours indispensables : trouver une prestation, envoyer une demande, se connecter ou passer une commande selon le site.</p>
        <div className={s.note}><p>Une refonte visuelle, un changement de CMS et une migration de domaine ne présentent pas le même périmètre. Identifiez explicitement les changements. Les procédures de migration Google concernent les URL ou l’hébergement ; elles ne remplacent pas la recette de vos fonctionnalités.</p></div>
      </section>

      <section id="avant" aria-labelledby="avant-title">
        <h2 id="avant-title">Avant publication : conserver une référence et tester la version cible</h2>
        <ol>
          <li><strong>Inventoriez les URL importantes.</strong> Croisez le sitemap, les liens connus, Search Console et vos statistiques disponibles. Incluez les pages recevant des demandes, les PDF et les campagnes encore actives.</li>
          <li><strong>Gardez une référence avant refonte.</strong> Notez le statut HTTP, le contenu principal, les titres, les directives d’indexation et les mesures de quelques pages représentatives. Conservez la date et les conditions de chaque relevé.</li>
          <li><strong>Préparez une préproduction protégée.</strong> Utilisez des données de test. Un <code>robots.txt</code> ou un <code>noindex</code> n’est pas un contrôle d’accès. Documentez les restrictions à conserver sur la préproduction et celles à retirer uniquement de la production.</li>
          <li><strong>Répétez les parcours.</strong> Testez mobile et ordinateur, navigation au clavier, messages d’erreur et confirmations. Pour un formulaire, vérifiez la réception effective du message ; pour un paiement, utilisez le mode de test du prestataire.</li>
          <li><strong>Préparez le retour arrière.</strong> Conservez version, configuration et sauvegarde nécessaires. Vérifiez la restauration et précisez le traitement des données créées après la bascule : remettre l’ancien code ne restaure pas automatiquement une base compatible.</li>
        </ol>
        <p>Si l’hébergement change, préparez certificats, configuration et accès avant le changement DNS. Vérifiez la nouvelle infrastructure, puis surveillez les deux environnements pendant la transition. Ne supprimez pas l’ancien hébergement tant que la bascule n’est pas confirmée. <a href="https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes">Procédure Google pour un changement d’hébergement</a>.</p>
      </section>

      <section id="url" aria-labelledby="url-title">
        <h2 id="url-title">Si les adresses changent : établir une correspondance URL par URL</h2>
        <p>Pour chaque ancienne adresse importante, choisissez une destination équivalente ou constatez sa suppression. Évitez de rediriger toutes les pages disparues vers l’accueil. Une redirection permanente serveur, généralement <code>301</code> ou <code>308</code>, doit rejoindre directement le bon contenu, sans chaîne ni boucle. <a href="https://developers.google.com/search/docs/crawling-indexing/301-redirects">Choisir le type de redirection</a>.</p>
        <p className={s.tableHint}>Sur petit écran, faites défiler le tableau horizontalement.</p>
        <div className={s.tableWrap} role="region" aria-label="Exemple de correspondance des URL" tabIndex={0}>
          <table>
            <caption>Exemple fictif de plan de redirection</caption>
            <thead><tr><th scope="col">Ancienne URL</th><th scope="col">Décision</th><th scope="col">Résultat attendu</th></tr></thead>
            <tbody>
              <tr><th scope="row"><code>/nos-services/audit</code></th><td>Déplacée vers <code>/services/audit-web</code></td><td>Une redirection permanente, puis la page équivalente en 200.</td></tr>
              <tr><th scope="row"><code>/contact</code></th><td>Adresse conservée</td><td>200 et formulaire opérationnel.</td></tr>
              <tr><th scope="row"><code>/promotion-ancienne</code></th><td>Supprimée sans équivalent</td><td>404 ou 410, avec une page d’erreur utile.</td></tr>
            </tbody>
          </table>
        </div>
        <p>Actualisez les liens internes, canoniques, sitemaps et variantes linguistiques pour pointer vers les nouvelles URL. En cas de changement de domaine, vérifiez les propriétés Search Console et utilisez la procédure de changement d’adresse lorsqu’elle s’applique. Google recommande de conserver les redirections au moins un an, et plus longtemps si elles restent utiles aux visiteurs. <a href="https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes">Préparer et suivre une migration d’URL</a>.</p>
      </section>

      <section id="publication" aria-labelledby="publication-title">
        <h2 id="publication-title">À la publication : refaire les contrôles sur le vrai domaine</h2>
        <p>Un résultat de préproduction ne suffit pas : le CDN, les clés de service, le cache ou les protections peuvent différer. Ouvrez la version publiée sans session d’administration, puis vérifiez chaque type de page.</p>
        <ul>
          <li><strong>Accès :</strong> domaine, certificat, variantes HTTP/HTTPS, anciennes URL, page 404 et ressources essentielles.</li>
          <li><strong>Indexation :</strong> absence de <code>noindex</code> involontaire dans le HTML et les en-têtes ; règles de crawl adaptées ; canoniques et sitemap utilisant le domaine final. Gardez les exclusions intentionnelles. <a href="https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag">Lire les directives robots réellement servies</a>.</li>
          <li><strong>Parcours :</strong> formulaire reçu, liens de contact, authentification et paiement selon votre périmètre. Vérifiez aussi les erreurs et confirmations.</li>
          <li><strong>Affichage et accessibilité :</strong> navigation au clavier, focus visible, champs nommés, textes agrandis et absence de contenu masqué. Ces essais restent une première revue. <a href="https://www.w3.org/WAI/test-evaluate/easy-checks/">Premières vérifications W3C</a>.</li>
          <li><strong>Performance :</strong> même page, fenêtre, réseau et état du cache pour comparer. Rejouez les contenus tardifs avec le <Link href="/guides/cls-eleve">guide sur le CLS</Link>.</li>
        </ul>
        <p>Pour chaque échec, notez l’URL, les étapes, la preuve, le responsable et la décision. Un parcours essentiel inutilisable peut justifier de reporter la publication ou de revenir en arrière. Une retouche sans effet sur les tâches peut être planifiée ; la décision appartient au responsable de mise en ligne.</p>
      </section>

      <section id="suivi" aria-labelledby="suivi-title">
        <h2 id="suivi-title">Après publication : surveiller ce qu’un test ponctuel ne voit pas</h2>
        <p>Contrôlez rapidement les erreurs serveur, les anciennes URL demandées et la réception des contacts. Continuez ensuite à suivre indexation, impressions, clics et parcours essentiels. Adaptez la fréquence au trafic et à l’importance du site.</p>
        <p>Une baisse observée après la refonte ne désigne pas automatiquement sa cause. Comparez les pages touchées, les dates et les modifications. Une variation de classement pendant une migration est possible ; une page oubliée ou une directive bloquante doit être examinée sans attendre.</p>
        <p>Argos peut vous aider à relever les signaux publics de plusieurs URL, une par une, avant et après. Il ne vérifie ni l’ensemble du plan de redirection, ni la réception des emails, ni les commandes et espaces connectés. Conservez les essais humains avec les rapports et leur couverture de mesure.</p>
      </section>

      <section id="grille" aria-labelledby="grille-title">
        <h2 id="grille-title">Une grille pour décider avec des preuves</h2>
        <p><a href="/downloads/grille-recette-refonte.csv" download>Télécharger la grille de recette de refonte (CSV, séparateur point-virgule)</a>. Elle comprend les phases avant, publication et suivi ; complétez une ligne par URL ou parcours. Aucun contrôle n’est prévalidé.</p>
        <p>Renseignez résultat attendu, observation, preuve, responsable et décision. Dupliquez les lignes selon votre périmètre et retirez celles qui ne s’appliquent pas en le justifiant. Cette grille sert à documenter une décision ; elle ne constitue pas une certification.</p>
        <p>Pour élargir la préparation aux comptes, emails et autres besoins d’un site ou SaaS, la <a href="https://antoine.lelouet.fr/outils/checklist-lancement">checklist de lancement d’Antoine Le Louët, créateur d’Argos</a>, propose un complément interactif.</p>
      </section>
    </GuideArticle>
  );
}
