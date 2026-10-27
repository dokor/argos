"use client";

import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { useLang } from "@/lib/i18n/LangContext";
import PremiumWaitlist from "./PremiumWaitlist";
import { pricingCopy, subscriptionStatuses } from "./pricingCopy";
import s from "./PricingPage.module.scss";

export default function PricingPage() {
  const { lang } = useLang();
  const c = pricingCopy[lang];
  return <div className={s.page}>
    <SiteNav />
    <main>
      <header className={s.hero}><div className={s.container}>
        <p className={s.eyebrow}>{c.eyebrow}</p>
        <h1>{c.title}</h1><p className={s.lead}>{c.lead}</p>
        <nav className={s.anchors} aria-label={c.eyebrow}><a href="#comparison">{c.compare}<span aria-hidden="true">↓</span></a><a href="#subscription-statuses">{c.statuses}<span aria-hidden="true">↓</span></a></nav>
      </div></header>

      <section className={s.container} aria-label={c.plansLabel}>
        <div className={s.plans}>
          {c.plans.map((plan, index) => <article key={plan.name} className={`${s.plan} ${index === 2 ? s.premium : ""}`} aria-labelledby={`plan-${index}`}>
            <div className={s.planTop}><p className={s.audience}>{plan.audience}</p><span className={s.badge}>{index === 2 ? c.coming : c.available}</span></div>
            <h2 id={`plan-${index}`}>{plan.name}</h2>
            <p className={s.price}>{index === 2 ? c.premiumPrice : c.free}</p>
            <p className={s.priceNote}>{index === 2 ? c.premiumNote : c.freeNote}</p>
            <p className={s.description}>{plan.description}</p>
            <Link href={plan.href} className={`${s.cta} ${index === 2 ? s.primary : ""}`}>{plan.action}</Link>
            <ul>{plan.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
            {index === 2 && <div className={s.periods}><p>{c.periods}</p><p>{c.annual}</p><p>{c.annualTtc}</p></div>}
          </article>)}
        </div>
        <p className={s.launchNote}><span className={s.noticeDot} aria-hidden="true" />{c.notice}</p>
        <p className={s.taxNote}>{c.taxNote}</p>
      </section>

      <section id="comparison" className={`${s.container} ${s.section}`} aria-labelledby="comparison-title">
        <h2 id="comparison-title">{c.comparisonTitle}</h2><p className={s.sectionLead}>{c.comparisonLead}</p>
        <div className={s.tableScroll} role="region" aria-label={c.comparisonTable} tabIndex={0}>
          <table><caption className={s.visuallyHidden}>{c.comparisonTitle}</caption><thead><tr><th scope="col">{c.feature}</th>{c.plans.map(plan => <th scope="col" key={plan.name}>{plan.name}</th>)}</tr></thead>
            <tbody>{c.rows.map(([feature, ...values]) => <tr key={feature}><th scope="row">{feature}</th>{values.map((value, index) => <td key={index} className={value === c.no ? s.notIncluded : undefined}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <aside className={s.quota} aria-labelledby="quota-title"><div><h3 id="quota-title">{c.quotaTitle}</h3><p>{c.quotaBody}</p><p className={s.quotaNote}>{c.quotaNote}</p></div><Link href="/docs/usage">{c.documentation}<span aria-hidden="true">↗</span></Link></aside>
      </section>

      <section id="subscription-statuses" className={`${s.container} ${s.section} ${s.statuses}`} aria-labelledby="statuses-title">
        <h2 id="statuses-title">{c.statusesTitle}</h2><p className={s.sectionLead}>{c.statusesLead}</p>
        <dl>{Object.entries(subscriptionStatuses).map(([code, status]) => <div key={code}><dt>{status[lang][0]}</dt><dd>{status[lang][1]}</dd></div>)}</dl>
        <p className={s.sectionLead}>{c.statusHint}</p><Link className={s.textLink} href="/account/billing">{c.manage}<span aria-hidden="true">↗</span></Link>
      </section>

      <section className={`${s.container} ${s.section} ${s.faq}`} aria-labelledby="pricing-faq-title"><h2 id="pricing-faq-title">{c.faq}</h2>
        <div>{c.questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>
      <PremiumWaitlist />
    </main>
    <SiteFooter />
  </div>;
}
