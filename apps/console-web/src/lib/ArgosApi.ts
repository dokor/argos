import { Report } from "@/components/report/types";
import { createLogger, safeError } from "@/lib/logger";
import { accountAuditHeaders } from "@/lib/account-client";

/**
 * Erreur HTTP portant le code de statut, pour permettre aux appelants de
 * distinguer un 404 (ressource introuvable) d'une autre erreur (backend
 * indisponible, 5xx…). Le `message` reste identique à l'ancien format
 * (`HTTP <status> <statusText> - <body>`) pour la rétro-compatibilité.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, statusText: string, body: string) {
    super(`HTTP ${status} ${statusText} - ${body}`);
    this.name = "ApiError";
    this.status = status;
    try { this.code = JSON.parse(body).error ?? null; } catch { this.code = null; }
  }
}

export type CreateAuditRequest = {
  url: string;
  /** Route fixe, attribuée uniquement avec consentement validé côté BFF. */
  sourceRoute?: string;
  lang?: "fr" | "en";
};

export type CreateAuditResponse = {
  auditId: string | number;
  runId: string | number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  normalizedUrl?: string;
  /** Token pré-généré : la page /report/{reportToken} est accessible immédiatement. */
  reportToken?: string | null;
};

export type ModuleStatus = {
  id: string;
  label: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
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
  /** JSON string contenant un tableau de ModuleStatus. */
  moduleStatuses?: string | null;
};

export type PublicReportStatusResponse = Pick<AuditRunStatusResponse, "status" | "createdAt" | "startedAt" | "finishedAt" | "moduleStatuses">;

export type AuditHistoryItem = {
  calculation?: import("@/components/report/types").Report["scores"]["calculation"];
  coverage?: import("@/components/report/types").Coverage | null;
  comparison?: {
    reason: "COMPARABLE" | "NO_PREVIOUS_REPORT" | "EVIDENCE_MISSING" | "SCOPE_CHANGED" | "METHODOLOGY_CHANGED" | "COVERAGE_CHANGED" | "INSUFFICIENT_COVERAGE" | "SCORE_UNAVAILABLE";
    globalDelta?: number | null;
    domains: Array<{ domain: string; points: number }>;
    contributions: Array<{ key: string; module: string; domain: string; domainPoints: number; globalPoints: number }>;
    coverageChanged: boolean;
  } | null;
  runId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  createdAt?: string;
  finishedAt?: string | null;
  reportUrl?: string | null;
  /** Score global 0..100 issu du rapport publié, ou null si indisponible. */
  globalScore?: number | null;
};

// API_BASE is only used server-side (SSR); client calls use relative paths proxied by next.config.ts
const API_BASE: string = process.env.API_BASE ?? "http://api-backend:8081";
const apiLogger = createLogger("app", { route: "api-client" });

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url: string =
    typeof window === "undefined"
      ? `${API_BASE}${path}` // SSR => absolute URL
      : path;               // Client => relative, proxied via next.config.ts rewrites

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    apiLogger.error("api_client_request_failed", {
      action: init?.method ?? "GET",
      route: path,
      details: {
        error: safeError(error),
      },
    });
    throw error;
  }

  if (!res.ok) {
    const text: string = await res.text().catch(() => "");
    apiLogger.warn("api_client_response_error", {
      action: init?.method ?? "GET",
      route: path,
      details: {
        responseBody: text,
        statusCode: res.status,
        statusText: res.statusText,
      },
    });
    throw new ApiError(res.status, res.statusText, text);
  }

  // Some endpoints may respond 204 No Content
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

export const argosApi = {
  createAudit: async (body: CreateAuditRequest, captcha?: string): Promise<CreateAuditResponse> =>
    http<CreateAuditResponse>("/api/audits", {
      method: "POST",
      headers: { ...(typeof window === "undefined" ? {} : await accountAuditHeaders()), ...(captcha ? {"X-Argos-Captcha":captcha} : {}) },
      body: JSON.stringify(body),
    }),

  getReport: (token: string): Promise<Report> =>
    http<Report>(`/api/reports/${token}`, { method: "GET" }),

  /** Statut d'un run via son reportToken - disponible avant publication du rapport. */
  getReportStatus: (token: string): Promise<PublicReportStatusResponse> =>
    http<PublicReportStatusResponse>(`/api/reports/${token}/status`, { method: "GET" }),

};
