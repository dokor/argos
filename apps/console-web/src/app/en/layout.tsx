import SiteDocument from "@/components/site/SiteDocument";
import { localizedMetadata, siteUrl } from "@/lib/i18n/metadata";
import en from "@/lib/i18n/en.json";
export { viewport } from "@/components/site/SiteDocument";
export const metadata = {
  ...localizedMetadata("/", "en", en.layout.title, en.layout.description),
  metadataBase: new URL(siteUrl),
  title: { default: en.layout.title, template: "%s | Argos" },
  keywords: ["website audit", "SEO", "HTTP security", "web performance", "Lighthouse", "free website report"],
};
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
