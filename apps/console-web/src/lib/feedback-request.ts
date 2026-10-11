export const feedbackTypes = ["BUG", "SUGGESTION", "FALSE_POSITIVE"] as const;
export const feedbackStatuses = ["OPEN", "PENDING", "CONFIRMED", "REJECTED", "RESOLVED"] as const;
export type FeedbackReference = { reportToken?: string; runId?: string };
export function feedbackPayload(body: Record<string, unknown>): boolean {
  const keys = ["type", "description", "page", "expected", "observed", "steps", "reportToken", "runId", "findingKey", "website"];
  if (Object.keys(body).some(key => !keys.includes(key)) || !feedbackTypes.includes(body.type as typeof feedbackTypes[number])) return false;
  const text = (key: string, max: number, required = false) => body[key] === undefined ? !required : typeof body[key] === "string" && (body[key] as string).length <= max && (!required || !!(body[key] as string).trim()) && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(body[key] as string);
  if (!text("description", 4000, true) || !["expected", "observed", "steps"].every(key => text(key, 1000)) || !text("findingKey", 200)) return false;
  if (body.page !== undefined && !["PUBLIC", "ACCOUNT", "REPORT", "OTHER"].includes(body.page as string)) return false;
  if (body.website !== undefined && body.website !== "") return false;
  if (body.type !== "BUG" && ["expected", "observed", "steps"].some(key => body[key] !== undefined)) return false;
  if (body.reportToken !== undefined && (typeof body.reportToken !== "string" || !/^[A-Za-z0-9_-]{20,512}$/.test(body.reportToken) || body.runId !== undefined)) return false;
  if (body.runId !== undefined && (typeof body.runId !== "string" || !/^[1-9]\d{0,18}$/.test(body.runId) || BigInt(body.runId) > BigInt("9223372036854775807"))) return false;
  return body.type === "FALSE_POSITIVE" ? !!(body.findingKey as string)?.trim() && (body.reportToken !== undefined || body.runId !== undefined) : body.findingKey === undefined;
}
export function feedbackTreatment(body: Record<string, unknown>): boolean {
  return Object.keys(body).sort().join(",") === "expectedStatus,status" && [body.status, body.expectedStatus].every(value => feedbackStatuses.includes(value as typeof feedbackStatuses[number]));
}
