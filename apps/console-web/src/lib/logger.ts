/**
 * Logger applicatif structuré (client + serveur).
 *
 * Émet des logs JSON sur la console, activables via variables d'environnement :
 * - client  : NEXT_PUBLIC_APP_LOGS_ENABLED
 * - serveur : APP_LOGS_ENABLED
 *
 * Les helpers `maskToken` / `sanitizeUrl` / `safeError` garantissent qu'aucun
 * secret brut ni URL non assainie ne se retrouve dans les logs
 * (cf. AGENTS.md § Sécurité).
 */

type LogLevel = "info" | "warn" | "error";

/** Contexte de base attaché à toutes les entrées d'un logger. */
export type LoggerContext = {
  route?: string;
  details?: Record<string, unknown>;
};

/** Charge d'une entrée de log ponctuelle. */
export type LogPayload = {
  action?: string;
  route?: string;
  details?: Record<string, unknown>;
};

export type AppLogger = {
  info: (event: string, payload?: LogPayload) => void;
  warn: (event: string, payload?: LogPayload) => void;
  error: (event: string, payload?: LogPayload) => void;
};

function loggingEnabled(): boolean {
  // typeof window === "undefined" => contexte serveur (SSR / route handlers)
  if (typeof window === "undefined") {
    return process.env.APP_LOGS_ENABLED === "true";
  }
  return process.env.NEXT_PUBLIC_APP_LOGS_ENABLED === "true";
}

function emit(level: LogLevel, scope: string, base: LoggerContext, event: string, payload?: LogPayload): void {
  if (!loggingEnabled()) return;

  const entry = {
    level,
    scope,
    event,
    route: payload?.route ?? base.route,
    action: payload?.action,
    details: { ...base.details, ...payload?.details },
    ts: new Date().toISOString(),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/**
 * Crée un logger scoping toutes ses entrées avec `scope` et un contexte de base.
 */
export function createLogger(scope: string, base: LoggerContext = {}): AppLogger {
  return {
    info: (event, payload) => emit("info", scope, base, event, payload),
    warn: (event, payload) => emit("warn", scope, base, event, payload),
    error: (event, payload) => emit("error", scope, base, event, payload),
  };
}

/**
 * Masque un token/secret pour l'affichage en log : ne conserve que les 4
 * premiers caractères. Ne jamais logger un token brut.
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "null";
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…`;
}

/**
 * Assainit une URL pour le log : retire query string et fragment (qui peuvent
 * contenir des données sensibles), strip les CRLF (log injection) et tronque.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "";
  const stripped = url.replace(/[\r\n]/g, "").slice(0, 200);
  try {
    const u = new URL(stripped);
    return `${u.origin}${u.pathname}`;
  } catch {
    // URL invalide : renvoie la version nettoyée sans query/hash
    return stripped.split(/[?#]/)[0];
  }
}

/**
 * Transforme une erreur inconnue en objet sérialisable et sûr (sans stack trace)
 * pour l'inclure dans les logs.
 */
export function safeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: "UnknownError", message: String(err) };
}