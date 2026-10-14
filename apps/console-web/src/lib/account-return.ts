import {safeDomainReturn} from "./connected/domain-navigation";
import {domainSummaryQuery} from "./domain-summary-request";
// Pure allowlist shared by server redirects and client forms.
export function safeAccountReturn(raw: unknown): string {
  const domain=safeDomainReturn(raw);if(domain)return domain;
  if(typeof raw==="string"&&raw.length<=4096&&!/[\\#\x00-\x20]/.test(raw)) {
    const [path,query]=raw.split("?");
    if(/^\/(?:en\/)?account\/domains$/.test(path)&&raw.split("?").length<=2&&domainSummaryQuery("domains",new URLSearchParams(query)))return raw;
    if(/^\/(?:en\/)?account\/domains\/new$/.test(path))return path;
  }
  return typeof raw === "string" && raw.length <= 600 && /^\/(?:en\/)?(?:account(?:\/(?:usage|settings(?:\?section=(?:profile|security|connections))?|analyses\/new|sites(?:\/[1-9]\d{0,18})?|runs\/[1-9]\d{0,18}|urls\/[1-9]\d{0,18}\/history))?|report\/[A-Za-z0-9_-]{20,512})$/.test(raw) ? raw : "/account/sites";
}
