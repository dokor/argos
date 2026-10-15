/** Only bounded collector codes are rendered; never provider messages or raw payloads. */
const labels: Record<string, readonly [string, string]> = {
  "POLICY_DISABLED": [
    "Collecte désactivée par la politique Argos",
    "Collection disabled by Argos policy"
  ],
  "PROVIDER_RATE_LIMITED": [
    "Quota du fournisseur atteint",
    "Provider rate limit reached"
  ],
  "PROVIDER_AUTH_REQUIRED": [
    "Accès au fournisseur refusé",
    "Provider access denied"
  ],
  "PROVIDER_UNAVAILABLE": [
    "Fournisseur indisponible",
    "Provider unavailable"
  ],
  "INTEGRATION_ENDPOINT": [
    "Point de connexion du fournisseur indisponible",
    "Provider endpoint unavailable"
  ],
  "NETWORK_DNS": [
    "Résolution du fournisseur impossible",
    "Provider DNS resolution failed"
  ],
  "NETWORK_CONNECT": [
    "Connexion au fournisseur impossible",
    "Provider connection failed"
  ],
  "NETWORK_TLS": [
    "Connexion TLS au fournisseur impossible",
    "Provider TLS connection failed"
  ],
  "DEADLINE_EXCEEDED": [
    "Budget de collecte dépassé",
    "Collection deadline exceeded"
  ],
  "TARGET_ASSESSMENT_FAILED": [
    "Le fournisseur ne peut pas évaluer cette cible",
    "Provider could not assess this target"
  ],
  "INVALID_RESPONSE": [
    "Réponse du fournisseur inexploitable",
    "Invalid provider response"
  ],
  "INCOMPLETE_MEASUREMENTS": [
    "Mesures incomplètes",
    "Incomplete measurements"
  ],
  "INTEGRATION_FAILURE": [
    "Échec de collecte à diagnostiquer",
    "Collection failure requires diagnosis"
  ]
};
export function collectorReason(code: string, lang: "fr" | "en"): string | null {
  return Object.hasOwn(labels, code) ? labels[code][lang === "fr" ? 0 : 1] : null;
}
