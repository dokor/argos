import { ERROR_CODE_VALUES, type ApiError, type ErrorCode, type ErrorDetails } from "./contracts";

const codes = new Set<string>(ERROR_CODE_VALUES);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

/** One adaptation boundary for existing account errors and the new typed envelope. */
export function connectedError(payload: unknown, status: number): ApiError {
  const error = object(payload) ? payload.error : null;
  const raw = typeof error === "string" ? error : object(error) ? error.code : null;
  const candidate = typeof raw === "string" ? raw.toUpperCase() : "";
  const fallback: ErrorCode = status === 401 ? "SESSION_INVALID" : status === 403 ? "FORBIDDEN"
    : status === 404 ? "RESOURCE_UNAVAILABLE" : status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE";
  const code = codes.has(candidate) ? candidate as ErrorCode : fallback;
  const requestId = object(error) && typeof error.requestId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(error.requestId)
    ? error.requestId : null;
  let details: ErrorDetails | null = null;
  if (object(error) && object(error.details)) {
    details = { required: count(error.details.required), available: count(error.details.available), currentVersion: count(error.details.currentVersion) };
  }
  return { code, requestId, details };
}
