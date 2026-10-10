import { NextRequest } from 'next/server';
import { dimensions, type ProductEvent } from './contract';
export const CONSENT_COOKIE = 'argos_product_consent';
export function enabled() { return process.env.PRODUCT_ANALYTICS_ENABLED === 'true' && Boolean(process.env.ADMIN_API_TOKEN?.trim()); }
export function sameOrigin(request: NextRequest) { return request.headers.get('origin') === request.nextUrl.origin && (!request.headers.get('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin'); }
export function attribution(request: NextRequest, value: unknown) { return enabled() && sameOrigin(request) && request.cookies.get(CONSENT_COOKIE)?.value === 'granted' ? dimensions(value) : undefined; }
export async function count(event: ProductEvent) { if (!enabled())
    return; try {
    await fetch((process.env.API_BASE ?? 'http://api-backend:8081') + '/api/product-analytics', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.ADMIN_API_TOKEN }, body: JSON.stringify(event), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(500) });
}
catch { /* Dropped telemetry never changes business responses. */ } }
export async function smallJson(request: NextRequest): Promise<unknown> { const reader = request.body?.getReader(); if (!reader)
    throw new Error('Invalid payload'); const chunks: Uint8Array[] = []; let bytes = 0; try {
    for (;;) {
        const chunk = await reader.read();
        if (chunk.done)
            break;
        bytes += chunk.value.byteLength;
        if (bytes > 2048) {
            await reader.cancel();
            throw new Error('Invalid payload');
        }
        chunks.push(chunk.value);
    }
    const data = Buffer.concat(chunks);
    return JSON.parse(data.toString('utf8'));
}
finally {
    reader.releaseLock();
} }
