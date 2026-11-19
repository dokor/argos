"use client";
import { localizeValue } from "@/lib/i18n/messages";
import { PUBLIC_CONTACT } from "@/lib/publicContact";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ContactLinks.module.scss";
export default function ContactLinks({ fixedFrench = false }: { fixedFrench?: boolean }) {
  const { lang } = useLang(); const fr = fixedFrench || lang === "fr";
  return <div className={s.contact}>
    <p>{fr ? "Une question sur Argos ou ses corrections ? Écrivez à Antoine Le Louët." : localizeValue("A question about Argos or its fixes? Write to Antoine Le Louët.", lang)}</p>
    <a href={PUBLIC_CONTACT.emailHref}>{fr ? "Contacter par email" : localizeValue("Contact by email", lang)} : {PUBLIC_CONTACT.email}</a>
    <a href={PUBLIC_CONTACT.linkedinHref}>{fr ? "Voir le profil LinkedIn" : localizeValue("View the LinkedIn profile", lang)}</a>
  </div>;
}
