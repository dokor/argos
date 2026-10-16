export const TRAFFIC_CONSENT = "argos_traffic_consent_v1";
export const TRAFFIC_VISIT = "argos_traffic_visit";
export function trafficEnabled(){return process.env.TRAFFIC_ANALYTICS_ENABLED === "true" && Boolean(process.env.ADMIN_API_TOKEN?.trim());}
export const trafficCookie = () => ({httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"strict" as const,path:"/"});
