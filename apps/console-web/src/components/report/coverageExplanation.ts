import type { Coverage } from './types';

export const coverageCopy = {
  fr: {
    title: 'Détail de la couverture', measured: 'mesurés', missing: 'non couverts', weight: 'Poids', points: 'points de couverture',
    owner: 'Module propriétaire', source: 'Source réelle', unknown: 'Non conservée', partial: 'Mesure partielle', excluded: 'Exclu du dénominateur',
    empty: 'Tous les contrôles attendus sont mesurés. La couverture ne garantit pas la qualité du site.',
    unavailable: 'Détail indisponible pour cette analyse.',
    historical: 'Valeurs figées dans ce rapport ; aucun recalcul avec le barème actuel. Les contributions sont arrondies séparément.',
    mismatch: 'Le détail conservé ne reconstitue pas entièrement le total enregistré. Aucun contrôle manquant ne peut être inventé.',
    retry: 'Relancer l’analyse si le service ou la page redevient disponible.',
    blocked: 'Vérifier les modalités d’un audit autorisé avec le propriétaire du site, puis réessayer.',
    inspect: 'Non mesurable dans les conditions actuelles. Faire vérifier la collecte par l’opérateur Argos.',
    partialAction: 'Certains points de terminaison TLS seulement ont été mesurés ; confirmer les autres avant de conclure.',
    reasons: {
      CHECK_MISSING: 'Le module n’a pas produit ce contrôle attendu.', MODULE_MISSING: 'Le module attendu est absent de cette analyse.',
      MEASUREMENT_MISSING: 'Le contrôle ne contient pas de mesure exploitable.', MEASUREMENT_SOURCE_MISSING: 'La source déclarée de la mesure est absente.',
      HTTP_CHALLENGE_OBSERVED: 'Une page de vérification anti-bot empêche la mesure du contenu attendu.',
      HTTP_TRANSPORT_UNAVAILABLE: 'Aucune réponse HTTP exploitable n’a été reçue.',
      INPUT_ALREADY_HTTPS: 'L’URL soumise était déjà en HTTPS.', CONDITIONAL_SIGNAL_ABSENT: 'Le signal conditionnel n’a pas été observé.',
      POLICY_DISABLED: 'Ce service est désactivé par le profil d’analyse.', NAVIGATION_INCOMPLETE: 'La navigation n’a pas abouti pendant la collecte.',
      SSL_ENDPOINTS_PARTIALLY_MEASURED: 'Une partie des points de terminaison TLS n’a pas pu être mesurée.',
    } as Record<string, string>,
  },
  en: {
    title: 'Coverage breakdown', measured: 'measured', missing: 'not covered', weight: 'Weight', points: 'coverage points',
    owner: 'Owning module', source: 'Actual source', unknown: 'Not retained', partial: 'Partial measurement', excluded: 'Excluded from denominator',
    empty: 'All expected checks are measured. Coverage does not guarantee site quality.',
    unavailable: 'Detail unavailable for this analysis.',
    historical: 'Values frozen in this report; no recalculation using the current policy. Contributions are rounded individually.',
    mismatch: 'The retained breakdown does not fully reconcile with the recorded total. Missing checks cannot be invented.',
    retry: 'Repeat the analysis if the service or page becomes available again.',
    blocked: 'Check the conditions for an authorised audit with the site owner, then try again.',
    inspect: 'Not measurable under current conditions. Ask the Argos operator to investigate collection.',
    partialAction: 'Only some TLS endpoints were measured; confirm the others before drawing a conclusion.',
    reasons: {
      CHECK_MISSING: 'The module did not produce this expected check.', MODULE_MISSING: 'The expected module is absent from this analysis.',
      MEASUREMENT_MISSING: 'The check contains no usable measurement.', MEASUREMENT_SOURCE_MISSING: 'The declared measurement source is absent.',
      HTTP_CHALLENGE_OBSERVED: 'An anti-bot challenge prevents measurement of the intended content.',
      HTTP_TRANSPORT_UNAVAILABLE: 'No usable HTTP response was received.',
      INPUT_ALREADY_HTTPS: 'The submitted URL already used HTTPS.', CONDITIONAL_SIGNAL_ABSENT: 'The conditional signal was not observed.',
      POLICY_DISABLED: 'This service is disabled by the analysis profile.', NAVIGATION_INCOMPLETE: 'Navigation did not complete during collection.',
      SSL_ENDPOINTS_PARTIALLY_MEASURED: 'Some TLS endpoints could not be measured.',
    } as Record<string, string>,
  },
};

/** Uses the persisted denominator, never today's catalogue or a rounded percentage. */
export function coverageBreakdown(coverage: Coverage) {
  const total = coverage.global.expectedWeight;
  const missing = coverage.checks.filter(c => c.state === 'UNAVAILABLE' || c.state === 'BLOCKED_BY_ANTIBOT');
  const excluded = coverage.checks.filter(c => c.state === 'NOT_APPLICABLE');
  const partial = coverage.checks.filter(c => c.state === 'MEASURED' && c.confidence === 'PARTIAL');
  const points = (weight: number) => total > 0 && Number.isFinite(weight) ? weight / total * 100 : undefined;
  const expected = coverage.checks.filter(c => c.state !== 'NOT_APPLICABLE').reduce((sum, c) => sum + c.weight, 0);
  const measured = coverage.checks.filter(c => c.state === 'MEASURED').reduce((sum, c) => sum + c.weight, 0);
  const reconciled = Math.abs(expected - total) < 1e-6 && Math.abs(measured - coverage.global.measuredWeight) < 1e-6;
  return { missing, excluded, partial, points, reconciled };
}

export function coverageAction(state: string, reason: string, lang: 'fr' | 'en') {
  const c = coverageCopy[lang];
  if (reason === 'SSL_ENDPOINTS_PARTIALLY_MEASURED') return c.partialAction;
  if (state === 'BLOCKED_BY_ANTIBOT') return c.blocked;
  return /TIMEOUT|UNAVAILABLE|NAVIGATION_INCOMPLETE|MODULE_MISSING|DEADLINE_EXCEEDED|PROVIDER_RATE_LIMITED|NETWORK_CONNECT/.test(reason) ? c.retry : c.inspect;
}
