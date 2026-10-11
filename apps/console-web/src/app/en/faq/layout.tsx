import en from "@/lib/i18n/en.json";
import { localizedMetadata } from "@/lib/i18n/metadata";
export const metadata = localizedMetadata("/faq", "en", en.faq.meta.title, en.faq.meta.description);
const jsonLd = {
  "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "en",
  mainEntity: en.faq.categories.flatMap(category => category.items.map(item => ({
    "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a },
  }))),
};
export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />{children}</>;
}
