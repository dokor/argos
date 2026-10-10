"use client";

import React from "react";
import AuditForm from "@/components/AuditForm";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import HomeReportPreview from "@/components/marketing/HomeReportPreview";
import s from "./page.module.scss";

// ─── Social proof bar ─────────────────────────────────────────────────────────

function SocialProofBar({
  items,
}: {
  items: Array<{ icon: string; label: string }>;
}) {
  return (
    <div className={s.socialProofBar}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <span className={s.socialProofItem}>
            <span>{item.icon}</span>
            {item.label}
          </span>
          {i < items.length - 1 && (
            <span className={s.socialProofDivider} aria-hidden="true">
              ·
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { t } = useLang();
  const tl = t.landing;


  return (
    <div className={s.page}>

      <SiteNav />

      <main>
      {/* HERO */}
      <section className={s.heroSection}>
        <div className={s.dotPattern} aria-hidden="true" />
        <div className={s.heroInner}>
          <div className={s.heroLeft}>
            <span className={s.badge}>{tl.hero.badge}</span>
            <h1 className={s.headline}>{tl.hero.headline}</h1>
            <p className={s.sub}>{tl.hero.sub}</p>
            <div id="audit" className={s.heroFormWrap}>
              <AuditForm mode="public" sourceRoute="/" idPrefix="hero" submitLabel={tl.hero.cta} />
              <Link href="/exemple-rapport" className={s.exampleLink}>{tl.hero.exampleLink}</Link>
            </div>
          </div>
          <div className={s.heroRight}>
            <HomeReportPreview />
          </div>
        </div>
        <div className={s.heroFade} />
      </section>

      {/* SOCIAL PROOF */}
      <SocialProofBar items={tl.socialProof.items} />

      {/* MODULES */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{tl.modules.title}</h2>
            <p className={s.sectionSub}>{tl.modules.sub}</p>
          </div>
          <div className={s.grid4}>
            {tl.modules.items.map((m) => (
              <div key={m.label} className={s.moduleCard}>
                <span className={s.moduleIcon}>{m.icon}</span>
                <h3 className={s.moduleLabel}>{m.label}</h3>
                <p className={s.moduleDesc}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={s.sectionAlt}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{tl.how.title}</h2>
          </div>
          <div className={s.stepsGrid}>
            {tl.how.steps.map((step, i) => (
              <div key={step.n} className={s.stepCard}>
                <div className={s.stepNumber}>{step.n}</div>
                {i < tl.how.steps.length - 1 && (
                  <div className={s.stepArrow}>→</div>
                )}
                <h3 className={s.stepLabel}>{step.label}</h3>
                <p className={s.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY ARGOS */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{tl.why.title}</h2>
          </div>
          <div className={s.grid4}>
            {tl.why.items.map((item, index) => (
              <div key={item.label} className={s.whyCard}>
                <span className={s.whyIcon}>{item.icon}</span>
                <h3 className={s.whyLabel}>{item.label}</h3>
                <p className={s.whyDesc}>{item.desc}</p>
                {index === 3 && <Link href="/methodologie-score">{item.label}</Link>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className={s.sectionAlt} aria-labelledby="audiences-title">
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 id="audiences-title" className={s.sectionTitle}>{t.marketing.landing.title}</h2>
            <p className={s.sectionSub}>{t.marketing.landing.description}</p>
          </div>
          <div className={s.audienceGrid}>
            <Link href="/ressources/audit-site-pme" className={s.audienceCard}>
              <h3>{t.marketing.landing.pmeTitle}</h3>
              <p>{t.marketing.landing.pmeDescription}</p>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/ressources/audit-site-ecommerce" className={s.audienceCard}>
              <h3>{t.marketing.landing.ecommerceTitle}</h3>
              <p>{t.marketing.landing.ecommerceDescription}</p>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className={s.sectionDark}>
        <div className={s.containerNarrow}>
          <h2 className={s.sectionTitleLight} style={{ marginBottom: 12 }}>
            {tl.cta.title}
          </h2>
          <p className={s.sectionSubDark}>{tl.cta.sub}</p>
          <AuditForm mode="public" sourceRoute="/" idPrefix="final" submitLabel={tl.hero.cta} />
        </div>
      </section>

      </main>

      <SiteFooter />

    </div>
  );
}
