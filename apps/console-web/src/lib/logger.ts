import {
  redactDetails,
  sanitizeText,
  sanitizeUrl,
  maskToken,
  maskEmail,
  safeError,
} from "@/lib/log-sanitize";

// Re-export sanitisers so existing callers don't need to change their import path.
export { sanitizeText, sanitizeUrl, maskToken, maskEmail, safeError };

// ─── Types ─────────────────────────────────────────────────────────────────

export type LoggerSurface =
  | "landing"
  | "dashboard"
  | "login"
  | "report"
  | "api"
  | "app";

export type LogLevel = "info" | "warn" | "error";

type LogDetails = Record<string, unknown>;

type LogContext = {
  action?: string;
  details?: LogDetails;
  route?: string;
};

type Logger = {
  error: (event: string, context?: LogContext) => void;
  info:  (event: string, context?: LogContext) => void;
  warn:  (event: string, context?: LogContext) => void;
};

// ─── Infrastructure ────────────────────────────────────────────────────────

function isLoggingEnabled(): boolean {
  const override =
    typeof window === "undefined"
      ? process.env.APP_LOGS_ENABLED ?? process.env.NEXT_PUBLIC_APP_LOGS_ENABLED
      : process.env.NEXT_PUBLIC_APP_LOGS_ENABLED;

  if (override === "true")  return true;
  if (override === "false") return false;

  return process.env.NODE_ENV !== "test";
}

function mergeContexts(base?: LogContext, ctx?: LogContext): LogContext | undefined {
  if (!base && !ctx) return undefined;
  return {
    action:  ctx?.action  ?? base?.action,
    details: { ...(base?.details ?? {}), ...(ctx?.details ?? {}) },
    route:   ctx?.route   ?? base?.route,
  };
}

function writeLog(
  level: LogLevel,
  surface: LoggerSurface,
  event: string,
  context?: LogContext,
): void {
  if (!isLoggingEnabled()) return;

  const payload = {
    action:  context?.action,
    details: redactDetails(context?.details ?? {}),
    event,
    level,
    path:    typeof window !== "undefined" ? window.location.pathname : undefined,
    route:   context?.route,
    surface,
    ts:      new Date().toISOString(),
  };

  const method =
    level === "error" ? console.error :
    level === "warn"  ? console.warn  :
                        console.info;
  method("[argos-app]", payload);
}

export function createLogger(surface: LoggerSurface, baseContext?: LogContext): Logger {
  return {
    error: (event, ctx) => writeLog("error", surface, event, mergeContexts(baseContext, ctx)),
    info:  (event, ctx) => writeLog("info",  surface, event, mergeContexts(baseContext, ctx)),
    warn:  (event, ctx) => writeLog("warn",  surface, event, mergeContexts(baseContext, ctx)),
  };
}
