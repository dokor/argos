import { Report } from "@/components/report/types";

export type CreateAuditRequest = {
  url: string;
};

export type CreateAuditResponse = {
  auditId: string | number;
  runId: string | number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  normalizedUrl?: string;
};

export type AuditRunStatusResponse = {
  runId: string | number;
  auditId: string | number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  lastError?: string | null;
  resultJson?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  reportToken?: string | null;
};

export type AuditListItem = {
  auditId: number;
  hostname?: string;
  inputUrl: string;
  normalizedUrl: string;
  runId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  createdAt?: string;
  finishedAt?: string | null;
  reportToken?: string | null;
  reportUrl?: string | null;
  resultJson?: string | null;
};

// API_BASE is only used server-side (SSR); client calls use relative paths proxied by next.config.ts
const API_BASE: string = process.env.API_BASE ?? "http://api-backend:8081";

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url: string =
    typeof window === "undefined"
      ? `${API_BASE}${path}` // SSR => absolute URL
      : path;               // Client => relative, proxied via next.config.ts rewrites

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text: string = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  // Some endpoints may respond 204 No Content
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

const limit = 100;

export const argosApi = {
  createAudit: (body: CreateAuditRequest): Promise<CreateAuditResponse> =>
    http<CreateAuditResponse>("/api/audits", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getList: (): Promise<AuditListItem[]> =>
    http<AuditListItem[]>(`/api/audits?limit=${limit}`, { method: "GET" }),

  getReport: (token: string): Promise<Report> =>
    http<Report>(`/api/reports/${token}`, { method: "GET" }),

  getRunsByRunId: (runId: string | number): Promise<AuditRunStatusResponse> =>
    http<AuditRunStatusResponse>(`/api/audits/runs/${runId}`, { method: "GET" }),
};
