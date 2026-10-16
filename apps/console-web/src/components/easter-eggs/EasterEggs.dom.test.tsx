// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LangProvider } from "@/lib/i18n/LangContext";
import EasterEggs from "./EasterEggs";

const sequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let media: EventTarget & { matches: boolean };
function enter(target: EventTarget = document.body, options: KeyboardEventInit = {}) {
  for (const key of sequence) target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
}

beforeEach(() => {
  vi.useFakeTimers();
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("welcomes inspectors once, even in Strict Mode and after remounting, with only a public source link", () => {
  const view = render(<StrictMode><LangProvider initialLang="en"><EasterEggs /></LangProvider></StrictMode>);
  view.unmount();
  render(<EasterEggs />);
  expect(console.info).toHaveBeenCalledExactlyOnceWith("You’re looking under the hood. So are we.\nWelcome to Argos.\nhttps://github.com/dokor/argos");
  expect(fetch).not.toHaveBeenCalled();
});

it("announces the surprise without taking focus, cancelling keys or making requests", () => {
  const { container } = render(<><button>Origine</button><EasterEggs /></>);
  const origin = screen.getByRole("button", { name: "Origine" });
  origin.focus();
  const key = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
  document.body.dispatchEvent(key);
  expect(key.defaultPrevented).toBe(false);
  act(() => enter());
  expect(screen.getByRole("status")).toHaveTextContent("Mode vigilance maximale activé.");
  expect(document.activeElement).toBe(origin);
  expect(container.querySelectorAll('[aria-hidden="true"] svg')).toHaveLength(12);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "Fermer le réveil des cent yeux" })).not.toBeInTheDocument();
});

it.each(["input", "textarea", "select", "editable", "textbox"])("ignores the code inside %s", kind => {
  render(<><EasterEggs /><input aria-label="input" /><textarea aria-label="textarea" /><select aria-label="select" />
    <div contentEditable data-testid="editable" /><div role="textbox" data-testid="textbox" /></>);
  const target = ["editable", "textbox"].includes(kind) ? screen.getByTestId(kind) : screen.getByLabelText(kind);
  act(() => enter(target));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }, { isComposing: true }])("ignores modified, repeated or composing keys: %j", options => {
  render(<EasterEggs />);
  act(() => enter(document.body, options));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("expires incomplete sequences and ignores interrupted ones", () => {
  render(<EasterEggs />);
  sequence.slice(0, 5).forEach(key => fireEvent.keyDown(document.body, { key }));
  act(() => vi.advanceTimersByTime(3001));
  sequence.slice(5).forEach(key => fireEvent.keyDown(document.body, { key }));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  sequence.slice(0, 5).forEach(key => fireEvent.keyDown(document.body, { key }));
  fireEvent.keyDown(document.body, { key: "x" });
  sequence.slice(5).forEach(key => fireEvent.keyDown(document.body, { key }));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("lets the eyes follow the pointer and resets them when reduced motion is requested", () => {
  const { container } = render(<EasterEggs />);
  act(() => enter());
  fireEvent(window, new MouseEvent("pointermove", { clientX: 300, clientY: 100 }));
  act(() => vi.advanceTimersByTime(20));
  const pupil = container.querySelector("svg g") as SVGGElement;
  expect(pupil.style.getPropertyValue("--look-x")).not.toBe("");
  act(() => { media.matches = true; media.dispatchEvent(new Event("change")); });
  expect(pupil.style.getPropertyValue("--look-x")).toBe("");
  fireEvent(window, new MouseEvent("pointermove", { clientX: 50, clientY: 30 }));
  act(() => vi.advanceTimersByTime(20));
  expect(pupil.style.getPropertyValue("--look-x")).toBe("");
});

it("dismisses automatically after five seconds and restores focus from the close button", () => {
  render(<><button>Origine</button><EasterEggs /></>);
  const origin = screen.getByRole("button", { name: "Origine" });
  origin.focus();
  act(() => enter());
  screen.getByRole("button", { name: "Fermer le réveil des cent yeux" }).focus();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(document.activeElement).toBe(origin);
});

it("provides an English, keyboard-operable close control and removes listeners on unmount", () => {
  const remove = vi.spyOn(window, "removeEventListener");
  const view = render(<LangProvider initialLang="en"><EasterEggs /></LangProvider>);
  act(() => enter());
  expect(screen.getByRole("status")).toHaveTextContent("Maximum vigilance mode activated.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss the hundred eyes" }));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  act(() => enter());
  view.unmount();
  expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
});

it("keeps the original focus target when the code is repeated while the close button is focused", () => {
  render(<><button>Origine</button><EasterEggs /></>);
  const origin = screen.getByRole("button", { name: "Origine" });
  origin.focus();
  act(() => enter());
  const close = screen.getByRole("button", { name: "Fermer le réveil des cent yeux" });
  close.focus();
  act(() => enter(close));
  fireEvent.click(close);
  expect(document.activeElement).toBe(origin);
});
