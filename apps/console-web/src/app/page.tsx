"use client";

import React, { useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import LangToggle from "@/components/LangToggle";

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
      <div style={styles.successBox}>
        <span style={{ fontSize: size === "large" ? 20 : 18 }}>✓</span>
        <div>
          <div style={{ fontWeight: 600, color: "#0f172a" }}>{t.successTitle}</div>
          <div style={{ color: "#475569", fontSize: 14, marginTop: 2 }}>{t.successMsg}</div>
        </div>
      </div>
    );
  }

  const inputH = size === "large" ? 52 : 46;

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.inputPlaceholder}
          disabled={state === "loading"}
          style={{ ...styles.input, height: inputH, fontSize: size === "large" ? 16 : 15, flex: "1 1 220px" }}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          style={{ ...styles.btn, height: inputH, fontSize: size === "large" ? 16 : 15, opacity: state === "loading" ? 0.7 : 1 }}
        >
          {state === "loading" ? t.ctaLoading : t.cta}
        </button>
      </div>

      {(state === "already" || state === "error") && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: state === "already" ? "#0369a1" : "#dc2626" }}>
          {state === "already" ? t.alreadyMsg : t.errorMsg}
        </p>
      )}
      {state === "idle" && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#94a3b8" }}>{t.hint}</p>
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
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
      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ─── Mock report card ─────────────────────────────────────────────────────────

function MockReport({ tMock }: { tMock: { url: string; urlDetail: string; score: string; checks: Record<string, string> } }) {
  const checkItems = [
    { key: "httpsEnforced", status: "pass" },
    { key: "hstsPresent",   status: "pass" },
    { key: "cspMissing",    status: "warn" },
    { key: "redirects",     status: "warn" },
    { key: "metaDescMissing", status: "fail" },
  ] as const;

  return (
    <div style={styles.mockCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={styles.mockFavicon}>🌐</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{tMock.url}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{tMock.urlDetail}</div>
        </div>
        <div style={{ marginLeft: "auto", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#15803d" }}>
          {tMock.score}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "space-around", padding: "16px 0", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
        <ScoreRing value={88} label="Sécurité" color="#6366f1" />
        <ScoreRing value={72} label="SEO" color="#0ea5e9" />
        <ScoreRing value={65} label="A11y" color="#f59e0b" />
        <ScoreRing value={71} label="Perf." color="#10b981" />
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        {checkItems.map((item) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: item.status === "pass" ? "#22c55e" : item.status === "warn" ? "#f59e0b" : "#ef4444",
            }} />
            <span style={{ color: "#374151" }}>{tMock.checks[item.key]}</span>
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#0f172a", background: "#fff" }}>

      {/* NAV */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>👁</span>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>{t.nav.logo}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LangToggle />
            <a href="/dashboard" style={styles.navCta}>{t.nav.openConsole}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={styles.heroSection}>
        <div style={styles.heroInner}>
          <div style={styles.heroLeft}>
            <span style={styles.badge}>{tl.hero.badge}</span>

            <h1 style={styles.headline}>
              {tl.hero.headline.split("\n").map((line, i) => (
                <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
              ))}
            </h1>

            <p style={styles.sub}>{tl.hero.sub}</p>

            <div style={{ maxWidth: 480, width: "100%" }}>
              <NewsletterForm t={tl.hero} size="large" />
            </div>
          </div>

          <div style={styles.heroRight}>
            <MockReport tMock={tl.mockReport} />
          </div>
        </div>
        <div style={styles.heroFade} />
      </section>

      {/* MODULES */}
      <section style={styles.section}>
        <div style={styles.container}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{tl.modules.title}</h2>
            <p style={styles.sectionSub}>{tl.modules.sub}</p>
          </div>
          <div style={styles.grid5}>
            {tl.modules.items.map((m) => (
              <div key={m.label} style={styles.moduleCard}>
                <span style={styles.moduleIcon}>{m.icon}</span>
                <h3 style={styles.moduleLabel}>{m.label}</h3>
                <p style={styles.moduleDesc}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ ...styles.section, background: "#f8fafc" }}>
        <div style={styles.container}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{tl.how.title}</h2>
          </div>
          <div style={styles.stepsGrid}>
            {tl.how.steps.map((step, i) => (
              <div key={step.n} style={styles.stepCard}>
                <div style={styles.stepNumber}>{step.n}</div>
                {i < tl.how.steps.length - 1 && <div style={styles.stepArrow}>→</div>}
                <h3 style={styles.stepLabel}>{step.label}</h3>
                <p style={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY ARGOS */}
      <section style={styles.section}>
        <div style={styles.container}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{tl.why.title}</h2>
          </div>
          <div style={styles.grid4}>
            {tl.why.items.map((item) => (
              <div key={item.label} style={styles.whyCard}>
                <span style={styles.whyIcon}>{item.icon}</span>
                <h3 style={styles.whyLabel}>{item.label}</h3>
                <p style={styles.whyDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER (bottom CTA) */}
      <section style={{ ...styles.section, background: "#0f172a" }}>
        <div style={{ ...styles.container, maxWidth: 640, textAlign: "center" as const }}>
          <h2 style={{ ...styles.sectionTitle, color: "#f8fafc", marginBottom: 12 }}>{tl.newsletter.title}</h2>
          <p style={{ color: "#94a3b8", marginBottom: 28, lineHeight: 1.6 }}>{tl.newsletter.sub}</p>
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
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <span>{tl.footer.built}</span>
          <span>{tl.footer.copy}</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  nav: { position: "sticky" as const, top: 0, zIndex: 50, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #f1f5f9" },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoIcon: { fontSize: 22 },
  navCta: { background: "#0f172a", color: "#fff", textDecoration: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500 },
  heroSection: { position: "relative" as const, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)", overflow: "hidden", padding: "80px 24px 0" },
  heroInner: { maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "flex-start", gap: 48, flexWrap: "wrap" as const, paddingBottom: 80 },
  heroLeft: { flex: "1 1 380px", display: "flex", flexDirection: "column" as const, gap: 20 },
  heroRight: { flex: "1 1 340px", minWidth: 280 },
  heroFade: { position: "absolute" as const, bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, #fff)" },
  badge: { display: "inline-block", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: 99, padding: "4px 14px", fontSize: 12, fontWeight: 500, letterSpacing: "0.02em" },
  headline: { fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#f8fafc", margin: 0 },
  sub: { fontSize: 16, color: "#94a3b8", lineHeight: 1.7, margin: 0, maxWidth: 500 },
  input: { border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", borderRadius: 10, padding: "0 16px", outline: "none", fontSize: 15, minWidth: 0 },
  btn: { background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "0 22px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 },
  successBox: { display: "flex", alignItems: "center", gap: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 18px" },
  section: { padding: "72px 24px" },
  container: { maxWidth: 1100, margin: "0 auto" },
  sectionHeader: { textAlign: "center" as const, marginBottom: 48 },
  sectionTitle: { fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px" },
  sectionSub: { color: "#64748b", fontSize: 16, margin: 0 },
  grid5: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  moduleCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "22px 20px", display: "flex", flexDirection: "column" as const, gap: 10 },
  moduleIcon: { fontSize: 26 },
  moduleLabel: { fontSize: 15, fontWeight: 600, margin: 0 },
  moduleDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 },
  stepsGrid: { display: "flex", gap: 0, alignItems: "flex-start", flexWrap: "wrap" as const, position: "relative" as const },
  stepCard: { flex: "1 1 200px", padding: "0 32px", position: "relative" as const },
  stepNumber: { fontSize: 36, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 },
  stepArrow: { position: "absolute" as const, right: -12, top: 8, fontSize: 20, color: "#cbd5e1" },
  stepLabel: { fontSize: 17, fontWeight: 600, margin: "0 0 8px" },
  stepDesc: { fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 },
  whyCard: { padding: "24px", border: "1px solid #f1f5f9", borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" as const, gap: 10 },
  whyIcon: { fontSize: 24 },
  whyLabel: { fontSize: 15, fontWeight: 600, margin: 0 },
  whyDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 },
  mockCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", width: "100%", maxWidth: 400 },
  mockFavicon: { width: 32, height: 32, background: "#f1f5f9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  footer: { background: "#0f172a", padding: "24px", borderTop: "1px solid #1e293b" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8, fontSize: 13, color: "#475569" },
};
