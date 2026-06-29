"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { argosApi } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import ArgosIcon from "@/components/ArgosIcon";
import LangToggle from "@/components/LangToggle";
import s from "./page.module.scss";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500;
const MAX_POLL = 48; // ~2 min

// ─── Hero audit form ──────────────────────────────────────────────────────────

type AuditPhase = "idle" | "submitting" | "polling" | "redirecting" | "error";

type AuditFormT = {
  inputPlaceholder: string;
  cta: string;
  ctaLoading: string;
  hint: string;
  analyzing: string;
  analyzeSteps: string[];
  redirecting: string;
  errorMsg: string;
  errorFailed: string;
  retry: string;
};

function HeroAuditForm({
  t,
  variant = "hero",
}: {
  t: AuditFormT;
  variant?: "hero" | "cta";
}) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [stepIdx, setStepIdx] = useState(0);
  const runIdRef = useRef<string | number | null>(null);
  const pollCountRef = useRef(0);
  const router = useRouter();
  const isHero = variant === "hero";
  const h = isHero ? 52 : 46;
  const fs = isHero ? 16 : 15;

  useEffect(() => {
    if (phase !== "polling") return;

    const id = setInterval(async () => {
      pollCountRef.current++;
      setStepIdx((i) => (i + 1) % t.analyzeSteps.length);

      if (pollCountRef.current > MAX_POLL) {
        clearInterval(id);
        setPhase("error");
        setErrMsg(t.errorMsg);
        return;
      }

      if (runIdRef.current === null) return;
      try {
        const run = await argosApi.getRunsByRunId(runIdRef.current);
        if (run.status === "COMPLETED" && run.reportToken) {
          clearInterval(id);
          setPhase("redirecting");
          router.push(`/report/${run.reportToken}`);
        } else if (run.status === "FAILED") {
          clearInterval(id);
          setPhase("error");
          setErrMsg(t.errorFailed);
        }
      } catch {
        // Ignore transient errors, keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [phase, router, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || phase !== "idle") return;
    setPhase("submitting");
    setErrMsg("");
    try {
      const res = await argosApi.createAudit({ url: trimmed });
      runIdRef.current = res.runId;
      pollCountRef.current = 0;
      setStepIdx(0);
      setPhase("polling");
    } catch {
      setPhase("error");
      setErrMsg(t.errorMsg);
    }
  }

  if (phase === "polling" || phase === "redirecting") {
    return (
      <div className={s.analyzingBox}>
        <span className={s.analyzingSpinner} />
        <span className={s.analyzingText}>
          {phase === "redirecting"
            ? t.redirecting
            : `${t.analyzing} — ${t.analyzeSteps[stepIdx]}...`}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div className={s.formRow}>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.inputPlaceholder}
          disabled={phase === "submitting"}
          className={s.input}
          style={{ height: h, fontSize: fs }}
        />
        <button
          type="submit"
          disabled={phase === "submitting"}
          className={s.btn}
          style={{ height: h, fontSize: fs }}
        >
          {phase === "submitting" ? t.ctaLoading : t.cta}
        </button>
      </div>
      {phase === "error" && (
        <div className={s.formErrorRow}>
          <p className={s.formErrorMsg} style={{ margin: 0, fontSize: 13 }}>
            {errMsg}
          </p>
          <button
            type="button"
            className={s.retryBtn}
            onClick={() => setPhase("idle")}
          >
            {t.retry}
          </button>
        </div>
      )}
      {phase === "idle" && <p className={s.hint}>{t.hint}</p>}
    </form>
  );
}

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

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
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
        <text x={36} y={40} textAnchor="middle" fontSize={15} fontWeight={700} fill="#0f172a">
          {value}
        </text>
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

function MockReport({
  tMock,
}: {
  tMock: {
    url: string;
    urlDetail: string;
    score: string;
    checks: Record<string, string>;
  };
}) {
  const checkItems: Array<{ key: string; status: CheckStatus }> = [
    { key: "httpsEnforced", status: "pass" },
    { key: "hstsPresent", status: "pass" },
    { key: "cspMissing", status: "warn" },
    { key: "metaDescMissing", status: "fail" },
    { key: "titlePresent", status: "pass" },
    { key: "h1Found", status: "pass" },
    { key: "nextjsDetected", status: "info" },
    { key: "lcpScore", status: "warn" },
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
  const isAdmin = useIsAdmin();

  const formT: AuditFormT = {
    inputPlaceholder: tl.hero.inputPlaceholder,
    cta: tl.hero.cta,
    ctaLoading: tl.hero.ctaLoading,
    hint: tl.hero.hint,
    analyzing: tl.hero.analyzing,
    analyzeSteps: tl.hero.analyzeSteps,
    redirecting: tl.hero.redirecting,
    errorMsg: tl.hero.errorMsg,
    errorFailed: tl.hero.errorFailed,
    retry: tl.hero.retry,
  };

  return (
    <div className={s.page}>

      {/* NAV */}
      <nav className={s.nav}>
        <div className={s.navInner}>
          <div className={s.logo}>
            <ArgosIcon size={22} className={s.logoIcon} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
              {t.nav.logo}
            </span>
          </div>
          <div className={s.navRight}>
            <LangToggle />
            {isAdmin && (
              <a href="/dashboard" className={s.navCta}>
                {t.nav.openConsole}
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className={s.heroSection}>
        <div className={s.dotPattern} aria-hidden="true" />
        <div className={s.heroInner}>
          <div className={s.heroLeft}>
            <span className={s.badge}>{tl.hero.badge}</span>
            <h1 className={s.headline}>
              {tl.hero.headline.split("\n").map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i === 0 && <br />}
                </React.Fragment>
              ))}
            </h1>
            <p className={s.sub}>{tl.hero.sub}</p>
            <p className={s.audience}>{tl.hero.audience}</p>
            <div className={s.heroFormWrap}>
              <HeroAuditForm t={formT} variant="hero" />
            </div>
          </div>
          <div className={s.heroRight}>
            <MockReport tMock={tl.mockReport} />
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

      {/* BOTTOM CTA */}
      <section className={s.sectionDark}>
        <div className={s.containerNarrow}>
          <h2 className={s.sectionTitleLight} style={{ marginBottom: 12 }}>
            {tl.cta.title}
          </h2>
          <p className={s.sectionSubDark}>{tl.cta.sub}</p>
          <HeroAuditForm t={formT} variant="cta" />
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
