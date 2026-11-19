import Guide from "@/app/(fr)/guides/cls-eleve/page";
import { metadata } from "@/app/(fr)/guides/cls-eleve/page";
import { requestLanguage, requestMetadata } from "@/lib/i18n/server";
export async function generateMetadata() { return requestMetadata(metadata); }
export default async function Page() { return <Guide lang={await requestLanguage()} />; }
