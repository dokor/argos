// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangProvider";
import PremiumWaitlist, { premiumCopy } from "./PremiumWaitlist";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
for (const lang of ["fr", "en"] as const) {
  it(`submits an explicit Premium choice and announces success in ${lang}`, async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal("fetch", fetcher);
    render(<LangProvider initialLang={lang}><PremiumWaitlist /></LangProvider>);
    const email = screen.getByRole("textbox", { name: premiumCopy[lang].email });
    const checkbox = screen.getByRole("checkbox"); expect((checkbox as HTMLInputElement).checked).toBe(false);
    fireEvent.change(email, { target: { value: "synthetic@example.com" } }); fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(premiumCopy[lang].success));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: "synthetic@example.com", consent: true, locale: lang });
    expect(fetcher.mock.calls[0][0]).toBe("/api/premium-waitlist");
    expect((email as HTMLInputElement).value).toBe("");
  });
  it(`keeps input and exposes a retryable error in ${lang}`, async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    render(<LangProvider initialLang={lang}><PremiumWaitlist /></LangProvider>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "synthetic@example.com" } }); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(premiumCopy[lang].limited));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("synthetic@example.com");
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
}
