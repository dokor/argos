import SiteDocument, { frenchMetadata } from "@/components/site/SiteDocument";
export { viewport } from "@/components/site/SiteDocument";
export const metadata = frenchMetadata;
export default function FrenchLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument lang="fr">{children}</SiteDocument>;
}
