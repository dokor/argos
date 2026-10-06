import type { Metadata } from "next";
import AudiencePage from "@/components/marketing/AudiencePage";
import fr from "@/lib/i18n/fr.json";

const url = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/$/, "")}/audit-site-ecommerce`;
const { title, description } = fr.marketing.ecommerce.meta;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { type: "website", url, title, description, images: ["/og.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

export default function EcommercePage() {
  return <AudiencePage audience="ecommerce" />;
}
