import { expect, it } from "vitest";

it("MAIN_PROTECTION_NEGATIVE_PROBE: a real failing test must block merging", () => {
  expect("intentional red probe").toBe("green");
});
