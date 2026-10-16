import { afterEach, describe, expect, it, vi } from "vitest";
import { urlEasterEgg } from "./easter-eggs";

afterEach(() => vi.unstubAllEnvs());

describe("URL surprises", () => {
  it.each([
    [" argos.lelouet.fr/en ", "argos"],
    ["HTTPS://WWW.GOOGLE.FR/search?q=audit", "google"],
    ["https://google.com./", "google"],
    ["https://en.wikipedia.org/wiki/Argus", "wikipedia"],
    ["http://github.com/dokor/argos", "github"],
    ["https://www.amazon.fr/", "amazon"],
  ])("recognizes %s from its parsed hostname", (input, expected) => {
    expect(urlEasterEgg(input)).toBe(expected);
  });

  it("recognizes a configured Argos domain without matching its neighbours", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://audit.example/");
    expect(urlEasterEgg("audit.example/en")).toBe("argos");
    expect(urlEasterEgg("https://audit.example.evil.test")).toBeUndefined();
  });

  it.each([
    "", "https://", "ftp://google.com", "javascript:alert(1)",
    "https://google.com.evil.test", "https://notgoogle.com", "https://google.com@evil.test",
    "https://user:secret@github.com", "https://evil.test/google.com?next=https://amazon.fr",
    "https://argos.lelouet.fr.evil.test", "https://example.com/" + "x".repeat(2048),
  ])("stays silent for unrelated, misleading or invalid input: %s", input => {
    expect(urlEasterEgg(input)).toBeUndefined();
  });
});
