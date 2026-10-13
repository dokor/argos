import { it, expect } from "vitest";
import { validIntroduction } from "./report-introduction";
const input = { author: "Atelier conseil", context: "Revue de la page produit.", nextStep: "Examiner les deux preuves ensemble.", findingKeys: ["html.title", "html.h1.count"] };
it("accepts only bounded published fields and two or three unique canonical keys", () => {
  expect(validIntroduction(input)).toBe(true);
  for (const bad of [{ ...input, ownerId: "victim" }, { ...input, publishedAt: "yesterday" }, { ...input, context: "x".repeat(1201) }, { ...input, author: "\u0001bad" }, { ...input, findingKeys: ["html.title"] }, { ...input, findingKeys: ["html.title", "html.title"] }, { ...input, findingKeys: ["<script>", "html.title"] }]) expect(validIntroduction(bad)).toBe(false);
});
