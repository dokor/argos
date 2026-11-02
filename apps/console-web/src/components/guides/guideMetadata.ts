import type { Metadata } from "next";
import type { GuideDetails } from "./GuideArticle";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { editorialPages } from "@/lib/editorial";

export function guideMetadata(guide: GuideDetails): Metadata {
  const route = `/guides/${guide.slug}`;
  const metadata = localizedMetadata(route, "fr", guide.title, guide.description);
  const record = editorialPages[route];
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, type: "article", publishedTime: record.firstVersion, modifiedTime: record.revised },
  };
}
