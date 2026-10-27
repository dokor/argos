// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { LangProvider } from "@/lib/i18n/LangProvider";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import AccountView from "./AccountView";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("./AuthShell", () => ({ default: ({ children }: { children: ReactNode }) => children }));

// Exercise the real account client, CSRF bootstrap and anti-bot hook together.
const fetchMock = vi.fn<typeof fetch>();
const password = "  🔐 a synthetic passphrase  ";
let register: (init: RequestInit) => Promise<Response>;
let antiBot: () => Promise<Response>;
let enabled: boolean;
let proof: number;

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/account/register");
  enabled = true;
  proof = 0;
  register = async () => Response.json({ accepted: true });
  antiBot = async () => Response.json({ enabled: true, siteKey: "synthetic-site-key" });
  let callback: (value: string) => void;
  window.turnstile = {
    render: vi.fn((_element, options) => {
      callback = options.callback as typeof callback;
      expect(options.action).toBe("register");
      return "synthetic-widget";
    }),
    execute: vi.fn(() => callback(`synthetic-proof-${++proof}`)),
    remove: vi.fn(),
  };
  fetchMock.mockImplementation(async (url, init) => {
    switch (String(url)) {
      case "/api/account/auth/providers": return Response.json({ providers: [], enabled });
      case "/api/account/csrf": return Response.json({ csrf: "synthetic-csrf" });
      case "/api/antibot?action=register": return antiBot();
      case "/api/account/auth/register": return register(init!);
      default: throw new Error(`Unexpected request: ${String(url)}`);
    }
  });
});

afterEach(() => {
  delete window.turnstile;
  vi.unstubAllGlobals();
});

async function form(lang: "fr" | "en") {
  const copy = (lang === "fr" ? fr : en).account;
  const returnTo = `${lang === "en" ? "/en" : ""}/account/sites/42`;
  window.history.replaceState(null, "", `${lang === "en" ? "/en" : ""}/account/register?returnTo=${encodeURIComponent(returnTo)}`);
  render(<LangProvider initialLang={lang}><AccountView mode="register" /></LangProvider>);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/account/auth/providers", expect.anything()));
  const name = screen.getByLabelText(copy.name);
  const email = screen.getByLabelText(copy.email);
  const secret = screen.getByLabelText(copy.password);
  fireEvent.change(name, { target: { value: "Synthetic user" } });
  fireEvent.change(email, { target: { value: "fixture@example.invalid" } });
  fireEvent.change(secret, { target: { value: password } });
  const submit = screen.getByRole("button", { name: copy.register });
  return { copy, returnTo, name, email, secret, submit, element: submit.closest("form")! };
}

function registrations() {
  return fetchMock.mock.calls.filter(([url]) => url === "/api/account/auth/register");
}

describe.each(["fr", "en"] as const)("registration through the browser client in %s", lang => {
  it("sends credentials unchanged with CSRF and a fresh proof, prevents duplicates and permits correction", async () => {
    let finish!: (value: Response) => void;
    register = () => new Promise(resolve => { finish = resolve; });
    const { copy, returnTo, name, email, secret, submit, element } = await form(lang);
    fireEvent.submit(element);
    await waitFor(() => expect(registrations()).toHaveLength(1));
    for (const control of [name, email, secret, submit]) expect(control).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(element);
    expect(registrations()).toHaveLength(1);
    const request = registrations()[0][1]!;
    expect(request).toMatchObject({
      method: "POST", cache: "no-store",
      headers: { "X-Argos-CSRF": "synthetic-csrf", "X-Argos-Captcha": "synthetic-proof-1", "Accept-Language": lang },
    });
    expect(JSON.parse(request.body as string)).toEqual({
      email: "fixture@example.invalid", displayName: "Synthetic user", password, returnTo,
    });
    await act(async () => finish(Response.json({ accepted: true })));
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(copy.registrationSent);
    await waitFor(() => expect(notice).toHaveFocus());
    expect(notice).not.toHaveTextContent("fixture@example.invalid");
    expect(document.body).not.toHaveTextContent(password);
    expect(screen.queryByLabelText(copy.password)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    register = async () => Response.json({ accepted: true });
    fireEvent.click(screen.getByRole("button", { name: copy.correctEmail }));
    const corrected = screen.getByLabelText(copy.email);
    expect(corrected).toHaveFocus();
    expect(screen.getByLabelText(copy.password)).toHaveValue("");
    fireEvent.change(corrected, { target: { value: "corrected@example.invalid" } });
    fireEvent.change(screen.getByLabelText(copy.password), { target: { value: password } });
    fireEvent.submit(corrected.closest("form")!);
    await screen.findByText(copy.registrationSent);
    expect(registrations()).toHaveLength(2);
    const retry = registrations()[1][1]!;
    expect(retry.headers).toMatchObject({ "X-Argos-Captcha": "synthetic-proof-2" });
    expect(JSON.parse(retry.body as string)).toMatchObject({ email: "corrected@example.invalid", returnTo });
  });

  it.each([
    ["name_invalid", 400, "name"],
    ["email_invalid", 400, "email"],
    ["password_policy", 400, "password"],
    ["rate_limited", 429, null],
    ["mail_unavailable", 503, null],
  ] as const)("recovers from %s without resubmitting automatically", async (code, status, field) => {
    register = async () => Response.json({ error: code }, { status, headers: { "Retry-After": "900" } });
    const { copy, name, email, secret, submit, element } = await form(lang);
    fireEvent.submit(element);
    await screen.findByText(copy.errors[code]);
    const target = field === "name" ? name : field === "email" ? email : field === "password" ? secret : screen.getByRole("alert");
    await waitFor(() => expect(target).toHaveFocus());
    if (field) expect(target).toHaveAttribute("aria-invalid", "true");
    for (const control of [name, email, secret, submit]) expect(control).toBeEnabled();
    expect(secret).toHaveValue(password);
    expect(email).toHaveValue("fixture@example.invalid");
    expect(registrations()).toHaveLength(1);
    register = async () => Response.json({ accepted: true });
    fireEvent.submit(element);
    await screen.findByText(copy.registrationSent);
    expect(registrations()).toHaveLength(2);
    expect(registrations()[1][1]!.headers).toMatchObject({ "X-Argos-Captcha": "synthetic-proof-2" });
  });

  it("blocks registration during an anti-bot outage and permits an explicit retry", async () => {
    antiBot = async () => { throw new Error("Synthetic network failure"); };
    const { copy, element, submit } = await form(lang);
    fireEvent.submit(element);
    await screen.findByText(copy.errors.antibot_unavailable);
    expect(registrations()).toHaveLength(0);
    expect(submit).toBeEnabled();
    antiBot = async () => Response.json({ enabled: false });
    fireEvent.submit(element);
    await screen.findByText(copy.registrationSent);
    expect(registrations()).toHaveLength(1);
    expect(registrations()[0][1]!.headers).not.toHaveProperty("X-Argos-Captcha");
  });

  it("honors the disabled account service", async () => {
    enabled = false;
    const { copy, element, submit } = await form(lang);
    await screen.findByText(copy.unavailable);
    expect(submit).toBeDisabled();
    fireEvent.submit(element);
    expect(registrations()).toHaveLength(0);
    expect(window.turnstile!.execute).not.toHaveBeenCalled();
  });

  it.each(["", "invalid-email"])("does not submit an invalid email %j", async value => {
    const user = userEvent.setup();
    const { email, submit } = await form(lang);
    fireEvent.change(email, { target: { value } });
    expect(email).toBeInvalid();
    await user.click(submit);
    expect(registrations()).toHaveLength(0);
    expect(window.turnstile!.execute).not.toHaveBeenCalled();
  });
});
