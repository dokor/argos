"use client";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ChoosingArgos.module.scss";
export default function ChoosingArgos({ audience, context }: { audience?: "pme" | "ecommerce"; context?: "example" | "checklist" }) {
  const { lang } = useLang(); const fr = lang === "fr";
  const scope = audience === "pme"
    ? fr ? "Utilisez les constats d’une page de service pour préparer un brief. La réception réelle des demandes de devis doit être vérifiée avec votre prestataire." : "Use findings from one service page to prepare a brief. Verify actual quote delivery with your provider."
    : audience === "ecommerce"
      ? fr ? "Analysez une fiche ou catégorie publique. La connexion, le panier, la commande et le paiement demandent une vérification humaine séparée." : "Audit a public product or category page. Login, cart, ordering and payment need a separate human review."
      : context === "example"
        ? fr ? "Cette illustration montre la lecture du rapport. Lancez l’audit de votre propre URL pour obtenir vos constats." : "This illustration shows how to read a report. Audit your own URL to obtain your findings."
        : fr ? "La checklist complète le diagnostic automatique d’une URL publique. Les espaces connectés et les parcours réels restent à vérifier manuellement." : "The checklist complements automated analysis of one public URL. Signed-in areas and real journeys still need manual checks.";
  return <section className={s.section} aria-labelledby="choosing-argos-title">
    <h2 id="choosing-argos-title">{fr ? "Situer ce diagnostic" : "Put this diagnosis in context"}</h2>
    <p>{scope}</p><p>{fr ? "Un score automatique ne certifie ni sécurité ni accessibilité. Argos et Lighthouse utilisent des barèmes différents." : "An automated score does not certify security or accessibility. Argos and Lighthouse use different scoring policies."}</p>
    <Link href="/methodologie-score">{fr ? "Comprendre la méthode et les limites du score" : "Understand the scoring method and limits (French)"}</Link>
    {context !== "example" && <p><Link href="/exemple-rapport">{fr ? "Voir des preuves et corrections dans l’exemple" : "See evidence and corrections in the example"}</Link></p>}
  </section>;
}
