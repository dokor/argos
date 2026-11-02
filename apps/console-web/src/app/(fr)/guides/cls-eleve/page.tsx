import Link from "@/components/PageLink";
import { diagnosticGuides } from "@/lib/diagnosticGuides";
import GuideArticle from "@/components/guides/GuideArticle";
import { guideMetadata } from "@/components/guides/guideMetadata";
import s from "@/components/guides/GuideArticle.module.scss";

const guide = diagnosticGuides.cls;

export const metadata = guideMetadata(guide);

export default function ClsGuidePage() {
  return (
    <GuideArticle guide={guide} contents={[
      { id: "comprendre", label: "Comprendre le CLS" },
      { id: "reproduire", label: "Reproduire le décalage" },
      { id: "causes", label: "Trouver la cause" },
      { id: "demonstration", label: "Comparer avant et après" },
      { id: "valider", label: "Valider la correction" },
      { id: "argos", label: "Situer le diagnostic Argos" },
    ]} related={[
      { href: "/guides/refonte-site-web", label: "Vérifier la stabilité lors d’une refonte" },
      { href: "/guides/checklist-audit-site-web", label: "Suivre la checklist générale d’audit" },
      { href: "/methodologie-score", label: "Comprendre la méthode du score Argos" },
    ]}>
      <section id="comprendre" aria-labelledby="comprendre-title">
        <h2 id="comprendre-title">Un contenu qui bouge peut faire rater une action</h2>
        <p>Vous commencez à lire, puis une image repousse le paragraphe. Vous visez un bouton, mais une bannière prend sa place. Le <strong>Cumulative Layout Shift (CLS)</strong> mesure cette instabilité visuelle. Il ne mesure ni le temps de chargement ni la rapidité d’une interaction.</p>
        <p>La valeur est sans unité. La cible est <strong>au plus 0,1 au 75e percentile des visites</strong>, séparément sur mobile et ordinateur. Au-delà de 0,25, le résultat est mauvais ; entre les deux, il est à améliorer. Le calcul retient la fenêtre de décalages la plus importante, pas la somme de tous les mouvements de la visite. <a href="https://web.dev/articles/cls">Définition officielle du CLS</a>.</p>
        <div className={s.note}><p>Une animation n’augmente pas forcément le CLS. Un nouvel élément doit déplacer du contenu déjà visible pour produire un décalage. Certains mouvements proches d’une interaction sont exclus ; une injection tardive peut néanmoins être comptabilisée.</p></div>
      </section>

      <section id="reproduire" aria-labelledby="reproduire-title">
        <h2 id="reproduire-title">Enregistrer le moment où le contenu se déplace</h2>
        <p>Choisissez une URL et un scénario précis : arrivée sur une fiche produit, défilement jusqu’aux avis, ouverture d’une variante. Notez la largeur de fenêtre, l’état du consentement et les conditions réseau. Un écran sans bannière ne reproduit pas forcément la première visite.</p>
        <ol>
          <li>Ouvrez la page dans une fenêtre privée, sans extension, puis les outils de développement de Chrome.</li>
          <li>Dans <strong>Performance</strong>, activez les captures d’écran et enregistrez un rechargement. Pour un défaut tardif, enregistrez aussi le parcours après chargement.</li>
          <li>Sélectionnez un événement de la piste <strong>Layout shifts</strong>. Comparez les captures immédiatement avant et après.</li>
          <li>Repérez le premier bloc ajouté ou redimensionné en amont. Le paragraphe signalé comme déplacé peut subir le problème sans en être la cause.</li>
          <li>Conservez la trace, l’URL, le scénario et une capture annotée. Ils permettent à une autre personne de reproduire le défaut.</li>
        </ol>
        <p>Si le défaut n’apparaît qu’avec une connexion lente, rejouez ce scénario avec un ralentissement réseau constant. Testez également un écran étroit : un titre ou une bannière peut occuper une ligne supplémentaire. <a href="https://developer.chrome.com/docs/devtools/performance">Enregistrer une trace dans DevTools</a>.</p>
      </section>

      <section id="causes" aria-labelledby="causes-title">
        <h2 id="causes-title">Corriger le bloc responsable, plutôt que le contenu déplacé</h2>
        <p className={s.tableHint}>Sur petit écran, faites défiler le tableau horizontalement.</p>
        <div className={s.tableWrap} role="region" aria-label="Causes fréquentes des décalages" tabIndex={0}>
          <table>
            <caption>Partir de l’observation pour choisir une correction</caption>
            <thead><tr><th scope="col">Observation</th><th scope="col">À examiner</th><th scope="col">Correction à tester</th></tr></thead>
            <tbody>
              <tr><th scope="row">Le texte descend à l’arrivée d’une image</th><td>Dimensions absentes ou ratio incohérent.</td><td>Déclarer largeur et hauteur intrinsèques ; conserver le ratio dans le CSS responsive.</td></tr>
              <tr><th scope="row">Un widget pousse la fiche produit</th><td>Zone vide avant les avis, la publicité ou une intégration.</td><td>Réserver un emplacement adapté dès le premier rendu.</td></tr>
              <tr><th scope="row">Le titre change de taille</th><td>Remplacement d’une police de secours par la police finale.</td><td>Comparer les métriques des polices et ajuster la police de secours.</td></tr>
              <tr><th scope="row">La page saute après quelques secondes</th><td>Bannière ou données insérées au-dessus du contenu.</td><td>Prévoir la place avant l’arrivée du contenu ; tester les variantes réelles.</td></tr>
            </tbody>
          </table>
        </div>
        <p>Pour une image de 1 200 × 800 pixels, le navigateur peut réserver un ratio 3:2 avant de recevoir le fichier :</p>
        <pre><code>{`<img className={styles.photo}
     src="/atelier.webp" width="1200" height="800"
     alt="Établi de réparation de vélos" />

/* Dans le module SCSS du composant */
.photo {
  display: block;
  width: 100%;
  height: auto;
}`}</code></pre>
        <p>Dans cet exemple JSX, <code>styles</code> désigne le module SCSS importé par le composant. Les dimensions doivent correspondre au ratio réel de l’image. <code>loading=&quot;lazy&quot;</code> ne réserve pas d’espace à lui seul. Pour un widget, choisissez une hauteur adaptée à chaque largeur et vérifiez aussi le cas où il ne renvoie rien. <a href="https://web.dev/articles/optimize-cls">Causes et corrections détaillées</a>.</p>
        <p>Pour les polices, <code>font-display: swap</code> rend le texte disponible plus tôt mais ne garantit pas sa stabilité. Une police de secours proche, éventuellement ajustée avec <code>size-adjust</code> et les métriques de <code>@font-face</code>, réduit les différences de géométrie. Mesurez aussi les titres longs et les langues proposées. <a href="https://web.dev/articles/font-best-practices">Bonnes pratiques pour les polices</a>.</p>
      </section>

      <section id="demonstration" aria-labelledby="demonstration-title">
        <h2 id="demonstration-title">Démonstration : réserver la place d’un bloc tardif</h2>
        <p>Les deux pages ci-dessous affichent le même encart après un délai artificiel de 1,2 seconde. Dans la première, l’encart repousse le texte. Dans la seconde, un emplacement de 128 pixels existe dès le premier rendu.</p>
        <div className={s.comparison}>
          <div><h3>Avant : aucune place réservée</h3><p>Le texte occupe d’abord la zone où l’encart apparaîtra.</p><p><a href="/demonstrations/cls/avant" target="_blank" rel="noopener noreferrer">Ouvrir la démonstration avant (nouvel onglet)</a></p></div>
          <div><h3>Après : emplacement réservé</h3><p>Le texte garde sa position pendant l’arrivée du contenu.</p><p><a href="/demonstrations/cls/apres" target="_blank" rel="noopener noreferrer">Ouvrir la démonstration après (nouvel onglet)</a></p></div>
        </div>
        <p>Enregistrez chaque page dans DevTools avec la même fenêtre. Les exemples isolent une insertion ; ils ne présentent aucun score client, gain de trafic ou résultat de production. La hauteur fixe convient à cet encart de démonstration, pas à tous les contenus.</p>
      </section>

      <section id="valider" aria-labelledby="valider-title">
        <h2 id="valider-title">Une correction doit tenir pendant le parcours</h2>
        <p>Rejouez plusieurs fois le même scénario avant et après, avec les mêmes conditions. Vérifiez que l’événement visé disparaît et que le changement ne masque pas de contenu, ne coupe pas le texte agrandi et ne dégrade pas les interactions.</p>
        <p>Comparez ensuite les données de terrain lorsqu’elles sont disponibles. Un audit Lighthouse de chargement peut manquer un décalage provoqué plus tard par un widget ou le défilement. Dans PageSpeed Insights, vérifiez si les données décrivent <strong>cette URL ou l’origine entière</strong>. L’absence de données terrain ne signifie pas que le problème est résolu.</p>
        <p>Dans votre ticket de correction, gardez : URL, largeur, scénario, trace avant, composant modifié, trace après et résultat des essais mobiles. Cette preuve est plus utile qu’une capture isolée d’un score global.</p>
      </section>

      <section id="argos" aria-labelledby="argos-title">
        <h2 id="argos-title">Ce qu’Argos apporte au diagnostic</h2>
        <p>Argos rassemble des signaux de performance et le score Lighthouse lorsque le service est disponible. Ils donnent du contexte pour choisir les vérifications. Une bonne note globale ne prouve pas que votre parcours est stable.</p>
        <p>Pour isoler un CLS, utilisez la trace de navigateur et complétez avec les données terrain. Argos ne mesure pas le 75e percentile de vos visiteurs et ne rejoue pas tous leurs parcours. Après correction, relancez la même URL et comparez les constats disponibles avec vos preuves manuelles.</p>
        <p>Lors d’une mise en ligne, intégrez ce contrôle à la <Link href="/guides/refonte-site-web">recette avant et après refonte</Link>.</p>
      </section>
    </GuideArticle>
  );
}
