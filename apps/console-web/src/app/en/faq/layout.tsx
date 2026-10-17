import JsonLd from "@/components/site/JsonLd";
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
  return <><JsonLd data={jsonLd} />{children}</>;
}
