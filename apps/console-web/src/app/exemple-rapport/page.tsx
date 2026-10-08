import type { Metadata } from "next";
import ExampleReport from "@/components/marketing/ExampleReport";
const title = "Exemple de rapport Argos : preuves et corrections avant/après";
const description = "Un exemple pédagogique sur une page de démonstration contrôlée : constats HTML vérifiables, corrections avant/après et ordre de priorité.";
const url = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "")}/exemple-rapport`;
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: url },
  openGraph: { type: "article", url, title, description, images: ["/og.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};
export default function ExampleReportPage() { return <ExampleReport />; }
