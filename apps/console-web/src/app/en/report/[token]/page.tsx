import { requestMetadata } from "@/lib/i18n/server";
export { default } from "@/app/(fr)/report/[token]/page";
export async function generateMetadata() { return requestMetadata({
  title: "Argos report", robots: { index: false, follow: false },
  alternates: { canonical: null, languages: {} },
}); }
