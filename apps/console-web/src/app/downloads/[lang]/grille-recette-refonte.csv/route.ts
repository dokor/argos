import { readFile } from "node:fs/promises";
import path from "node:path";
import { isLang } from "@/lib/i18n/locales";
import { loadMessages } from "@/lib/i18n/server";
import { translateText } from "@/lib/i18n/messages";

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) return new Response(null, { status: 404 });
  await loadMessages(lang);
  const source = await readFile(path.join(process.cwd(), "public/downloads/grille-recette-refonte.csv"), "utf8");
  const csv = source.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/).map(row => row.split(";").map(cell => {
    const translated = translateText(cell, lang);
    return /[;"\r\n]/.test(translated) ? `"${translated.replaceAll('"', '""')}"` : translated;
  }).join(";")).join("\r\n");
  return new Response("\uFEFF" + csv + "\r\n", { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="website-redesign-checklist-${lang}.csv"`,
    "Content-Language": lang,
    "X-Content-Type-Options": "nosniff",
  } });
}
