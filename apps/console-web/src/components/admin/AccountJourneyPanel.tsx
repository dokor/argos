"use client";

import { useLang } from "@/lib/i18n/LangContext";
import s from "./AnalyticsView.module.scss";

type Retention = { eligible: number; returned: number };
export type AccountJourney = {
  activeAccounts: number; returningAccounts: number; activityDays: number;
  authentications: number; claimedReports: number;
  cohorts: { method: string; lang: string; registered: number; activated: number; claimed: number; day7: Retention; day30: Retention }[];
};
const copy = {
  fr: {
    title: "Du compte au premier usage", intro: "Cohorte des inscriptions réellement observées après accord. Un compte est activé dès sa première analyse lancée ou son premier rapport rattaché. Aucun historique n’est reconstitué.",
    empty: "Aucune inscription mesurée sur cette période. La collecte désactivée, les refus et les événements perdus ne représentent pas des échecs d’inscription.",
    registered: "Comptes créés", activated: "Premier usage", claimed: "Avec un rapport rattaché", denominator: "des comptes créés dans la cohorte",
    retention: "Retours après inscription", retentionHelp: "J+7 et J+30 désignent le jour UTC exact après l’inscription. Le dénominateur contient uniquement les comptes dont cette journée est entièrement écoulée. Un retour correspond à une connexion réussie ou à un profil vérifié chargé, y compris depuis la navigation publique. Aucune activité de polling ou de renouvellement de session n’est comptée.",
    window: "Fenêtre", returned: "Comptes revenus", eligible: "Comptes éligibles", immature: "Encore immatures", rate: "Taux observé", day7: "Jour +7", day30: "Jour +30", unavailable: "Indisponible",
    activity: "Activité pendant la période", activityHelp: "Ces comptes peuvent avoir été créés avant la période. Un retour exige une activité mesurée sur un jour UTC antérieur, dans les 90 jours conservés. Un compte correspond à un accès Argos, pas nécessairement à une personne unique.",
    active: "Comptes actifs", returning: "Actifs déjà observés un jour antérieur", activityDays: "Jours de compte actifs", authentications: "Connexions réussies", reports: "Rapports rattachés",
    methods: "Méthode d’inscription / langue", password: "Email et mot de passe", premium: "Premium : mesure en attente d’une offre disponible. Aucun événement de consultation ou d’achat n’est collecté.",
    limits: "L’absence de retour observé ne prouve pas un abandon. Refus, retrait, panne et purge réduisent la couverture. Les visites publiques et audits restent des populations distinctes : aucun taux individuel visite → compte n’est calculé.",
  },
  en: {
    title: "From registration to first use", intro: "Cohort of registrations actually observed after consent. An account is activated by its first analysis submission or report claim. No history is reconstructed.",
    empty: "No measured registrations in this period. Disabled collection, refusals and lost events do not represent failed registrations.",
    registered: "Accounts created", activated: "First use", claimed: "With a claimed report", denominator: "of accounts created in this cohort",
    retention: "Returns after registration", retentionHelp: "D+7 and D+30 mean the exact UTC day after registration. Only accounts whose entire target day has elapsed enter the denominator. A return is a successful sign-in or a loaded verified profile, including from public navigation. Polling and session renewal do not count as activity.",
    window: "Window", returned: "Returning accounts", eligible: "Eligible accounts", immature: "Still immature", rate: "Observed rate", day7: "Day +7", day30: "Day +30", unavailable: "Unavailable",
    activity: "Activity during the period", activityHelp: "These accounts may have been created before this period. A return requires measured activity on an earlier UTC day within the retained 90 days. An account represents Argos access, not necessarily a unique person.",
    active: "Active accounts", returning: "Active accounts seen on an earlier day", activityDays: "Active account days", authentications: "Successful sign-ins", reports: "Reports claimed",
    methods: "Registration method / language", password: "Email and password", premium: "Premium: measurement awaits an available offer. No offer-view or purchase event is collected.",
    limits: "No observed return does not prove abandonment. Refusal, withdrawal, outages and purging limit coverage. Public visits and audits remain separate populations: no individual visit → account conversion is calculated.",
  },
};

export default function AccountJourneyPanel({ data }: { data: AccountJourney }) {
  const { lang } = useLang(), c = copy[lang];
  const number = (value: number) => new Intl.NumberFormat(lang).format(value);
  const rate = (numerator: number, denominator: number) => denominator === 0 ? c.unavailable
    : new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 }).format(numerator / denominator);
  const registered = data.cohorts.reduce((total, row) => total + row.registered, 0);
  const activated = data.cohorts.reduce((total, row) => total + row.activated, 0);
  const claimed = data.cohorts.reduce((total, row) => total + row.claimed, 0);
  const retention = (key: "day7" | "day30") => data.cohorts.reduce((total, row) => ({
    eligible: total.eligible + row[key].eligible, returned: total.returned + row[key].returned,
  }), { eligible: 0, returned: 0 });

  return <section aria-labelledby="account-journey-title">
    <h2 id="account-journey-title">{c.title}</h2><p>{c.intro}</p>
    {!registered ? <p>{c.empty}</p> : <>
      <ol className={s.funnel}>
        {[[c.registered, registered], [c.activated, activated], [c.claimed, claimed]].map(([label, value], index) => <li key={label}>
          <span>{label}</span><strong>{number(Number(value))}</strong>
          {index > 0 && <small>{rate(Number(value), registered)} · {c.denominator} ({number(registered)})</small>}
        </li>)}
      </ol>
      <div className={s.scroll} tabIndex={0} role="region" aria-label={c.methods}><table>
        <thead><tr>{[c.methods, c.registered, c.activated, c.rate].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data.cohorts.map(row => <tr key={row.method + row.lang}>
          <th scope="row">{row.method === "password" ? c.password : row.method === "github" ? "GitHub" : row.method === "linkedin" ? "LinkedIn" : "Google"} · {row.lang.toUpperCase()}</th>
          <td>{number(row.registered)}</td><td>{number(row.activated)}</td><td>{rate(row.activated, row.registered)}</td>
        </tr>)}</tbody>
      </table></div>
    </>}
    <h2>{c.retention}</h2><p>{c.retentionHelp}</p>
    <div className={s.scroll} tabIndex={0} role="region" aria-label={c.retention}><table>
      <thead><tr>{[c.window, c.returned, c.eligible, c.immature, c.rate].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{(["day7", "day30"] as const).map(key => { const row = retention(key); return <tr key={key}>
        <th scope="row">{c[key]}</th><td>{number(row.returned)}</td><td>{number(row.eligible)}</td><td>{number(registered - row.eligible)}</td><td>{rate(row.returned, row.eligible)}</td>
      </tr>; })}</tbody>
    </table></div>
    <h2>{c.activity}</h2><p>{c.activityHelp}</p>
    <ul className={s.activity}>
      {[[c.active, data.activeAccounts], [c.returning, data.returningAccounts], [c.activityDays, data.activityDays], [c.authentications, data.authentications], [c.reports, data.claimedReports]].map(([label, value]) => <li key={label}><span>{label}</span><strong>{number(Number(value))}</strong></li>)}
    </ul>
    <p>{c.limits}</p><p>{c.premium}</p>
  </section>;
}
