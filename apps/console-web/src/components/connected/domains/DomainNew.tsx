"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "@/components/account/AccountSession";
import type {
  Discovery,
  DiscoveredPages,
  AnalysisProfiles,
  AdmittedBatch,
  BatchProgress,
  Usage,
} from "@/lib/connected/contracts";
import { batchPath, validDomainId } from "@/lib/connected/domain-navigation";
import {
  readDomainRequest,
  type DomainRequest,
} from "@/lib/connected/domain-request";
import { PageHeading, Surface } from "../Primitives";
import { useDomainResource, activeStatus } from "./useDomainResource";
import {
  useDomainText,
  State,
  Reason,
  DomainError,
  Waiting,
  ConfirmDialog,
  dateLabel,
  phrase,
} from "./DomainUi";
import s from "../Connected.module.scss";
import d from "./Domains.module.scss";
export default function DomainNew() {
  const { c, lang } = useDomainText(),
    router = useRouter(),
    params = useSearchParams(),
    session = useAccountSession();
  const discoveryId = params.get("discovery"),
    request = readDomainRequest(params.get("request")),
    valid = !discoveryId || validDomainId(discoveryId);
  const discoveryResource = useDomainResource<Discovery>(
      valid && discoveryId ? `domain-discoveries/${discoveryId}` : null,
      activeStatus,
    ),
    discovery = discoveryResource.data,
    running = !!discovery && activeStatus(discovery);
  const activeDiscoveries = useDomainResource<Discovery[]>(
      !discoveryId ? "domain-discoveries" : null,
    ),
    activeBatches = useDomainResource<BatchProgress[]>("domain-batches");
  const discovered = useDomainResource<DiscoveredPages>(
    discovery && !running
      ? `domain-discoveries/${discovery.id}/pages?inclusion=all&limit=100`
      : null,
  );
  const profiles = useDomainResource<AnalysisProfiles>(
    discovery && !running ? "analysis-profiles" : null,
  );
  const eligible = discovered.data?.items.filter((page) => page.eligible) ?? [];
  const selected =
    request?.kind === "batch"
      ? request.body.selectedPageIds
      : params.has("selected")
        ? (params.get("selected") ?? "").split(",").filter(Boolean)
        : eligible.map((page) => page.pageId);
  const profile =
    request?.kind === "batch"
      ? request.body.profileId
      : (params.get("profile") ?? profiles.data?.defaultProfileId ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<"launch" | "cancel" | null>(null),
    [quota, setQuota] = useState<Usage | null>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const navigate = (next: URLSearchParams, replace = true) => {
    const href = localizedPath(
      `/account/domains/new${next.size ? `?${next}` : ""}`,
      lang,
    );
    if (replace) router.replace(href, { scroll: false });
    else router.push(href);
  };
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values))
      if (value === null) next.delete(key);
      else next.set(key, value);
    navigate(next);
  };
  async function send(intent: DomainRequest) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const pending = new URLSearchParams(params);
    pending.set("request", JSON.stringify(intent));
    navigate(pending);
    try {
      if (intent.kind === "discovery") {
        const value = await accountFetch<Discovery>(
          "domain-discoveries",
          "POST",
          intent.body,
          undefined,
          intent.key,
        );
        if (alive.current)
          navigate(new URLSearchParams({ discovery: value.id }), false);
      } else {
        const value = await accountFetch<AdmittedBatch>(
          "domain-batches",
          "POST",
          intent.body,
          undefined,
          intent.key,
        );
        window.dispatchEvent(new Event("argos-usage-refresh"));
        if (
          alive.current &&
          validDomainId(value.domainId) &&
          validDomainId(value.id)
        )
          router.push(localizedPath(batchPath(value.domainId, value.id), lang));
      }
    } catch (reason) {
      if (!alive.current) return;
      session.invalidate(reason);
      setDialog(null);
      setError(
        reason instanceof AccountClientError
          ? reason.code
          : "account_unavailable",
      );
      if (reason instanceof AccountClientError && reason.status < 500) {
        pending.delete("request");
        if (intent.kind === "batch") {
          pending.set("selected", intent.body.selectedPageIds.join(","));
          pending.set("profile", intent.body.profileId);
        }
        navigate(pending);
        session.refreshUsage();
        activeBatches.reload();
        activeDiscoveries.reload();
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const [expiredAt, setExpiredAt] = useState<string | null>(null);
  useEffect(() => {
    if (!discovery) return;
    const deadline = discovery.expiresAt;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const remaining = Date.parse(deadline) - Date.now();
      if (remaining <= 0) setExpiredAt(deadline);
      else timer = setTimeout(arm, Math.min(remaining, 2147483647));
    };
    timer = setTimeout(arm, 0);
    return () => clearTimeout(timer);
  }, [discovery]);
  const expired = !!discovery && expiredAt === discovery.expiresAt;
  const selectionValid =
    selected.length > 0 &&
    selected.length <= 50 &&
    new Set(selected).size === selected.length &&
    selected.every((id) => eligible.some((page) => page.pageId === id)) &&
    !!profiles.data?.items.some((item) => item.id === profile);
  const available = session.usage?.available;
  const sufficient =
    !!session.usage &&
    !session.usageError &&
    session.usage.canLaunch &&
    (available === null ||
      (typeof available === "number" && available >= selected.length));
  async function confirmLaunch() {
    if (lock.current || !selectionValid || expired) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const fresh = await accountFetch<Usage>("usage");
      if (!alive.current) return;
      setQuota(fresh);
      if (
        !fresh.canLaunch ||
        (fresh.available !== null && fresh.available < selected.length)
      ) {
        setError("quota_exceeded");
        session.refreshUsage();
      } else setDialog("launch");
    } catch (reason) {
      session.invalidate(reason);
      if (alive.current) setError("account_unavailable");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function cancel() {
    if (lock.current || !discovery) return;
    lock.current = true;
    setBusy(true);
    try {
      await accountFetch(
        `domain-discoveries/${discovery.id}/cancel`,
        "POST",
        {},
      );
      if (alive.current) {
        setDialog(null);
        discoveryResource.reload();
      }
    } catch (reason) {
      session.invalidate(reason);
      if (alive.current)
        setError(
          reason instanceof AccountClientError
            ? reason.code
            : "account_unavailable",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const blocked = !session.profile?.verified || session.denied;
  useEffect(() => {
    window.dispatchEvent(new Event("argos-reading"));
  }, [params]);
  return (
    <main className={s.page}>
      <Link className={d.link} href="/account/domains">
        ← {c.back}
      </Link>
      <PageHeading title={c.newTitle} description={c.newIntro} />
      <ol className={d.steps}>
        <li aria-current={!discoveryId ? "step" : undefined}>{c.stepScope}</li>
        <li aria-current={discoveryId ? "step" : undefined}>
          {c.stepSelection}
        </li>
        <li>{c.stepLaunch}</li>
      </ol>
      {blocked ? (
        <Waiting allowed={false} />
      ) : !valid || (params.has("request") && !request) ? (
        <DomainError code="invalid_filters" />
      ) : (
        <>
          {error && <DomainError code={error} />}
          {discoveryId && activeBatches.error && (
            <DomainError
              code={activeBatches.error}
              retry={activeBatches.reload}
            />
          )}
          {request && (
            <div className={d.notice} role="status">
              <p>{c.recovery}</p>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() => void send(request)}
              >
                {c.retryRequest}
              </button>
            </div>
          )}
          {activeBatches.data?.map((batch) => (
            <div className={d.notice} key={batch.id}>
              <p>
                {c.activeBatch}: {batch.hostname}
              </p>
              <Link
                className={d.link}
                href={batchPath(batch.domainId, batch.id)}
              >
                {c.resumeBatch}
              </Link>
            </div>
          ))}
          {!discoveryId ? (
            <>
              {activeDiscoveries.data?.map((item) => (
                <div className={d.notice} key={item.id}>
                  <p>
                    {c.activeDiscovery}: {item.hostname}
                  </p>
                  <Link
                    className={d.link}
                    href={`/account/domains/new?discovery=${item.id}`}
                  >
                    {c.resumeDiscovery}
                  </Link>
                </div>
              ))}
              <Surface title={c.stepScope}>
                <form
                  className={d.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void send({
                      key: crypto.randomUUID(),
                      kind: "discovery",
                      body: {
                        hostname: String(form.get("hostname")).trim(),
                        maxUrls: Number(form.get("maxUrls")),
                        maxDepth: Number(form.get("maxDepth")),
                        excludedPaths: String(form.get("excludedPaths"))
                          .split(/\r?\n/)
                          .map((p) => p.trim())
                          .filter(Boolean),
                      },
                    });
                  }}
                >
                  <label>
                    {c.hostname}
                    <input
                      name="hostname"
                      required
                      maxLength={253}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      defaultValue={
                        request?.kind === "discovery"
                          ? request.body.hostname
                          : (params.get("hostname") ?? "")
                      }
                      disabled={busy || !!request}
                      aria-describedby="domain-host-hint"
                    />
                  </label>
                  <p id="domain-host-hint">{c.hostHint}</p>
                  <div className={d.columns}>
                    <label>
                      {c.maxUrls}
                      <input
                        name="maxUrls"
                        type="number"
                        min={1}
                        max={50}
                        required
                        defaultValue={
                          request?.kind === "discovery"
                            ? request.body.maxUrls
                            : 20
                        }
                        disabled={busy || !!request}
                      />
                    </label>
                    <label>
                      {c.maxDepth}
                      <input
                        name="maxDepth"
                        type="number"
                        min={0}
                        max={3}
                        required
                        defaultValue={
                          request?.kind === "discovery"
                            ? request.body.maxDepth
                            : 2
                        }
                        disabled={busy || !!request}
                      />
                    </label>
                  </div>
                  <label>
                    {c.exclusions}
                    <textarea
                      name="excludedPaths"
                      maxLength={50000}
                      defaultValue={
                        request?.kind === "discovery"
                          ? request.body.excludedPaths.join("\n")
                          : ""
                      }
                      disabled={busy || !!request}
                      aria-describedby="domain-exclusions-hint"
                    />
                  </label>
                  <p id="domain-exclusions-hint">{c.exclusionsHint}</p>
                  <p>{c.discoverCost}</p>
                  <button
                    className={s.primary}
                    disabled={
                      busy ||
                      !!request ||
                      !activeDiscoveries.data ||
                      !!activeDiscoveries.data.length ||
                      !activeBatches.data ||
                      !!activeBatches.data.length
                    }
                  >
                    {busy ? c.discovering : c.discover}
                  </button>
                </form>
                {activeDiscoveries.error && (
                  <DomainError
                    code={activeDiscoveries.error}
                    retry={activeDiscoveries.reload}
                  />
                )}
                {activeBatches.error && (
                  <DomainError
                    code={activeBatches.error}
                    retry={activeBatches.reload}
                  />
                )}
              </Surface>
            </>
          ) : (
            <>
              {discoveryResource.error && (
                <DomainError
                  code={discoveryResource.error}
                  retry={discoveryResource.reload}
                />
              )}
              {!discovery && !discoveryResource.error && (
                <Waiting allowed={true} />
              )}
              {discovery && (
                <>
                  <Surface
                    title={discovery.hostname}
                    action={<State value={discovery.status} />}
                  >
                    <p>{running ? c.durableDiscovery : c.scopeHint}</p>
                    <dl className={d.facts}>
                      <div>
                        <dt>{c.eligible}</dt>
                        <dd>{discovery.eligibleCount}</dd>
                      </div>
                      <div>
                        <dt>{c.excluded}</dt>
                        <dd>{discovery.excludedCount}</dd>
                      </div>
                      <div>
                        <dt>{c.expires}</dt>
                        <dd>{dateLabel(discovery.expiresAt, lang)}</dd>
                      </div>
                    </dl>
                    <p>
                      {phrase(c.limitText, {
                        urls: discovery.effectiveLimits.maxUrls,
                        depth: discovery.effectiveLimits.maxDepth,
                        seconds: discovery.effectiveLimits.durationSeconds,
                        requests: discovery.effectiveLimits.requestsPerHost,
                      })}
                    </p>
                    {discovery.truncated && (
                      <p className={d.notice}>{c.truncated}</p>
                    )}
                    {discovery.stopReason && (
                      <p>
                        {c.stopReason}: <Reason value={discovery.stopReason} />
                      </p>
                    )}
                    {running &&
                      (discovery.cancelRequested ? (
                        <p>{c.cancelRequested}</p>
                      ) : (
                        <button
                          className={s.secondary}
                          disabled={busy}
                          onClick={() => setDialog("cancel")}
                        >
                          {c.cancelDiscovery}
                        </button>
                      ))}
                    {expired && <p className={d.error}>{c.expired}</p>}
                  </Surface>
                  {!running && (
                    <Surface title={c.stepSelection}>
                      {discovered.error && (
                        <DomainError
                          code={discovered.error}
                          retry={discovered.reload}
                        />
                      )}
                      {profiles.error && (
                        <DomainError
                          code={profiles.error}
                          retry={profiles.reload}
                        />
                      )}
                      {!discovered.data && !discovered.error ? (
                        <Waiting allowed={true} />
                      ) : (
                        discovered.data && (
                          <>
                            {!eligible.length && (
                              <p className={d.notice}>
                                {c.discoveryEmpty} {c.discoveryEmptyHint}
                              </p>
                            )}
                            <div className={s.actions}>
                              <button
                                className={s.secondary}
                                disabled={busy || !!request || expired}
                                onClick={() =>
                                  change({
                                    selected: eligible
                                      .map((p) => p.pageId)
                                      .join(","),
                                  })
                                }
                              >
                                {c.selectAll}
                              </button>
                              <button
                                className={s.secondary}
                                disabled={busy || !!request || expired}
                                onClick={() => change({ selected: "" })}
                              >
                                {c.selectNone}
                              </button>
                            </div>
                            <ul className={d.selection}>
                              {discovered.data.items.map((page) => (
                                <li key={page.pageId}>
                                  <label className={d.check}>
                                    <input
                                      type="checkbox"
                                      checked={
                                        page.eligible &&
                                        selected.includes(page.pageId)
                                      }
                                      disabled={
                                        !page.eligible ||
                                        busy ||
                                        !!request ||
                                        expired
                                      }
                                      onChange={(event) =>
                                        change({
                                          selected: (event.target.checked
                                            ? [...selected, page.pageId]
                                            : selected.filter(
                                                (id) => id !== page.pageId,
                                              )
                                          ).join(","),
                                        })
                                      }
                                    />
                                    <span className={d.url}>
                                      {page.normalizedUrl}
                                    </span>
                                  </label>
                                  <p className={d.muted}>
                                    {c.source}: {page.source} · {c.depth}:{" "}
                                    {page.depth}
                                    {!page.eligible && (
                                      <>
                                        {" "}
                                        · {c.exclusionReason}:{" "}
                                        <Reason value={page.exclusionReason} />
                                      </>
                                    )}
                                  </p>
                                </li>
                              ))}
                            </ul>
                            <div className={d.form}>
                              <label>
                                {c.profile}
                                <select
                                  aria-label={c.profile}
                                  value={profile}
                                  onChange={(event) =>
                                    change({ profile: event.target.value })
                                  }
                                  disabled={busy || !!request || expired}
                                >
                                  {profiles.data?.items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.id} · v
                                      {item.snapshot.scoringVersion}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <p>{c.profileHint}</p>
                            </div>
                            <p className={d.notice}>
                              {phrase(c.selectedCount, {
                                count: selected.length,
                              })}{" "}
                              · {phrase(c.costText, { count: selected.length })}
                            </p>
                            <dl className={d.facts}>
                              <div>
                                <dt>{c.available}</dt>
                                <dd>
                                  {!session.usage || session.usageError
                                    ? c.quotaUnknown
                                    : available === null
                                      ? c.unlimited
                                      : available}
                                </dd>
                              </div>
                              <div>
                                <dt>{c.after}</dt>
                                <dd>
                                  {!session.usage || session.usageError
                                    ? "—"
                                    : available === null
                                      ? c.unlimited
                                      : Math.max(
                                          0,
                                          (available ?? 0) - selected.length,
                                        )}
                                </dd>
                              </div>
                            </dl>
                            {!sufficient && (
                              <p className={d.error}>
                                {!session.usage || session.usageError
                                  ? c.quotaUnknown
                                  : c.quotaInsufficient}{" "}
                                <Link className={d.link} href="/account/usage">
                                  {c.usage}
                                </Link>
                              </p>
                            )}
                            {selected.length > 0 &&
                              discovered.data &&
                              profiles.data &&
                              !selectionValid && (
                                <DomainError code="selection_ineligible" />
                              )}
                            <button
                              ref={launchButton}
                              className={s.primary}
                              disabled={
                                busy ||
                                !!request ||
                                expired ||
                                !selectionValid ||
                                !sufficient ||
                                !!activeBatches.data?.length
                              }
                              onClick={() => void confirmLaunch()}
                            >
                              {c.confirm}
                            </button>
                          </>
                        )
                      )}
                    </Surface>
                  )}
                  {!running && !request && (
                    <Link
                      className={d.link}
                      href={`/account/domains/new?hostname=${encodeURIComponent(discovery.hostname)}`}
                    >
                      {c.newDiscovery}
                    </Link>
                  )}
                </>
              )}
            </>
          )}
          {dialog && (
            <ConfirmDialog
              returnFocus={dialog === "launch" ? launchButton : undefined}
              title={dialog === "launch" ? c.confirmTitle : c.cancelTitle}
              busy={busy}
              onClose={() => setDialog(null)}
              label={dialog === "launch" ? c.launch : c.cancelDiscovery}
              onConfirm={() =>
                dialog === "cancel"
                  ? void cancel()
                  : void send({
                      kind: "batch",
                      key: crypto.randomUUID(),
                      body: {
                        discoveryId: discoveryId!,
                        selectedPageIds: selected,
                        profileId: profile,
                      },
                    })
              }
            >
              <p>{dialog === "launch" ? c.confirmHint : c.cancelHint}</p>
              {dialog === "launch" && (
                <>
                  <p>{discovery?.hostname}</p>
                  <p>{phrase(c.costText, { count: selected.length })}</p>
                  <p>
                    {c.available}:{" "}
                    {quota?.available === null ? c.unlimited : quota?.available}{" "}
                    · {c.after}:{" "}
                    {quota?.available === null
                      ? c.unlimited
                      : Math.max(0, (quota?.available ?? 0) - selected.length)}
                  </p>
                  <p>
                    {c.profile}: {profile}
                  </p>
                </>
              )}
              {error && <DomainError code={error} />}
            </ConfirmDialog>
          )}
        </>
      )}
    </main>
  );
}
