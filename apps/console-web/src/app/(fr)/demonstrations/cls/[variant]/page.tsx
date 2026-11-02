import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClsDemo from "@/components/guides/ClsDemo";

export const metadata: Metadata = {
  title: "Démonstration de décalage de mise en page",
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  alternates: { canonical: null },
};

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ variant: "avant" }, { variant: "apres" }];
}

export default async function ClsDemoPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (variant !== "avant" && variant !== "apres") notFound();
  return <ClsDemo key={variant} reserved={variant === "apres"} />;
}
