import { afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/product-analytics/route';
import { POST as consent } from '@/app/api/product-analytics/consent/route';
import { dimensions, eventPayload, publicRoute } from './contract';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const event = { event: 'public_page_view', dimensions: { route: '/', lang: 'fr', placement: 'page' } };
const request = (body: unknown, cookie = '', origin = 'https://argos.test') => new NextRequest('https://argos.test/api/product-analytics', { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
describe('consented telemetry boundary', () => {
    it('rejects private paths, queries and extra identifying fields', () => { for (const route of ['/report/private', '/?email=secret', 'https://example.com', '/dashboard'])
        expect(dimensions({ ...event.dimensions, route })).toBeUndefined(); expect(eventPayload({ ...event, email: 'private' })).toBeUndefined(); expect(dimensions({ ...event.dimensions, token: 'private' })).toBeUndefined(); expect(publicRoute('/en/example-report')).toBe('/exemple-rapport'); });
    it('never forwards while disabled, unset or refused', async () => { const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); expect((await POST(request(event, 'argos_product_consent=granted'))).status).toBe(204); vi.stubEnv('PRODUCT_ANALYTICS_ENABLED', 'true'); vi.stubEnv('ADMIN_API_TOKEN', 'synthetic'); for (const cookie of ['', 'argos_product_consent=refused'])
        expect((await POST(request(event, cookie))).status).toBe(204); expect(fetch).not.toHaveBeenCalled(); });
    it('forwards only closed event fields with server credential', async () => { vi.stubEnv('PRODUCT_ANALYTICS_ENABLED', 'true'); vi.stubEnv('ADMIN_API_TOKEN', 'synthetic'); const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch); expect((await POST(request(event, 'argos_product_consent=granted'))).status).toBe(204); expect(fetch).toHaveBeenCalledOnce(); const init = fetch.mock.calls[0][1]; expect(init.headers.Authorization).toBe('Bearer synthetic'); expect(JSON.parse(init.body)).toEqual({ ...event, errorCategory: 'none' }); expect((await POST(request({ ...event, token: 'private' }, 'argos_product_consent=granted'))).status).toBe(400); expect(fetch).toHaveBeenCalledOnce(); });
    it('rejects cross-origin choice and uses a session HttpOnly cookie', async () => { vi.stubEnv('PRODUCT_ANALYTICS_ENABLED', 'true'); vi.stubEnv('ADMIN_API_TOKEN', 'synthetic'); expect((await consent(request({ choice: 'granted' }, '', 'https://other.test'))).status).toBe(403); const response = await consent(request({ choice: 'refused' })); expect(response.status).toBe(204); expect(response.headers.get('set-cookie')).toContain('HttpOnly'); expect(response.headers.get('set-cookie')).toContain('SameSite=strict'); expect(response.headers.get('set-cookie')).not.toMatch(/Max-Age|Expires/); });
});
