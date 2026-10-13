export function validIntroduction(value: Record<string, unknown>): boolean {
  if (Object.keys(value).some(k => !["author", "context", "findingKeys", "nextStep"].includes(k))) return false;
  for (const [key, max] of [["author", 120], ["context", 1200], ["nextStep", 500]] as const) {
    const text = value[key];
    if (typeof text !== "string" || !text.trim() || text.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)) return false;
  }
  const keys = value.findingKeys;
  return Array.isArray(keys) && keys.length >= 2 && keys.length <= 3 && new Set(keys).size === keys.length
    && keys.every(k => typeof k === "string" && k.length <= 200 && /^[a-zA-Z0-9_.-]+$/.test(k));
}
