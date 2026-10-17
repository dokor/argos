import type { Issue } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { findingExplanation } from './findingExplanation';
import { findingContent } from './findingCatalogue';
import s from './FindingGuide.module.scss';

const copy = {
  fr: { detection: 'Comment Argos relève ce signal', correction: 'Comment corriger', expected: 'Comment vérifier la correction', example: 'Exemple fictif à adapter — ce code ne provient pas du site analysé', limits: 'Certitude et limites', reference: 'Documentation de référence' },
  en: { detection: 'How Argos identifies this signal', correction: 'How to fix it', expected: 'How to verify the fix', example: 'Fictional example to adapt — this code does not come from the analysed site', limits: 'Certainty and limitations', reference: 'Reference documentation' },
};
type GuidePart = 'detection' | 'correction' | 'verification' | 'limits' | 'reference';
const allParts: GuidePart[] = ['detection', 'correction', 'verification', 'limits', 'reference'];

/** Reuse the same sections in the question disclosures and the complete PDF. */
export default function FindingGuide({ issue, lang, heading = 3, parts = allParts, showHeadings = true }: {
  issue: Issue; lang: Lang; heading?: 3 | 4 | 5; parts?: GuidePart[]; showHeadings?: boolean;
}) {
  const p = findingExplanation(issue, lang), c = copy[lang], content = findingContent(issue, lang);
  const Heading = heading === 5 ? 'h5' : heading === 4 ? 'h4' : 'h3';
  return <div className={s.guide} data-finding-guide>
    {parts.map(part => {
      if (part === 'reference') return p.reference && <p key={part} data-finding-guide-section={part} data-finding-guide-content>
        <a href={p.reference} referrerPolicy="no-referrer">{c.reference} — {new URL(p.reference).hostname}</a> · {p.verifiedAt ?? '2026-10-16'}
      </p>;
      const title = part === 'verification' ? c.expected : c[part];
      return <section key={part} data-finding-guide-section={part}>
        {showHeadings && <Heading>{title}</Heading>}
        <div data-finding-guide-content>
          {part === 'detection' && <><p>{p.detection}</p><p className={s.context}>{p.methodNote}</p></>}
          {part === 'correction' && <><p>{content.qualification}</p>
            <ol>{p.steps.map(step => <li key={step}>{step}</li>)}</ol>
            {p.example && <figure><figcaption>{c.example}</figcaption><pre><code>{p.example}</code></pre></figure>}
          </>}
          {part === 'verification' && <p>{content.verification}</p>}
          {part === 'limits' && <p>{p.limits}</p>}
        </div>
      </section>;
    })}
  </div>;
}
