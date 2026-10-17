export type UsageGranularity = "DAY" | "MONTH" | "YEAR";
export type UsageDimension = "GLOBAL" | "DOMAIN" | "URL";
export type UsageSeries = { key: string; label: string | null; total: number };
export type UsageBucket = { from: string; until: string; total: number; values: Record<string, number> };
export type UsageTimeline = {
  timezone: string; snapshotAt: string; coverageFrom: string | null; undatedCredits: number;
  granularity: UsageGranularity; dimension: UsageDimension; total: number;
  series: UsageSeries[]; buckets: UsageBucket[]; options: UsageSeries[]; moreOptions: boolean;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1970-01-01" &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Validate the BFF allowlist before any private request is forwarded. The backend checks the quota-zone clock. */
export function usageTimelineQuery(params: URLSearchParams): URLSearchParams | null {
  if ([...params.keys()].some(key => !["granularity", "dimension", "from", "until", "filter", "q"].includes(key) || key !== "filter" && params.getAll(key).length !== 1)) return null;
  const granularity = params.get("granularity") ?? "DAY", dimension = params.get("dimension") ?? "GLOBAL";
  const from = params.get("from") ?? "", until = params.get("until") ?? "", filters = params.getAll("filter"), search = params.get("q") ?? "";
  if (!["DAY", "MONTH", "YEAR"].includes(granularity) || !["GLOBAL", "DOMAIN", "URL"].includes(dimension) || !validDate(from) || !validDate(until) || from >= until) return null;
  const start = new Date(from), end = new Date(until);
  const count = granularity === "DAY" ? (end.getTime() - start.getTime()) / 86400000 : granularity === "MONTH" ? (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() : end.getUTCFullYear() - start.getUTCFullYear();
  if (count > ({ DAY: 366, MONTH: 60, YEAR: 20 }[granularity] ?? 0) || granularity !== "DAY" && (start.getUTCDate() !== 1 || end.getUTCDate() !== 1) || granularity === "YEAR" && (start.getUTCMonth() !== 0 || end.getUTCMonth() !== 0)) return null;
  if (filters.length > 20 || new Set(filters).size !== filters.length || filters.some(value => value !== "unknown" && (!/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > BigInt("9223372036854775807")))) return null;
  if (search.length > 200 || /[\u0000-\u001f\u007f-\u009f]/.test(search) || dimension === "GLOBAL" && (filters.length || search.trim())) return null;
  return new URLSearchParams(params);
}

/** Calendar-only labels and controls; debit instants are bucketed on the server in the quota timezone. */
export function timelinePreset(granularity: UsageGranularity, count: number, today: string) {
  const current = new Date(today + "T00:00:00Z");
  if (granularity !== "DAY") current.setUTCDate(1);
  if (granularity === "YEAR") current.setUTCMonth(0);
  const start = new Date(current), end = new Date(current);
  if (granularity === "DAY") { start.setUTCDate(start.getUTCDate() - count + 1); end.setUTCDate(end.getUTCDate() + 1); }
  if (granularity === "MONTH") { start.setUTCMonth(start.getUTCMonth() - count + 1); end.setUTCMonth(end.getUTCMonth() + 1); }
  if (granularity === "YEAR") { start.setUTCFullYear(start.getUTCFullYear() - count + 1); end.setUTCFullYear(end.getUTCFullYear() + 1); }
  return { from: start.toISOString().slice(0, 10), until: end.toISOString().slice(0, 10) };
}

export function quotaToday(timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
