import fr from "@/lib/i18n/fr.json";
import { localizedMetadata } from "@/lib/i18n/metadata";
export const metadata = localizedMetadata("/faq", "fr", fr.faq.meta.title, fr.faq.meta.description);
const jsonLd = {
  "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "fr",
  mainEntity: fr.faq.categories.flatMap(category => category.items.map(item => ({
    "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a },
  }))),
};
export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />{children}</>;
}
