import { describe, expect, it } from "vitest";
import { GET } from "@/app/downloads/[lang]/grille-recette-refonte.csv/route";
describe("localized redesign checklist", () => {
  it("exports English cells with a UTF-8 attachment and the same number of rows", async () => {
    const response = await GET(new Request("https://argos.example/downloads/en/grille-recette-refonte.csv"), { params: Promise.resolve({ lang: "en" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Language")).toBe("en");
    expect(response.headers.get("Content-Disposition")).toContain("website-redesign-checklist-en.csv");
    const csv = await response.text();
    expect(csv).toContain("URL or journey");
    expect(csv).toContain("Expected business outcome documented and reproduced");
    expect(csv).not.toContain("À vérifier");
    expect(csv.trim().split(/\r?\n/)).toHaveLength(19);
  });
  it.each(["zz", "../fr", "en-US"])("rejects an unsupported catalogue path %s", async lang => {
    expect((await GET(new Request("https://argos.example"), { params: Promise.resolve({ lang }) })).status).toBe(404);
  });
});
