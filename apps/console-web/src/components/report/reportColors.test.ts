import { describe, expect, it } from "vitest";
import { scoreColor, scoreBg, SEVERITY_COLORS, type SeverityKey } from "./reportColors";

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
