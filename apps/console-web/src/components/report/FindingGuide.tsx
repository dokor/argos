import type { Issue } from './types';
import type { Lang } from '@/lib/i18n/routes';
import { findingPlaybook } from './findingPlaybooks';
import { findingContent } from './findingCatalogue';
import s from './FindingGuide.module.scss';

const copy = {
  fr: { detection: 'Comment Argos relève ce signal', correction: 'Comment corriger', expected: 'Comment vérifier la correction', example: 'Exemple fictif à adapter — ce code ne provient pas du site analysé', limits: 'Certitude et limites', reference: 'Documentation de référence', method: 'Référentiel des collecteurs actuels. La version exacte de cette règle n’est pas conservée dans la fiche ; un rapport historique peut utiliser une autre méthode.' },
  en: { detection: 'How Argos identifies this signal', correction: 'How to fix it', expected: 'How to verify the fix', example: 'Fictional example to adapt — this code does not come from the analysed site', limits: 'Certainty and limitations', reference: 'Reference documentation', method: 'Current collector reference. The exact version of this rule is not retained in the finding; a historical report may use another method.' },
};
/** Same editorial guidance in private/shared findings and the complete PDF. */
export default function FindingGuide({ issue, lang, heading = 3 }: { issue: Issue; lang: Lang; heading?: 3 | 5 }) {
  const p = findingPlaybook(issue.id, lang), c = copy[lang], content = findingContent(issue, lang);
  const Heading = heading === 5 ? 'h5' : 'h3';
  return <div className={s.guide} data-finding-guide>
    <section><Heading>{c.detection}</Heading><p>{p.detection}</p><p className={s.context}>{c.method}</p></section>
    <section><Heading>{c.correction}</Heading><p>{content.qualification}</p>
      <ol>{p.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {p.example && <figure><figcaption>{c.example}</figcaption><pre><code>{p.example}</code></pre></figure>}
    </section>
    <section><Heading>{c.expected}</Heading><p>{content.verification}</p></section>
    <section><Heading>{c.limits}</Heading><p>{p.limits}</p></section>
    {p.reference && <p><a href={p.reference} referrerPolicy="no-referrer">{c.reference} — {new URL(p.reference).hostname}</a> · {p.verifiedAt ?? '2026-10-16'}</p>}
  </div>;
}
