import type { ReactNode } from "react";
import Link from "@/components/PageLink";
import EditorialMeta from "@/components/marketing/EditorialMeta";
import JsonLd from "@/components/site/JsonLd";
import { editorialPages } from "@/lib/editorial";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import s from "./GuideArticle.module.scss";

export type GuideLink = { href: string; label: string };
export type GuideDetails = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  readingMinutes: number;
  sources: readonly GuideLink[];
};

export default function GuideArticle({ guide, contents, related, children }: {
  guide: GuideDetails;
  contents: readonly { id: string; label: string }[];
  related: readonly GuideLink[];
  children: ReactNode;
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
  const route = `/guides/${guide.slug}`;
  const url = siteUrl + route;
  const record = editorialPages[route];
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      inLanguage: "fr-FR",
      datePublished: record.firstVersion,
      dateModified: record.revised,
      mainEntityOfPage: url,
      image: `${siteUrl}/og.png`,
      author: { "@type": "Person", name: "Antoine LE LOUËT", url: `${siteUrl}/a-propos` },
      publisher: { "@type": "Organization", name: "Argos", url: siteUrl },
      citation: guide.sources.map((source) => source.href),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Argos", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Ressources", item: `${siteUrl}/ressources` },
        { "@type": "ListItem", position: 3, name: guide.title, item: url },
      ],
    },
  ];

  return (
    <div className={s.page} lang="fr">
      <a className={s.skipLink} href="#guide-contenu">Aller au guide</a>
      <SiteNav />
      <main id="guide-contenu">
        <article>
          <header className={s.hero}>
            <div className={s.container}>
              <nav className={s.breadcrumb} aria-label="Fil d’Ariane">
                <Link href="/">Argos</Link><span aria-hidden="true">/</span>
                <Link href="/ressources">Ressources</Link>
              </nav>
              <p className={s.eyebrow}>{guide.eyebrow}</p>
              <h1>{guide.title}</h1>
              <p className={s.lead}>{guide.description}</p>
              <EditorialMeta route={route} />
            </div>
          </header>
          <div className={s.container}>
            <nav className={s.contents} aria-label="Sommaire du guide">
              <h2>Dans ce guide</h2>
              <ol>{contents.map((item) => <li key={item.id}><a href={`#${item.id}`}>{item.label}</a></li>)}</ol>
            </nav>
            <div className={s.body}>{children}</div>
            <section className={s.sources} id="references" aria-labelledby="references-title">
              <h2 id="references-title">Références officielles</h2>
              <p>Sources consultées le 2 novembre 2026. Les interfaces et les règles des services peuvent évoluer.</p>
              <ul>{guide.sources.map((source) => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul>
            </section>
            <aside className={s.related} aria-labelledby="related-title">
              <h2 id="related-title">Poursuivre le diagnostic</h2>
              <ul>{related.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
            </aside>
            <section className={s.cta} aria-labelledby="audit-title">
              <h2 id="audit-title">Vérifier votre page avec Argos</h2>
              <p>Lancez un audit gratuit d’une URL publique et examinez les preuves disponibles. Les contrôles automatiques complètent les vérifications de ce guide.</p>
              <Link href="/#audit" className={s.button}>Analyser une page gratuitement <span aria-hidden="true">→</span></Link>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
      <JsonLd data={structuredData} />
    </div>
  );
}
