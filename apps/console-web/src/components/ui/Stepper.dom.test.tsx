// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Stepper from "./Stepper";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";

it.each([fr, en])("exposes ordered steps, current step and textual states in each language", (t) => {
  const c = t.domainPage;
  const steps = [
    { id: "scope", label: c.steps.scope },
    { id: "selection", label: c.steps.selection },
    { id: "confirmation", label: c.steps.confirmation },
  ];
  render(<Stepper steps={steps} currentStep="selection" label={c.newTitle} statusLabels={c.steps.status} />);

  const list = screen.getByRole("list", { name: c.newTitle });
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(items[0]).toHaveTextContent(c.steps.scope);
  expect(items[0]).toHaveTextContent(c.steps.status.completed);
  expect(items[0]).not.toHaveAttribute("aria-current");
  expect(items[0].querySelector("svg")).toBeInTheDocument();
  expect(items[1]).toHaveAttribute("aria-current", "step");
  expect(items[1]).toHaveTextContent(c.steps.status.current);
  expect(within(items[1]).getByText("2")).toHaveAttribute("aria-hidden", "true");
  expect(items[2]).toHaveTextContent(c.steps.status.upcoming);
  expect(items[2]).not.toHaveAttribute("aria-current");
  expect(within(list).queryByRole("button")).not.toBeInTheDocument();
  expect(within(list).queryByRole("link")).not.toBeInTheDocument();
});

it("follows forward and backward transitions for an arbitrary workflow", () => {
  const steps = ["details", "review", "payment", "receipt"].map((id) => ({ id, label: id }));
  const props = { steps, label: "Checkout", statusLabels: en.domainPage.steps.status };
  const view = render(<Stepper {...props} currentStep="details" />);
  for (const index of [0, 1, 2, 3, 1, 0]) {
    view.rerender(<Stepper {...props} currentStep={steps[index].id} />);
    const items = screen.getAllByRole("listitem");
    expect(items.filter((item) => item.hasAttribute("aria-current"))).toHaveLength(1);
    items.forEach((item, position) => {
      expect(item).toHaveTextContent(props.statusLabels[position < index ? "completed" : position === index ? "current" : "upcoming"]);
      expect(item.querySelector("svg") !== null).toBe(position < index);
    });
  }
});
