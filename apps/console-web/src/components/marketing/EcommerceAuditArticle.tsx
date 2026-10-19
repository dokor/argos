import type { Metadata } from "next";
import JsonLd from "@/components/site/JsonLd";
import { editorialPages } from "@/lib/editorial";
import { ecommerceAuditCopy, ecommerceAuditRoute, ecommerceAuditSources } from "@/lib/ecommerceAuditGuide";
import { localizedMetadata, siteUrl } from "@/lib/i18n/metadata";
import { localizedPath, type Lang } from "@/lib/i18n/routes";
import EcommerceAuditGuide from "./EcommerceAuditGuide";

export function ecommerceAuditMetadata(lang: Lang): Metadata {
  const copy = ecommerceAuditCopy[lang];
  const base = localizedMetadata(ecommerceAuditRoute, lang, copy.metaTitle, copy.description);
  const record = editorialPages[ecommerceAuditRoute];
  return { ...base, openGraph: { ...base.openGraph, type: "article", publishedTime: record.firstVersion, modifiedTime: record.revised } };
}

export default function EcommerceAuditArticle({ lang }: { lang: Lang }) {
  const copy = ecommerceAuditCopy[lang];
  const record = editorialPages[ecommerceAuditRoute];
  const schema = {
    "@context": "https://schema.org", "@type": "Article",
    headline: copy.title, description: copy.description, inLanguage: lang,
    datePublished: record.firstVersion, dateModified: record.revised,
    author: { "@type": "Person", name: "Antoine Le Louët", url: siteUrl + localizedPath("/a-propos", lang) },
    mainEntityOfPage: siteUrl + localizedPath(ecommerceAuditRoute, lang),
    citation: ecommerceAuditSources.map(source => source.href),
  };
  return <><JsonLd data={schema} /><EcommerceAuditGuide /></>;
}
