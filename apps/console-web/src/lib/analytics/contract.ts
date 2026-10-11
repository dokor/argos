import { frenchPath } from '@/lib/i18n/routes';
export const routes = ['/', '/faq', '/ressources', '/exemple-rapport', '/a-propos', '/methodologie-score', '/guides/checklist-audit-site-web', '/ressources/audit-technique-gratuit', '/ressources/accessibilite-numerique', '/ressources/audit-site-pme', '/ressources/audit-site-ecommerce', '/test-vitesse-site-web', '/analyse-seo-page', '/verifier-entetes-securite', '/test-accessibilite-site-web'] as const;
export type Dimensions = {
    route: string;
    lang: 'fr' | 'en';
    placement: 'page' | 'nav' | 'hero' | 'footer' | 'form';
};
export type ProductEvent = {
    event: 'public_page_view' | 'example_open' | 'audit_cta_click' | 'audit_submission_rejected';
    dimensions: Dimensions;
    errorCategory?: 'none' | 'validation' | 'service' | 'rate_limit';
};
export function publicRoute(path: string): string | undefined { const route = frenchPath(path); return (routes as readonly string[]).includes(route) ? route : undefined; }
export function dimensions(value: unknown): Dimensions | undefined {
    if (!value || typeof value !== 'object')
        return;
    const d = value as Record<string, unknown>;
    if (Object.keys(d).some(k => !['route', 'lang', 'placement'].includes(k)) || typeof d.route !== 'string' || !(routes as readonly string[]).includes(d.route) || !['fr', 'en'].includes(String(d.lang)) || !['page', 'nav', 'hero', 'footer', 'form'].includes(String(d.placement)))
        return;
    return { route: d.route, lang: d.lang as Dimensions['lang'], placement: d.placement as Dimensions['placement'] };
}
export function eventPayload(value: unknown): ProductEvent | undefined {
    if (!value || typeof value !== 'object')
        return;
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(k => !['event', 'dimensions', 'errorCategory'].includes(k)))
        return;
    const d = dimensions(v.dimensions);
    if (!d || !['public_page_view', 'example_open', 'audit_cta_click', 'audit_submission_rejected'].includes(String(v.event)))
        return;
    const error = v.errorCategory ?? 'none';
    if (!['none', 'validation', 'service', 'rate_limit'].includes(String(error)) || (v.event !== 'audit_submission_rejected' && error !== 'none'))
        return;
    return { event: v.event as ProductEvent['event'], dimensions: d, errorCategory: error as ProductEvent['errorCategory'] };
}
