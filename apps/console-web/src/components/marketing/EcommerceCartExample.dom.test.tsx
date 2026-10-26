// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EcommerceCartExample from "./EcommerceCartExample";

describe("isolated ecommerce teaching simulation", () => {
  it.each(["fr", "en"] as const)("lets the reader reproduce the mismatch and verify the fix in %s", async lang => {
    const user = userEvent.setup();
    const fr = lang === "fr";
    render(<EcommerceCartExample lang={lang} />);
    const select = screen.getByRole("combobox", { name: fr ? "Taille du tee-shirt" : "T-shirt size" });
    const add = screen.getByRole("button", { name: fr ? "Simuler l’ajout au panier" : "Simulate adding to cart" });
    await user.selectOptions(select, "L");
    await user.click(add);
    expect(screen.getByRole("status")).toHaveTextContent("TS-L");
    expect(screen.getByRole("status")).toHaveTextContent("TS-S");
    expect(screen.getByRole("status")).toHaveTextContent(fr ? "Échec" : "Failure");
    await user.click(screen.getByRole("radio", { name: fr ? "Après correction" : "After the fix" }));
    expect(screen.getByRole("status")).not.toHaveTextContent("TS-S");
    // The corrected version must preserve every choice, including one that hid the bug.
    for (const size of ["S", "M", "L"]) {
      await user.selectOptions(select, size);
      await user.click(add);
      expect(screen.getByRole("status")).toHaveTextContent(fr ? "Variante conforme" : "Variant matches");
      expect(screen.getByRole("status").textContent?.match(new RegExp(`TS-${size}`, "g"))).toHaveLength(2);
    }
    await user.click(screen.getByRole("radio", { name: fr ? "Avant correction" : "Before the fix" }));
    expect(screen.getByRole("status")).toHaveTextContent(fr ? "Choisissez une taille" : "Choose a size");
  });
});
