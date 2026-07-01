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
  info: (event: string, context?: LogContext) => void;
  warn: (event: string, context?: LogContext) => void;
};

const SENSITIVE_KEYWORDS = [
  "admin_token",
  "authorization",
  "cookie",
  "password",
  "resultjson",
];

function isLoggingEnabled(): boolean {
  const override = typeof window === "undefined"
    ? process.env.APP_LOGS_ENABLED ?? process.env.NEXT_PUBLIC_APP_LOGS_ENABLED
    : process.env.NEXT_PUBLIC_APP_LOGS_ENABLED;

  if (override === "true") return true;
  if (override === "false") return false;

  return process.env.NODE_ENV !== "test";
}

export function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[\r\n\t]/g, " ").slice(0, 200);
}

export function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(raw)
      ? raw
      : `https://${raw}`;
    const url = new URL(withScheme);
    return `${url.host}${url.pathname}`;
  } catch {
    const withoutQuery = raw.replace(/[?#].*$/, "");
    return sanitizeText(withoutQuery);
  }
}

export function maskToken(token: string | number | null | undefined): string | null {
  if (token === null || token === undefined) return null;

  const stringToken = String(token);
  if (stringToken.length <= 8) {
    return "****";
  }

  return `${stringToken.slice(0, 4)}…${stringToken.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "***";
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

export function safeError(error: unknown): LogDetails {
  if (error instanceof Error) {
    return {
      message: sanitizeText(error.message),
      name: error.name,
    };
  }

  if (typeof error === "string") {
    return { message: sanitizeText(error) };
  }

  return { message: "Unknown error" };
}

function redactScalar(key: string, value: unknown): unknown {
  const normalizedKey = key.toLowerCase();

  if (SENSITIVE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))) {
    return "[REDACTED]";
  }

  if (normalizedKey.includes("token")) {
    return maskToken(typeof value === "string" || typeof value === "number" ? value : null);
  }

  if (normalizedKey.includes("email")) {
    return maskEmail(typeof value === "string" ? value : null);
  }

  if (normalizedKey.includes("url")) {
    return sanitizeUrl(typeof value === "string" ? value : null);
  }

  if (typeof value === "string") {
    return sanitizeText(value);
  }

  return value;
}

function redactDetails(value: unknown, key = "", seen = new WeakSet<object>()): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return redactScalar(key, value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactDetails(item, key, seen));
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const redactedEntries = Object.entries(value).map(([entryKey, entryValue]) => [
    entryKey,
    redactDetails(redactScalar(entryKey, entryValue), entryKey, seen),
  ]);

  return Object.fromEntries(redactedEntries);
}

function mergeContexts(baseContext?: LogContext, context?: LogContext): LogContext | undefined {
  if (!baseContext && !context) return undefined;

  return {
    action: context?.action ?? baseContext?.action,
    details: {
      ...(baseContext?.details ?? {}),
      ...(context?.details ?? {}),
    },
    route: context?.route ?? baseContext?.route,
  };
}

function writeLog(level: LogLevel, surface: LoggerSurface, event: string, context?: LogContext): void {
  if (!isLoggingEnabled()) return;

  const payload = {
    action: context?.action,
    details: redactDetails(context?.details ?? {}),
    event,
    level,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    route: context?.route,
    surface,
    ts: new Date().toISOString(),
  };

  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  method("[argos-app]", payload);
}

export function createLogger(surface: LoggerSurface, baseContext?: LogContext): Logger {
  return {
    error: (event, context) => writeLog("error", surface, event, mergeContexts(baseContext, context)),
    info: (event, context) => writeLog("info", surface, event, mergeContexts(baseContext, context)),
    warn: (event, context) => writeLog("warn", surface, event, mergeContexts(baseContext, context)),
  };
}
