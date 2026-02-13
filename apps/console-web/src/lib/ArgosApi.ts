import { Report } from "@/components/report/types";

export type CreateAuditRequest = {
  url: string;
};

export type CreateAuditResponse = {
  auditId: number;
  runId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  normalizedUrl: string;
};

export type AuditRunStatusResponse = {
  runId: number;
  auditId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  lastError?: string | null;
  resultJson?: string | null; // string JSON brut (comme en BDD)
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  reportToken?: string | null
};


export type AuditListItem = {
  auditId: number;
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

// todo : fix conf
const API_BASE: string | undefined = "https://console.argos.tld";

if (!API_BASE) {
  // fail fast en dev
  console.warn("NEXT_PUBLIC_ARGOS_API_BASE is not set");
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {

  const url: string =
    typeof window === "undefined"
      ? `${API_BASE}${path}` // SSR => URL absolue
      : path;               // Client => relative OK

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

  // Certains endpoints peuvent répondre 204
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

export const argosApi = {
  createAudit: (body: CreateAuditRequest): Promise<CreateAuditResponse> =>
    http<CreateAuditResponse>("/api/audits", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getList: (): Promise<AuditListItem[]> =>
    http<AuditListItem[]>("/api/audits", { method: "GET" }),

  getReport: (token: string): Promise<Report> =>
    http<Report>(`/api/reports/${token}`, { method: "GET" }),

  getRunsByRunId: (runId: number): Promise<AuditRunStatusResponse> =>
    http<AuditRunStatusResponse>(`/api/audits/runs/${runId}`, { method: "GET" })
};


