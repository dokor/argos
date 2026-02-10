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
};


export type AuditListItem = {
  auditId: number;
  inputUrl: string;
  normalizedUrl: string;
  runId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  createdAt?: string;
  finishedAt?: string | null;
  resultJson?: string | null;
};

// todo : fix conf
const API_BASE: string | undefined = process.env.NEXT_PUBLIC_ARGOS_API_BASE ?? "";

if (!API_BASE) {
  // fail fast en dev
  console.warn("NEXT_PUBLIC_ARGOS_API_BASE is not set");
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  // Certains endpoints peuvent répondre 204
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}
//
// export const argosApi = {
//   createAudit: (body: CreateAuditRequest) =>
//     http<CreateAuditResponse>("/audits", {
//       method: "POST",
//       body: JSON.stringify(body),
//     }),
//
//   getRunStatus: (runId: string | undefined) =>
//     http<RunStatusResponse>(`/audits/runs/${runId}`, { method: "GET" }),
// };


