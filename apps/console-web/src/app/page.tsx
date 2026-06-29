"use client";

import React, { useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import LangToggle from "@/components/LangToggle";
import s from "./page.module.scss";

// ─── Newsletter form ──────────────────────────────────────────────────────────

type FormState = "idle" | "loading" | "success" | "already" | "error";

function NewsletterForm({
  t,
  size = "default",
}: {
  t: {
    inputPlaceholder: string;
    cta: string;
    ctaLoading: string;
    hint: string;
    successTitle: string;
    successMsg: string;
    alreadyMsg: string;
    errorMsg: string;
  };
  size?: "default" | "large";
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) setState("success");
      else if (res.status === 409) setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className={s.successBox}>
        <span style={{ fontSize: size === "large" ? 20 : 18 }}>✓</span>
        <div>
          <div className={s.successTitle}>{t.successTitle}</div>
          <div className={s.successMsg}>{t.successMsg}</div>
        </div>
      </div>
    );
  }

  const inputH = size === "large" ? 52 : 46;

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div className={s.formRow}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.inputPlaceholder}
          disabled={state === "loading"}
          className={s.input}
          style={{ height: inputH, fontSize: size === "large" ? 16 : 15 }}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={s.btn}
          style={{ height: inputH, fontSize: size === "large" ? 16 : 15 }}
        >
          {state === "loading" ? t.ctaLoading : t.cta}
        </button>
      </div>

      {(state === "already" || state === "error") && (
        <p className={state === "already" ? s.formErrorAlready : s.formErrorMsg}
           style={{ margin: "8px 0 0", fontSize: 13 }}>
          {state === "already" ? t.alreadyMsg : t.errorMsg}
        </p>
      )}
      {state === "idle" && (
        <p className={s.hint}>{t.hint}</p>
      )}
    </form>
  );
}

// ─── Score ring (mock) ────────────────────────────────────────────────────────

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className={s.ringWrap}>
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle
          cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
        />
        <text x={36} y={40} textAnchor="middle" fontSize={15} fontWeight={700} fill="#0f172a">{value}</text>
      </svg>
      <span className={s.ringLabel}>{label}</span>
    </div>
  );
}

// ─── Mock report card ─────────────────────────────────────────────────────────

type CheckStatus = "pass" | "warn" | "fail" | "info";

const dotClass: Record<CheckStatus, string> = {
  pass: s.mockDotPass,
  warn: s.mockDotWarn,
  fail: s.mockDotFail,
  info: s.mockDotInfo,
};

function MockReport({ tMock }: { tMock: { url: string; urlDetail: string; score: string; checks: Record<string, string> } }) {
  const checkItems: Array<{ key: string; status: CheckStatus }> = [
    { key: "httpsEnforced",    status: "pass" },
    { key: "hstsPresent",      status: "pass" },
    { key: "cspMissing",       status: "warn" },
    { key: "metaDescMissing",  status: "fail" },
    { key: "titlePresent",     status: "pass" },
    { key: "h1Found",          status: "pass" },
    { key: "nextjsDetected",   status: "info" },
    { key: "lcpScore",         status: "warn" },
    { key: "performanceScore", status: "warn" },
  ];

  return (
    <div className={s.mockCard}>
      <div className={s.mockHeader}>
        <div className={s.mockFavicon}>🌐</div>
        <div>
          <div className={s.mockUrl}>{tMock.url}</div>
          <div className={s.mockUrlDetail}>{tMock.urlDetail}</div>
        </div>
        <div className={s.mockScore}>{tMock.score}</div>
      </div>

      <div className={s.mockRings}>
        <ScoreRing value={88} label="Sécurité" color="#6366f1" />
        <ScoreRing value={72} label="SEO" color="#0ea5e9" />
        <ScoreRing value={65} label="A11y" color="#f59e0b" />
        <ScoreRing value={71} label="Perf." color="#10b981" />
      </div>

      <div className={s.mockChecks}>
        {checkItems.map((item) => (
          <div key={item.key} className={s.mockCheckItem}>
            <span className={`${s.mockDot} ${dotClass[item.status]}`} />
            <span className={s.mockCheckText}>{tMock.checks[item.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { t } = useLang();
  const tl = t.landing;

  return (
    <div className={s.page}>

      {/* NAV */}
      <nav className={s.nav}>
        <div className={s.navInner}>
          <div className={s.logo}>
            <span className={s.logoIcon}>👁</span>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>{t.nav.logo}</span>
          </div>
          <div className={s.navRight}>
            <LangToggle />
            <a href="/dashboard" className={s.navCta}>{t.nav.openConsole}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className={s.heroSection}>
        <div className={s.heroInner}>
          <div className={s.heroLeft}>
            <span className={s.badge}>{tl.hero.badge}</span>

            <h1 className={s.headline}>
              {tl.hero.headline.split("\n").map((line, i) => (
                <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
              ))}
            </h1>

            <p className={s.sub}>{tl.hero.sub}</p>

            <div className={s.heroFormWrap}>
              <NewsletterForm t={tl.hero} size="large" />
            </div>
          </div>

          <div className={s.heroRight}>
            <MockReport tMock={tl.mockReport} />
          </div>
        </div>
        <div className={s.heroFade} />
      </section>

      {/* MODULES */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{tl.modules.title}</h2>
            <p className={s.sectionSub}>{tl.modules.sub}</p>
          </div>
          <div className={s.grid5}>
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
                {i < tl.how.steps.length - 1 && <div className={s.stepArrow}>→</div>}
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
            {tl.why.items.map((item) => (
              <div key={item.label} className={s.whyCard}>
                <span className={s.whyIcon}>{item.icon}</span>
                <h3 className={s.whyLabel}>{item.label}</h3>
                <p className={s.whyDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER (bottom CTA) */}
      <section className={s.sectionDark}>
        <div className={s.containerNarrow}>
          <h2 className={s.sectionTitleLight} style={{ marginBottom: 12 }}>{tl.newsletter.title}</h2>
          <p className={s.sectionSubDark}>{tl.newsletter.sub}</p>
          <NewsletterForm
            t={{
              inputPlaceholder: tl.newsletter.inputPlaceholder,
              cta: tl.newsletter.cta,
              ctaLoading: tl.newsletter.ctaLoading,
              hint: tl.newsletter.hint,
              successTitle: tl.hero.successTitle,
              successMsg: tl.hero.successMsg,
              alreadyMsg: tl.hero.alreadyMsg,
              errorMsg: tl.hero.errorMsg,
            }}
            size="large"
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span>{tl.footer.built}</span>
          <span>{tl.footer.copy}</span>
        </div>
      </footer>
    </div>
  );
}
