// Pure allowlist shared by server redirects and client forms.
export function safeAccountReturn(raw: unknown): string {
  return typeof raw === "string" && raw.length <= 600 && /^\/(?:en\/)?(?:account(?:\/(?:settings(?:\?section=(?:profile|security|connections))?|analyses\/new|sites(?:\/[1-9]\d{0,18})?|runs\/[1-9]\d{0,18}|urls\/[1-9]\d{0,18}\/history))?|report\/[A-Za-z0-9_-]{20,512})$/.test(raw) ? raw : "/account/sites";
}
