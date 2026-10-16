"use client";
import { useState, type FormEvent } from "react";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { PUBLIC_CONTACT } from "@/lib/publicContact";
import s from "./PremiumWaitlist.module.scss";

export const premiumCopy = {
  fr: {
    title: "Être informé des futures offres Premium",
    intro: "Laissez votre email pour être contacté au sujet du lancement, d’un éventuel accès anticipé ou d’une réduction. Aucune date, place ni réduction n’est garantie.",
    email: "Votre adresse email", consent: "J’accepte d’être contacté par email au sujet des offres Premium Argos.",
    privacy: "Liste distincte de la newsletter. Conservation : 12 mois après l’inscription. Retrait à tout moment par email au contact Argos.",
    policy: "Confidentialité", withdrawal: "Demander mon retrait", submit: "Rejoindre la liste d’attente", loading: "Envoi en cours…",
    success: "Votre demande a été prise en compte. Aucun email de confirmation n’est envoyé.",
    invalid: "Vérifiez votre adresse email et votre accord pour être contacté.",
    limited: "Trop de demandes. Réessayez dans quelques minutes.", error: "Inscription indisponible. Réessayez plus tard.",
  },
  en: {
    title: "Hear about future Premium offers",
    intro: "Leave your email to hear about the launch, possible early access or a discount. No date, place or discount is guaranteed.",
    email: "Your email address", consent: "I agree to be contacted by email about Argos Premium offers.",
    privacy: "Separate from the newsletter. Retention: 12 months after signup. Withdraw at any time by emailing the Argos contact.",
    policy: "Privacy", withdrawal: "Request removal", submit: "Join the waiting list", loading: "Sending…",
    success: "Your request has been accepted. No confirmation email is sent.",
    invalid: "Check your email address and your agreement to be contacted.",
    limited: "Too many requests. Try again in a few minutes.", error: "Signup is unavailable. Try again later.",
  },
} as const;

export default function PremiumWaitlist() {
  const { lang } = useLang(); const c = premiumCopy[lang];
  const [email, setEmail] = useState(""); const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "success" | "invalid" | "limited" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (state === "loading" || state === "success") return;
    setState("loading");
    try {
      const response = await fetch("/api/premium-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent, locale: lang }) });
      setState(response.ok ? "success" : response.status === 400 ? "invalid" : response.status === 429 ? "limited" : "error");
      if (response.ok) { setEmail(""); setConsent(false); }
    } catch { setState("error"); }
  }
  const failed = ["invalid", "limited", "error"].includes(state);
  return <section id="premium" className={s.section} aria-labelledby="premium-title">
    <div className={s.container}>
      <h2 id="premium-title">{c.title}</h2><p>{c.intro}</p>
      <form onSubmit={submit} aria-busy={state === "loading"}>
        <label htmlFor="premium-email">{c.email}</label>
        <div className={s.row}>
          <input id="premium-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} aria-describedby="premium-privacy" disabled={state === "success"} />
          <button type="submit" aria-disabled={state === "loading" || state === "success"}>{c.submit}</button>
        </div>
        <label className={s.consent}><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} disabled={state === "success"} /><span>{c.consent}</span></label>
        <p id="premium-privacy" className={s.privacy}>{c.privacy} <Link href="/confidentialite">{c.policy}</Link> · <a href={PUBLIC_CONTACT.emailHref}>{c.withdrawal}</a></p>
        <div className={s.message}>
          <p role="status">{state === "success" ? c.success : state === "loading" ? c.loading : ""}</p>
          {failed && <p role="alert">{c[state as "invalid" | "limited" | "error"]}</p>}
        </div>
      </form>
    </div>
  </section>;
}
