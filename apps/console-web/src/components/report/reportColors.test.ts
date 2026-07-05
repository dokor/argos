import { describe, expect, it } from "vitest";
import {
  scoreColor,
  scoreBg,
  scoreChipTheme,
  scoreKpiTheme,
  SEVERITY_COLORS,
  type SeverityKey,
} from "./reportColors";

// Garde le système de couleurs centralisé (issue #121) : bornes de bandes de score
// et complétude des couleurs de sévérité.

describe("scoreColor", () => {
  it("mappe chaque bande de score sur la bonne couleur (bornes incluses)", () => {
    expect(scoreColor(100)).toBe("#10b981");
    expect(scoreColor(85)).toBe("#10b981");
    expect(scoreColor(84)).toBe("#3b82f6");
    expect(scoreColor(70)).toBe("#3b82f6");
    expect(scoreColor(69)).toBe("#f59e0b");
    expect(scoreColor(55)).toBe("#f59e0b");
    expect(scoreColor(54)).toBe("#ef4444");
    expect(scoreColor(0)).toBe("#ef4444");
  });
});

describe("scoreBg", () => {
  it("aligne ses bandes sur scoreColor", () => {
    expect(scoreBg(90)).toContain("16,185,129");
    expect(scoreBg(75)).toContain("59,130,246");
    expect(scoreBg(60)).toContain("245,158,11");
    expect(scoreBg(10)).toContain("239,68,68");
  });
});

describe("scoreChipTheme (unifié #190)", () => {
  it("utilise les mêmes seuils que scoreColor (85/70/55 sur ratio 0..1)", () => {
    // Accent aligné sur scoreColor pour chaque bande.
    expect(scoreChipTheme(0.9).dot).toBe("#10b981");
    expect(scoreChipTheme(0.8).dot).toBe("#3b82f6");   // 80 < 85 -> bande "bon"
    expect(scoreChipTheme(0.6).dot).toBe("#f59e0b");   // 60 < 70 -> bande "moyen"
    expect(scoreChipTheme(0.3).dot).toBe("#ef4444");
  });
  it("borne le ratio et renvoie un thème complet", () => {
    const t = scoreChipTheme(2);
    expect(t.dot).toBe("#10b981");
    expect(t.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(t.fg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(t.border).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("scoreKpiTheme (unifié #190)", () => {
  it("aligne l'accent sur scoreColor", () => {
    expect(scoreKpiTheme(90).accent).toBe(scoreColor(90));
    expect(scoreKpiTheme(60).accent).toBe(scoreColor(60));
  });
  it("renvoie un thème neutre pour un score absent", () => {
    expect(scoreKpiTheme(null).accent).toBe("#64748b");
  });
});

describe("SEVERITY_COLORS", () => {
  it("définit color/bg/dot pour chaque sévérité", () => {
    const keys: SeverityKey[] = ["critical", "important", "info", "opportunity"];
    for (const key of keys) {
      const c = SEVERITY_COLORS[key];
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.dot).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
