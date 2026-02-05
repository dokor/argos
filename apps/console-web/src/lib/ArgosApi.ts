export type CreateAuditRequest = { url: string };

export type CreateAuditResponse = {
  auditId: number;
  runId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
};

export type RunStatusResponse = {
  runId: number;
  status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
  startedAt?: string | null;
  finishedAt?: string | null;
  lastError?: string | null;
};

// todo : fix conf
const API_BASE: string | undefined = process.env.NEXT_PUBLIC_ARGOS_API_BASE;

if (!API_BASE) {
  // fail fast en dev
  console.warn("NEXT_PUBLIC_ARGOS_API_BASE is not set");
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const argosApi = {
  createAudit: (body: CreateAuditRequest) =>
    http<CreateAuditResponse>("/audits", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getRunStatus: (runId: number | undefined) =>
    http<RunStatusResponse>(`/audits/runs/${runId}`, { method: "GET" }),
};


