import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ContactLinks from "@/components/site/ContactLinks";
import s from "./TermsPage.module.scss";

export default function TermsPage() {
  return <div className={s.page} lang="fr">
    <SiteNav />
    <main className={s.main}>
      <div className={s.content}>
        <header className={s.intro}>
          <h1>Conditions d’utilisation d’Argos</h1>
          <p>Version du <time dateTime="2026-10-12">12 octobre 2026</time>.</p>
          <p>Ces conditions décrivent l’utilisation du service d’audit Argos, exploité par Antoine Le Louët. Elles sont accessibles sans compte, comme la <a href="/confidentialite">politique de confidentialité</a> et les <a href="/informations-legales">informations sur le service</a>.</p>
        </header>
        <section>
          <h2>Le service et son périmètre</h2>
          <p>Argos analyse une URL publique et produit un rapport de constats techniques et de scores. Les mesures portent sur la page soumise et les ressources chargées au moment de l’analyse. Elles ne constituent pas un audit exhaustif de toutes les pages du site.</p>
          <p>Les fonctionnalités disponibles, les modules de mesure et les limites d’usage peuvent dépendre de la configuration du service et de l’offre associée à votre compte.</p>
        </section>
        <section>
          <h2>Utilisation autorisée</h2>
          <p>Soumettez uniquement des pages publiques que vous êtes autorisé à faire analyser. Le suivi d’un domaine dans votre compte ne vérifie pas que vous en êtes propriétaire.</p>
          <p>Ne soumettez pas d’URL contenant des identifiants, des secrets ou des informations confidentielles. N’utilisez pas Argos pour tenter d’accéder à un réseau privé, contourner des restrictions d’accès, perturber un site ou le service, ni lancer des analyses abusives. Les limites techniques et de consommation du service doivent être respectées.</p>
        </section>
        <section>
          <h2>Comptes et moyens de connexion</h2>
          <p>Un audit peut être lancé sans compte lorsque ce parcours est proposé. Les comptes permettent notamment de conserver vos analyses et de suivre des URL. Certaines actions nécessitent une adresse email vérifiée et une session valide.</p>
          <p>Vous êtes responsable de la protection de vos moyens de connexion et de l’usage de votre compte. La connexion Google, GitHub ou LinkedIn est facultative et utilise le fournisseur choisi à votre initiative. Signalez à l’opérateur tout accès à votre compte que vous ne reconnaissez pas.</p>
          <p>La fermeture du compte révoque les accès et archive le compte. Elle ne supprime pas automatiquement les données et ne désactive pas les liens de rapports déjà partagés avant leur expiration. La <a href="/confidentialite">politique de confidentialité</a> précise la conservation et les demandes d’effacement.</p>
        </section>
        <section>
          <h2>Rapports et partage</h2>
          <p>Un lien de rapport permet à toute personne qui le possède de consulter ce rapport jusqu’à son expiration. Conservez ce lien avec précaution et partagez-le uniquement avec les destinataires souhaités. La non-indexation demandée aux moteurs de recherche ne remplace pas un contrôle d’accès.</p>
          <p>L’accès à l’espace personnel et à son historique nécessite une connexion. La possession d’un lien partagé ne donne pas accès au compte de son propriétaire.</p>
        </section>
        <section>
          <h2>Interprétation des résultats</h2>
          <p>Les résultats dépendent de la disponibilité de la page, de ses ressources, des services de mesure et des conditions d’exécution. Une analyse peut être partielle ou contenir des faux positifs. Un contrôle absent ou un bon score ne prouve pas l’absence de défaut.</p>
          <p>Les rapports ne certifient ni la sécurité d’un site, ni son accessibilité ou sa conformité juridique, ni son classement dans les moteurs de recherche. Vérifiez les constats dans leur contexte avant de décider d’une correction. La <a href="/methodologie-score">méthodologie du score</a> décrit les limites de ces indicateurs.</p>
        </section>
        <section>
          <h2>Disponibilité et évolution</h2>
          <p>Le service peut être temporairement indisponible, notamment pour maintenance ou en cas d’incident sur un module de mesure. Aucun délai de production de rapport ni disponibilité permanente n’est garanti.</p>
          <p>La version et la date de ces conditions sont indiquées en tête de page. Consultez-les lors de vos prochaines utilisations pour prendre connaissance de leurs évolutions. Les droits que la loi vous reconnaît restent applicables.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Pour une question sur ces conditions, un problème d’accès ou un usage abusif, contactez l’opérateur.</p>
          <ContactLinks fixedFrench />
        </section>
      </div>
    </main>
    <SiteFooter fixedFrench />
  </div>;
}
