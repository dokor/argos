"use client";
import { localizeValue } from "@/lib/i18n/messages";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ChoosingArgos.module.scss";
export default function ChoosingArgos({ audience, context }: { audience?: "pme" | "ecommerce"; context?: "example" | "checklist" }) {
  const { lang } = useLang(); const scope = audience === "pme"
    ? (lang === "fr" ? "Utilisez les constats d’une page de service pour préparer un brief. La réception réelle des demandes de devis doit être vérifiée avec votre prestataire." : localizeValue("Use findings from one service page to prepare a brief. Verify actual quote delivery with your provider.", lang))
    : audience === "ecommerce"
      ? (lang === "fr" ? "Analysez une fiche ou catégorie publique. La connexion, le panier, la commande et le paiement demandent une vérification humaine séparée." : localizeValue("Audit a public product or category page. Login, cart, ordering and payment need a separate human review.", lang))
      : context === "example"
        ? (lang === "fr" ? "Cette illustration montre la lecture du rapport. Lancez l’audit de votre propre URL pour obtenir vos constats." : localizeValue("This illustration shows how to read a report. Audit your own URL to obtain your findings.", lang))
        : (lang === "fr" ? "La checklist complète le diagnostic automatique d’une URL publique. Les espaces connectés et les parcours réels restent à vérifier manuellement." : localizeValue("The checklist complements automated analysis of one public URL. Signed-in areas and real journeys still need manual checks.", lang));
  return <section className={s.section} aria-labelledby="choosing-argos-title">
    <h2 id="choosing-argos-title">{(lang === "fr" ? "Situer ce diagnostic" : localizeValue("Put this diagnosis in context", lang))}</h2>
    <p>{scope}</p><p>{(lang === "fr" ? "Un score automatique ne certifie ni sécurité ni accessibilité. Argos et Lighthouse utilisent des barèmes différents." : localizeValue("An automated score does not certify security or accessibility. Argos and Lighthouse use different scoring policies.", lang))}</p>
    <Link href="/methodologie-score#resume">{(lang === "fr" ? "Comprendre la méthode et les limites du score" : localizeValue("Understand the scoring method and limits", lang))}</Link>
    {context !== "example" && <p><Link href="/exemple-rapport">{(lang === "fr" ? "Voir des preuves et corrections dans l’exemple" : localizeValue("See evidence and corrections in the example", lang))}</Link></p>}
  </section>;
}
