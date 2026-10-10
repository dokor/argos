"use client";

import Link from "@/components/LocalizedLink";
import AuditForm from "@/components/AuditForm";
import SiteFooter from "@/components/site/SiteFooter";
import SiteNav from "@/components/site/SiteNav";
import SmallBusinessPage from "./SmallBusinessPage";
import ChoosingArgos from "./ChoosingArgos";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AudiencePage.module.scss";

type Audience = "pme" | "ecommerce";

export default function AudiencePage({ audience }: { audience: Audience }) {
  const { t } = useLang();
  const copy = t.marketing[audience];
  const common = t.marketing.common;
  const otherAudience = audience === "pme" ? "ecommerce" : "pme";
  const otherHref = otherAudience === "pme" ? "/ressources/audit-site-pme" : "/ressources/audit-site-ecommerce";
  const otherLabel = otherAudience === "pme" ? common.pmeLink : common.ecommerceLink;
  const route = audience === "pme" ? "/ressources/audit-site-pme" : "/ressources/audit-site-ecommerce";

  if (audience === "pme") return <SmallBusinessPage />;

  return (
    <div className={s.page}>
      <SiteNav />
      <main>
        <header className={s.hero}>
          <div className={s.container}>
            <p className={s.eyebrow}>{copy.eyebrow}</p>
            <h1 className={s.title}>{copy.title}</h1>
            <p className={s.lead}>{copy.lead}</p>
            <a href="#audit" className={s.heroCta}>{common.ctaLabel} <span aria-hidden="true">→</span></a>
            <p className={s.heroNote}>{copy.heroNote}</p>
          </div>
        </header>

        <section className={s.section} aria-labelledby="measures-title">
          <div className={s.container}>
            <h2 id="measures-title" className={s.sectionTitle}>{common.measuresTitle}</h2>
            <div className={s.measureGrid}>
              {copy.measures.map((item) => (
                <article key={item.title} className={s.card}>
                  <h3 className={s.cardTitle}>{item.title}</h3>
                  <p className={s.cardText}>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.alternate}`} aria-labelledby="benefits-title">
          <div className={s.container}>
            <h2 id="benefits-title" className={s.sectionTitle}>{common.benefitsTitle}</h2>
            <div className={s.benefitGrid}>
              {copy.benefits.map((item) => (
                <article key={item.title} className={s.card}>
                  <h3 className={s.cardTitle}>{item.title}</h3>
                  <p className={s.cardText}>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={s.section} aria-labelledby="example-title">
          <div className={s.container}>
            <div className={s.example}>
              <p className={s.eyebrow}>{common.exampleLabel}</p>
              <h2 id="example-title" className={s.sectionTitle}>{copy.exampleTitle}</h2>
              <p className={s.paragraph}>{copy.exampleText}</p>
            </div>
          </div>
        </section>

        <section className={`${s.section} ${s.alternate}`} aria-labelledby="steps-title">
          <div className={s.container}>
            <h2 id="steps-title" className={s.sectionTitle}>{common.stepsTitle}</h2>
            <ol className={s.steps}>
              {common.steps.map((step, index) => (
                <li key={step.title} className={s.step}>
                  <span className={s.stepNumber} aria-hidden="true">{index + 1}</span>
                  <div>
                    <h3 className={s.cardTitle}>{step.title}</h3>
                    <p className={s.cardText}>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.section} aria-labelledby="limits-title">
          <div className={s.container}>
            <h2 id="limits-title" className={s.sectionTitle}>{common.limitsTitle}</h2>
            <ul className={s.limits}>
              {copy.limits.map((limit) => <li key={limit}>{limit}</li>)}
            </ul>
          </div>
        </section>

        <ChoosingArgos audience={audience} />

        <section id="audit" className={`${s.section} ${s.ctaSection}`} aria-labelledby="audit-title">
          <div className={s.container}>
            <h2 id="audit-title" className={s.sectionTitle}>{copy.ctaTitle}</h2>
            <p className={s.paragraph}>{copy.ctaText}</p>
            <AuditForm mode="public" sourceRoute={route} />
          </div>
        </section>

        <nav className={s.related} aria-label={common.otherPages}>
          <div className={s.container}>
            <p className={s.relatedLabel}>{common.otherPages}</p>
            <div className={s.relatedLinks}>
              <Link href={otherHref}>{otherLabel}</Link>
              <Link href="/">{common.homeLink}</Link>
              <Link href="/faq">{common.faqLink}</Link>
            </div>
          </div>
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
