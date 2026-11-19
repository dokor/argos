import Guide from "@/app/(fr)/guides/refonte-site-web/page";
import { metadata } from "@/app/(fr)/guides/refonte-site-web/page";
import { requestLanguage, requestMetadata } from "@/lib/i18n/server";
export async function generateMetadata() { return requestMetadata(metadata); }
export default async function Page() { return <Guide lang={await requestLanguage()} />; }
