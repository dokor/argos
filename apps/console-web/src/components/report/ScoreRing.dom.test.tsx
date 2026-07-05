// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ScoreRing from "./ScoreRing";

describe("ScoreRing (#193)", () => {
  it("rend un SVG avec libellé accessible et le contenu central fourni", () => {
    const { getByLabelText, getByText } = render(
      <ScoreRing score={93}>
        <text>93</text>
      </ScoreRing>
    );
    expect(getByLabelText("Score 93/100")).toBeInTheDocument();
    expect(getByText("93")).toBeInTheDocument();
  });

  it("remplit l'arc proportionnellement au score (gap = circ - dash, cf. #168)", () => {
    const { getByLabelText } = render(<ScoreRing score={100} />);
    const svg = getByLabelText("Score 100/100");
    const arc = svg.querySelectorAll("circle")[1];
    const [dash, gap] = (arc.getAttribute("stroke-dasharray") || "")
      .split(" ")
      .map(Number);
    // Score 100 : anneau plein => gap ~ 0, dash > 0.
    expect(gap).toBeCloseTo(0, 5);
    expect(dash).toBeGreaterThan(0);
  });
});
