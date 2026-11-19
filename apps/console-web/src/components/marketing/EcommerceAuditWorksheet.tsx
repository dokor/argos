import { localizeValue } from "@/lib/i18n/messages";
import type { Lang } from "@/lib/i18n/routes";
import s from "./EcommerceAuditGuide.module.scss";

export default function EcommerceAuditWorksheet({ lang }: { lang: Lang }) {
  const headers = (lang === "fr" ? ["URL ou scénario", "Appareil", "Résultat attendu", "Résultat obtenu / preuve", "Priorité", "Validation"] : localizeValue(["URL or scenario", "Device", "Expected result", "Actual result / evidence", "Priority", "Acceptance check"], lang));
  const rows = (lang === "fr" ? [
    ["Fiche tee-shirt → panier", "Mobile, session neuve", "M / TS-M, quantité 1", "S / TS-S ; capture de la sélection et du panier", "Haute : article incorrect", "Rejouer S, M et L ; identifiants conservés"],
    ["Paiement refusé en préproduction", "Clavier, session neuve", "Panier conservé ; erreur compréhensible", "À renseigner après essai", "À qualifier", "Réessayer sans commande en double"],
  ] : localizeValue([
    ["T-shirt page → cart", "Mobile, fresh session", "M / TS-M, quantity 1", "S / TS-S; selection and cart screenshot", "High: incorrect item", "Repeat S, M and L; identifiers preserved"],
    ["Declined payment in staging", "Keyboard, fresh session", "Cart preserved; understandable error", "Record after testing", "To assess", "Retry without a duplicate order"],
  ], lang));
  return <section className={s.section} id="grille-controle" aria-labelledby="worksheet-title">
    <h2 id="worksheet-title">{(lang === "fr" ? "Votre grille de contrôle e-commerce" : localizeValue("Your ecommerce audit worksheet", lang))}</h2>
    <p>{(lang === "fr" ? "Les deux lignes illustrent le format ; seule la première décrit le scénario fictif ci-dessus. Téléchargez la grille, remplacez les exemples et gardez une ligne par URL ou scénario. Ajoutez date, état du cache, responsable et échéance pour chaque contrôle." : localizeValue("These two rows illustrate the format; only the first describes the fictional scenario above. Download the worksheet, replace the examples and keep one row per URL or scenario. Add date, cache state, owner and deadline for every check.", lang))}</p>
    <div className={s.table} role="region" aria-labelledby="worksheet-title" tabIndex={0}>
      <table><caption>{(lang === "fr" ? "Exemples fictifs de constats et critères d’acceptation" : localizeValue("Fictional findings and acceptance criteria", lang))}</caption>
        <thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p><a href={`/downloads/ecommerce-audit-checklist-${lang}.csv`} download>{(lang === "fr" ? "Télécharger la grille à compléter (CSV)" : localizeValue("Download the audit worksheet (CSV)", lang))}</a></p>
    <p>{(lang === "fr" ? "Le fichier contient des scénarios à tester, sans résultat présumé. Séparez échec reproduit, hypothèse et contrôle non réalisé. Une baisse des abandons ne prouve pas, à elle seule, l’effet de la correction." : localizeValue("The file lists scenarios to test, with no assumed results. Distinguish reproduced failure, hypothesis and untested check. A fall in abandonment alone does not establish the effect of a fix.", lang))}</p>
  </section>;
}
