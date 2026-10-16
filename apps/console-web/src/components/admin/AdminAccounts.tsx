"use client";
import { inputHints } from "@/lib/input-hints";
import AdminNavigation from "./AdminNavigation";
import { quotaResetDate } from "@/lib/quota-date";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { adminQuery, safeAdminReturn } from "@/lib/admin-request";
import { useAccountSession } from "@/components/account/AccountSession";
import { useDomainResource } from "@/components/connected/domains/useDomainResource";
import {
  EmptyState,
  PageHeading,
  Surface,
  StatusBadge,
} from "@/components/connected/Primitives";
import type {
  AdminUser,
  AdminUsers,
  AdminEvents,
  AdminReason,
  AdminMutation,
  EntitlementOptions,
} from "@/lib/connected/contracts";
import { accountsCopy, type AccountsCopy } from "./accountsCopy";
import s from "@/components/connected/Connected.module.scss";
import a from "./AdminAccounts.module.scss";
const failure = (code: string, c: AccountsCopy) =>
  c.errors[code as keyof typeof c.errors] ?? c.errors.account_unavailable;
type Action = {
  kind: "entitlement" | "suspension";
  user: AdminUser;
  offer?: string;
  monthlyLimit?: number | null;
  suspended?: boolean;
};
export default function AdminAccounts({
  id,
  journal = false,
}: {
  id?: string;
  journal?: boolean;
}) {
  const { lang } = useLang(),
    c = accountsCopy[lang],
    session = useAccountSession(),
    params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const [blocked, setBlocked] = useState(false),
    [notice, setNotice] = useState(""),
    [action, setAction] = useState<Action | null>(null),
    [revision, setRevision] = useState(0);
  const allowed =
    session.ready &&
    session.profile?.admin &&
    session.profile.verified &&
    !session.denied &&
    !blocked;
  const query = adminQuery("admin/users", new URLSearchParams(params));
  const list = useDomainResource<AdminUsers>(
    allowed && !id && !journal && query ? "admin/users?" + query : null,
  );
  const user = useDomainResource<AdminUser>(
    allowed && id ? "admin/users/" + id : null,
  );
  const options = useDomainResource<EntitlementOptions>(
    allowed && !journal ? "admin/entitlement-options" : null,
  );
  const methods = useDomainResource<{ provider: string }[]>(
    allowed && id ? "methods" : null,
  );
  const data = user.data,
    resource = id ? user : list;
  const privateDenied =
    resource.error === "admin_required" || options.error === "admin_required";
  const returnTo =
    safeAdminReturn(params.get("returnTo")) ?? "/account/admin/users";
  const number = (v: number | null) =>
    v === null ? c.unlimited : new Intl.NumberFormat(lang).format(v);
  const date = (v: string) =>
    new Intl.DateTimeFormat(lang, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(v));
  useEffect(() => {
    window.dispatchEvent(new Event("argos-reading"));
  }, [params]);
  const refresh = () => {
    resource.reload();
    options.reload();
    methods.reload();
    setRevision((v) => v + 1);
  };
  const changed = async (result: AdminMutation) => {
    setAction(null);
    setNotice(result.changed ? c.saved : c.unchanged);
    refresh();
    session.refreshUsage();
  };
  const protectedUser = data && !data.canEditEntitlement;
  const unavailable =
    !!user.error ||
    user.loading ||
    !!options.error ||
    !options.data ||
    !methods.data;
  return (
    <main className={s.page}>
      <PageHeading
        title={c.title}
        description={id ? (data?.email ?? c.intro) : c.intro}
        action={
          allowed ? (
            <button className={s.secondary} onClick={refresh}>
              {c.refresh}
            </button>
          ) : undefined
        }
      />
      {!session.ready ? (
        <EmptyState title={c.loading} kind="loading" />
      ) : !allowed || privateDenied ? (
        <p role="alert" className={a.notice}>
          {c.denied}
        </p>
      ) : (
        <>
          <AdminNavigation active={journal ? "events" : "users"} />
          {notice && (
            <p className={a.notice} role="status">
              {notice}
            </p>
          )}
          {journal ? (
            <AdminJournal key={revision} />
          ) : id ? (
            <>
              <Link className={a.link} href={returnTo}>
                {c.back}
              </Link>
              {user.error && (
                <ErrorNotice code={user.error} stale={!!data} retry={refresh} />
              )}
              {options.error && (
                <ErrorNotice code={options.error} retry={options.reload} />
              )}
              {methods.error && (
                <ErrorNotice code={methods.error} retry={methods.reload} />
              )}
              {!data && !user.error ? (
                <EmptyState title={c.loading} kind="loading" />
              ) : (
                data && (
                  <>
                    <div className={a.columns}>
                      <Surface
                        title={data.displayName}
                        action={<State value={data.state} />}
                      >
                        <p className={a.meta}>
                          {data.email ?? "—"} · {c.states[data.role]} · #
                          {data.id}
                        </p>
                        <p className={a.meta}>
                          {c.created} {date(data.createdAt)}
                        </p>
                        {protectedUser ? (
                          <p className={a.notice}>{c.protected}</p>
                        ) : (
                          options.data && (
                            <EntitlementForm
                              key={data.version}
                              user={data}
                              options={options.data}
                              disabled={unavailable}
                              onReview={setAction}
                            />
                          )
                        )}
                      </Surface>
                      <Surface title={c.access}>
                        <dl className={a.metrics}>
                          {[
                            [c.used, number(data.usage.used)],
                            [c.reserved, number(data.usage.reserved)],
                            [c.available, number(data.usage.available)],
                            [c.limit, number(data.usage.limit)],
                            [
                              c.renewal,
                              quotaResetDate(data.usage.resetsAt, lang, data.usage.timezone),
                            ],
                          ].map(([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                        <h3 className={a.subtitle}>{c.state}</h3>
                        <p className={a.meta}>
                          {data.state === "SUSPENDED"
                            ? c.resumeHint
                            : c.suspendHint}
                        </p>
                        {!data.canSuspend && data.canEditEntitlement && (
                          <p className={a.notice}>{c.protected}</p>
                        )}
                        {data.canSuspend && (
                          <button
                            className={s.secondary}
                            disabled={unavailable}
                            onClick={() =>
                              setAction({
                                kind: "suspension",
                                user: data,
                                suspended: data.state !== "SUSPENDED",
                              })
                            }
                          >
                            {data.state === "SUSPENDED" ? c.resume : c.suspend}
                          </button>
                        )}
                      </Surface>
                    </div>
                    <AdminJournal key={revision} id={id} />
                  </>
                )
              )}
            </>
          ) : !query ? (
            <ErrorNotice code="filter_invalid" />
          ) : (
            <Surface title={c.users}>
              <form
                className={a.filters}
                key={params.toString()}
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = new URLSearchParams();
                  for (const [k, v] of new FormData(e.currentTarget))
                    if (typeof v === "string" && v.trim()) q.set(k, v.trim());
                  router.push(pathname + (q.size ? "?" + q : ""), {
                    scroll: false,
                  });
                }}
              >
                <label>
                  {c.search}
                  <input
                    name="q"
                    placeholder={inputHints[lang].searchAccount}
                    maxLength={100}
                    defaultValue={params.get("q") ?? ""}
                  />
                </label>
                <label>
                  {c.state}
                  <select name="state" defaultValue={params.get("state") ?? ""}>
                    <option value="">{c.all}</option>
                    {(
                      ["ACTIVE", "PENDING", "SUSPENDED", "ARCHIVED"] as const
                    ).map((v) => (
                      <option key={v} value={v}>
                        {c.states[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {c.offer}
                  <select name="offer" defaultValue={params.get("offer") ?? ""}>
                    <option value="">{c.all}</option>
                    {options.data?.offers.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <button className={s.secondary}>{c.apply}</button>
                {params.size > 0 && (
                  <Link className={s.secondary} href="/account/admin/users">
                    {c.reset}
                  </Link>
                )}
              </form>
              <p className={a.meta}>{c.scope}</p>
              {options.error && (
                <ErrorNotice code={options.error} retry={options.reload} />
              )}
              {list.error && (
                <ErrorNotice
                  code={list.error}
                  stale={!!list.data}
                  retry={list.reload}
                />
              )}
              {!list.data && !list.error ? (
                <EmptyState title={c.loading} kind="loading" />
              ) : (
                list.data && (
                  <>
                    {list.data.items.length ? (
                      <ul className={a.list}>
                        {list.data.items.map((row) => (
                          <li className={a.row} key={row.id}>
                            <div>
                              <h3>{row.displayName}</h3>
                              <p className={a.meta}>{row.email ?? "—"}</p>
                              <div className={a.inline}>
                                <State value={row.state} />
                                <span>
                                  {c.states[row.role]} · {row.offer}
                                </span>
                                <span>
                                  {c.used} {number(row.usage.used)} /{" "}
                                  {number(row.usage.limit)} · {c.reserved}{" "}
                                  {number(row.usage.reserved)}
                                </span>
                              </div>
                            </div>
                            <Link
                              className={s.secondary}
                              href={
                                "/account/admin/users/" +
                                row.id +
                                "?returnTo=" +
                                encodeURIComponent(
                                  pathname + (params.size ? "?" + params : ""),
                                )
                              }
                            >
                              {c.open}
                              <span className={a.sr}> {row.displayName}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p role="status" className={a.empty}>
                        {c.empty}
                      </p>
                    )}
                    <div className={a.pagination}>
                      {params.has("cursor") && (
                        <Link
                          className={s.secondary}
                          href={(() => {
                            const q = new URLSearchParams(params);
                            q.delete("cursor");
                            return "/account/admin/users?" + q;
                          })()}
                        >
                          {c.first}
                        </Link>
                      )}
                      {list.data.nextCursor && (
                        <Link
                          className={s.secondary}
                          href={(() => {
                            const q = new URLSearchParams(params);
                            q.set("cursor", list.data.nextCursor!);
                            return "/account/admin/users?" + q;
                          })()}
                        >
                          {c.next}
                        </Link>
                      )}
                    </div>
                  </>
                )
              )}
            </Surface>
          )}
          {action && options.data && (
            <AdminConfirmation
              action={action}
              options={options.data}
              hasPassword={
                !!methods.data?.some((m) => m.provider === "password")
              }
              hasEmail={!!session.profile?.email}
              onCancel={() => setAction(null)}
              onSaved={changed}
              onDenied={() => {
                setAction(null);
                setBlocked(true);
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
function State({ value }: { value: AdminUser["state"] }) {
  const { lang } = useLang();
  return (
    <StatusBadge
      tone={
        value === "ACTIVE"
          ? "success"
          : value === "SUSPENDED"
            ? "danger"
            : "warning"
      }
    >
      {accountsCopy[lang].states[value]}
    </StatusBadge>
  );
}
function ErrorNotice({
  code,
  stale = false,
  retry,
}: {
  code: string;
  stale?: boolean;
  retry?: () => void;
}) {
  const { lang } = useLang(),
    c = accountsCopy[lang];
  return (
    <div role="alert" className={a.notice}>
      <p>{stale ? c.stale : failure(code, c)}</p>
      {retry && (
        <button className={s.secondary} onClick={retry}>
          {c.retry}
        </button>
      )}
    </div>
  );
}
function EntitlementForm({
  user,
  options,
  disabled,
  onReview,
}: {
  user: AdminUser;
  options: EntitlementOptions;
  disabled: boolean;
  onReview: (a: Action) => void;
}) {
  const { lang } = useLang(),
    c = accountsCopy[lang];
  const [offer, setOffer] = useState(user.offer),
    [raw, setRaw] = useState(
      user.monthlyLimit === null ? "" : String(user.monthlyLimit),
    );
  const limit = raw === "" ? null : Number(raw),
    valid =
      limit === null ||
      (Number.isSafeInteger(limit) &&
        limit >= 0 &&
        limit <= options.maximumMonthlyLimit);
  const defaultLimit = options.offerLimits.find(
    (v) => v.offer === offer,
  )?.monthlyLimit;
  return (
    <form
      className={a.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !disabled)
          onReview({ kind: "entitlement", user, offer, monthlyLimit: limit });
      }}
    >
      <h3 className={a.subtitle}>{c.quota}</h3>
      <label>
        {c.offer}
        <select
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          disabled={disabled}
        >
          {options.offers.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <p className={a.meta}>
        {c.configured}:{" "}
        {defaultLimit === null ? c.unlimited : (defaultLimit ?? "—")}
      </p>
      <label>
        {c.override}
        <input
          type="number"
          min="0"
          max={options.maximumMonthlyLimit}
          step="1"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={disabled}
          aria-describedby="admin-limit-help"
        />
      </label>
      <p id="admin-limit-help" className={a.meta}>
        {c.inherit}
      </p>
      <p className={a.meta}>{c.effect}</p>
      <div>
        <button className={s.primary} disabled={disabled || !valid}>
          {c.edit}
        </button>
      </div>
    </form>
  );
}
function AdminJournal({ id }: { id?: string }) {
  const { lang } = useLang(),
    c = accountsCopy[lang];
  const [cursor, setCursor] = useState<string | null>(null);
  const data = useDomainResource<AdminEvents>(
    (id ? "admin/users/" + id + "/events" : "admin/events") +
      "?limit=10" +
      (cursor ? "&cursor=" + cursor : ""),
  );
  return (
    <Surface title={c.journal}>
      <p className={a.meta}>{c.retention}</p>
      <p className={a.meta}>{c.currentIdentity}</p>
      {data.error && (
        <ErrorNotice
          code={data.error}
          stale={!!data.data}
          retry={data.reload}
        />
      )}
      {!data.data && !data.error ? (
        <p role="status">{c.loading}</p>
      ) : (
        data.data && (
          <>
            {data.data.items.length ? (
              <ol className={a.list}>
                {data.data.items.map((e) => (
                  <li className={a.event} key={e.id}>
                    <strong>
                      {e.reasonCode ? c.reasons[e.reasonCode] : c.legacy}
                    </strong>
                    <p className={a.meta}>
                      {new Date(e.createdAt).toLocaleString(lang)} · {c.actor} : {" "}
                      <span title={"#" + e.actorId}>{e.actorDisplayName?.trim() || e.actorEmail?.trim() || `${c.unavailableAccount} · #${e.actorId}`}</span>
                      {" · "}{c.target} : {" "}
                      <span title={"#" + e.targetId}>{e.targetDisplayName?.trim() || e.targetEmail?.trim() || `${c.unavailableAccount} · #${e.targetId}`}</span>
                    </p>
                    <p>
                      {c.before}: {e.oldState ? c.states[e.oldState] : "—"} ·{" "}
                      {e.oldOffer} · {e.oldLimit ?? c.inherited}
                    </p>
                    <p>
                      {c.after}: {e.newState ? c.states[e.newState] : "—"} ·{" "}
                      {e.newOffer} · {e.newLimit ?? c.inherited}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={a.empty}>{c.emptyJournal}</p>
            )}
            <div className={a.pagination}>
              {cursor && (
                <button className={s.secondary} onClick={() => setCursor(null)}>
                  {c.first}
                </button>
              )}
              {data.data.nextCursor && (
                <button
                  className={s.secondary}
                  onClick={() => setCursor(data.data!.nextCursor)}
                >
                  {c.next}
                </button>
              )}
            </div>
          </>
        )
      )}
    </Surface>
  );
}
function AdminConfirmation({
  action,
  options,
  hasPassword,
  hasEmail,
  onCancel,
  onSaved,
  onDenied,
}: {
  action: Action;
  options: EntitlementOptions;
  hasPassword: boolean;
  hasEmail: boolean;
  onCancel: () => void;
  onSaved: (v: AdminMutation) => Promise<void>;
  onDenied: () => void;
}) {
  const { lang, t } = useLang(),
    c = accountsCopy[lang],
    dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(false),
    lock = useRef(false);
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [reauth, setReauth] = useState(false),
    [viaCode, setViaCode] = useState(!hasPassword),
    [credential, setCredential] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  useEffect(() => {
    alive.current = true;
    const trigger = document.activeElement as HTMLElement,
      el = dialog.current;
    el?.showModal();
    return () => {
      alive.current = false;
      el?.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  const conflict = ["version_conflict", "quota_below_committed"].includes(
    error,
  );
  async function work(sendCode = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (sendCode) {
        await accountFetch("auth/reauth", "POST", {});
        if (alive.current) setSent(true);
        return;
      }
      if (reauth) {
        await accountFetch(
          "auth/reauth",
          "POST",
          viaCode ? { code: credential } : { password: credential },
        );
        if (!alive.current) return;
        setCredential("");
      }
      const body = {
        expectedVersion: action.user.version,
        reasonCode: reason as AdminReason,
        confirmation: true,
        ...(action.kind === "entitlement"
          ? { offer: action.offer, monthlyLimit: action.monthlyLimit }
          : { suspended: action.suspended }),
      };
      const result = await accountFetch<AdminMutation>(
        "admin/users/" + action.user.id + "/" + action.kind,
        action.kind === "entitlement" ? "PATCH" : "POST",
        body,
      );
      if (alive.current) await onSaved(result);
    } catch (e) {
      if (!alive.current) return;
      const code =
        e instanceof AccountClientError ? e.code : "account_unavailable";
      if (code === "reauth_required") setReauth(true);
      else if (
        e instanceof AccountClientError &&
        (e.status === 401 || code === "admin_required")
      ) {
        onDenied();
        return;
      }
      setError(code);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={a.dialog}
      aria-labelledby="admin-confirm-title"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const fields = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = fields[0],
          last = fields[fields.length - 1];
        if (
          (e.shiftKey && document.activeElement === first) ||
          (!e.shiftKey && document.activeElement === last)
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!lock.current) onCancel();
      }}
    >
      <h2 id="admin-confirm-title">
        {action.kind === "entitlement"
          ? c.quota
          : action.suspended
            ? c.suspend
            : c.resume}
      </h2>
      <p>
        {action.user.displayName} · {action.user.email}
      </p>
      <div className={a.comparison}>
        <p>
          <strong>{c.before}</strong>
          {c.states[action.user.state]} · {action.user.offer} ·{" "}
          {action.user.monthlyLimit ?? c.inherited}
        </p>
        <p>
          <strong>{c.after}</strong>
          {action.kind === "entitlement"
            ? `${action.offer} · ${action.monthlyLimit ?? c.inherited}`
            : action.suspended
              ? c.states.SUSPENDED
              : c.resumeHint}
        </p>
      </div>
      <form
        className={a.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (reason && confirmed && !conflict) void work();
        }}
      >
        <label>
          {c.reason}
          <select
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          >
            <option value="">{c.choose}</option>
            {options.reasonCodes.map((v) => (
              <option key={v} value={v}>
                {c.reasons[v]}
              </option>
            ))}
          </select>
        </label>
        <label className={a.check}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={busy}
            required
          />
          {c.confirmation}
        </label>
        {reauth && (
          <>
            <p>{c.reauth}</p>
            <label>
              {viaCode ? c.code : c.password}
              <input
                type={viaCode ? "text" : "password"}
                autoComplete={viaCode ? "one-time-code" : "current-password"}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                maxLength={viaCode ? 43 : 256}
                required
                disabled={busy}
              />
            </label>
            {viaCode && (
              <button
                type="button"
                className={s.secondary}
                disabled={busy || !hasEmail}
                onClick={() => void work(true)}
              >
                {c.sendCode}
              </button>
            )}
            {hasPassword && hasEmail && (
              <button
                type="button"
                className={s.secondary}
                disabled={busy}
                onClick={() => {
                  setViaCode(!viaCode);
                  setCredential("");
                }}
              >
                {viaCode ? c.usePassword : c.useCode}
              </button>
            )}
            {sent && <p role="status">{c.sent}</p>}
          </>
        )}
        {error && (
          <p role="alert" className={a.notice}>
            {c.errors[error as keyof typeof c.errors] ??
              t.account.errors[error as keyof typeof t.account.errors] ??
              c.errors.account_unavailable}
          </p>
        )}
        <div className={s.actions}>
          <button
            type="button"
            className={s.secondary}
            disabled={busy}
            onClick={onCancel}
          >
            {c.cancel}
          </button>
          <button
            className={s.primary}
            disabled={
              busy ||
              !reason ||
              !confirmed ||
              conflict ||
              (reauth && !credential)
            }
          >
            {busy ? c.working : c.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
