// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AntiBotNotice from "./AntiBotNotice";

describe("AntiBotNotice (#195)", () => {
  it("affiche le bandeau et le fournisseur quand une protection est détectée", () => {
    render(<AntiBotNotice antiBot={{ detected: true, vendor: "cloudflare" }} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Le vendor est capitalisé et affiché.
    expect(screen.getByText(/Cloudflare/)).toBeInTheDocument();
  });

  it("n'affiche rien quand aucune protection n'est détectée", () => {
    const { container } = render(<AntiBotNotice antiBot={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("n'affiche rien quand detected est false", () => {
    const { container } = render(<AntiBotNotice antiBot={{ detected: false }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
