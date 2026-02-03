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

const API_BASE = process.env.NEXT_PUBLIC_ARGOS_API_BASE;

if (!API_BASE) {
  // fail fast en dev
  console.warn("NEXT_PUBLIC_ARGOS_API_BASE is not set");
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
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

// import { HttpMethod } from 'simple-http-request-builder';
// import ApiHttpClient from "@/lib/api/ApiHttpClient";
//
// export type CreateAuditRequest = { url: string };
//
// export type CreateAuditResponse = {
//   auditId: number;
//   runId: number;
//   status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
// };
//
// export type RunStatusResponse = {
//   runId: number;
//   status: "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";
//   startedAt?: string | null;
//   finishedAt?: string | null;
//   lastError?: string | null;
// };

// const API_BASE = process.env.NEXT_PUBLIC_ARGOS_API_BASE;
//
// if (!API_BASE) {
//   // fail fast en dev
//   console.warn("NEXT_PUBLIC_ARGOS_API_BASE is not set");
// }
// /**
//  * A sample API that can be copied to call real API.
//  * After it has been copied, this file should be deleted :)
//  */
// export default class ArgosApi {
//   constructor(
//     private readonly httpClient: ApiHttpClient
//   ) {
//   }
//
//   // ask(query: { search: string, project: string}) {
//   //   return this
//   //     .httpClient
//   //     .rawRequest(HttpMethod.POST, `/ask`)
//   //     .options({
//   //       timeoutInMillis: 600000,
//   //     })
//   //     .jsonBody({ query })
//   //     .execute();
//   // }
//
//   //  http<RunStatusResponse>(`/audits/runs/${runId}`, { method: "GET" }),
//
//   getDocuments(query: { search: string, project: string}) {
//     return this
//       .httpClient
//       .restRequest<CreateAuditResponse>(HttpMethod.POST, `/audits`)
//       .jsonBody({ query })
//       .execute();
//   }
//
// }

