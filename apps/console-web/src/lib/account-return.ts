import {safeAdminReturn, safeAdminRunReturn} from "./admin-request";
import {safeOverviewReturn} from "./overview-request";
import { safeDomainReturn, validDomainId } from "./connected/domain-navigation";
import { domainSummaryQuery } from "./domain-summary-request";
// Pure allowlist shared by server redirects and client forms.
export function safeAccountReturn(raw: unknown): string {
  const admin=safeAdminReturn(raw) ?? safeAdminRunReturn(raw);if(admin)return admin;
  if(typeof raw==="string"&&/^\/(?:en\/)?account\/admin(?:\/users\/[1-9]\d{0,18}|\/events|\/runs)?$/.test(raw))return raw;
  const overview = safeOverviewReturn(raw);
  if (overview) return overview;
  const domain = safeDomainReturn(raw);
  if (domain) return domain;
  if (
    typeof raw === "string" &&
    raw.length <= 4096 &&
    !/[\\#\x00-\x20]/.test(raw)
  ) {
    const [path, query] = raw.split("?");
    const adminUser=/^\/(?:en\/)?account\/admin\/users\/([1-9][0-9]{0,18})$/.exec(path);
    if(adminUser&&validDomainId(adminUser[1])&&raw.split("?").length<=2){
      const q=new URLSearchParams(query),back=safeAdminReturn(q.get("returnTo"));
      if(q.size===1&&back)return path+"?returnTo="+encodeURIComponent(back);
    }
    const adminRun=/^\/(?:en\/)?account\/admin\/runs\/([1-9][0-9]{0,18})$/.exec(path);
    if(adminRun&&validDomainId(adminRun[1])&&raw.split("?").length<=2){
      const q=new URLSearchParams(query),back=safeAdminRunReturn(q.get("returnTo"));
      if(q.size===1&&back)return path+"?returnTo="+encodeURIComponent(back);
      if(q.size===0)return path;
    }
    const queueTask=/^\/(?:en\/)?account\/admin\/queue\/(DISCOVERY|BATCH|RUN)\/([1-9][0-9]{0,18})$/.exec(path);
    if(queueTask&&validDomainId(queueTask[2])&&raw.split("?").length<=2){
      const q=new URLSearchParams(query),back=safeAdminRunReturn(q.get("returnTo"));
      if(q.size===1&&back)return path+"?returnTo="+encodeURIComponent(back);
      if(q.size===0)return path;
    }
    const run = /^\/(?:en\/)?account\/runs\/([1-9][0-9]{0,18})$/.exec(path);
    const returnTo = new URLSearchParams(query).get("returnTo");
    if (run && validDomainId(run[1]) && (safeDomainReturn(returnTo)||safeOverviewReturn(returnTo)))
      return path + "?returnTo=" + encodeURIComponent(returnTo!);
    if (
      /^\/(?:en\/)?account\/domains$/.test(path) &&
      raw.split("?").length <= 2 &&
      domainSummaryQuery("domains", new URLSearchParams(query))
    )
      return raw;
    if (/^\/(?:en\/)?account\/domains\/new$/.test(path)) {
      const discovery = new URLSearchParams(query).get("discovery");
      return (
        path +
        (discovery && validDomainId(discovery) ? "?discovery=" + discovery : "")
      );
    }
  }
  return typeof raw === "string" &&
    raw.length <= 600 &&
    /^\/(?:en\/)?(?:account(?:\/(?:billing|usage|settings(?:\?section=(?:profile|security|connections))?|analyses\/new|sites(?:\/[1-9]\d{0,18})?|runs\/[1-9]\d{0,18}|urls\/[1-9]\d{0,18}\/history))?|(?:report|share)\/[A-Za-z0-9_-]{20,512})$/.test(
      raw,
    )
    ? raw
    : "/account/sites";
}
