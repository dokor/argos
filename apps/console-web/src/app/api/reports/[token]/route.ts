import { NextRequest, NextResponse } from 'next/server';
import { CONSENT_COOKIE, enabled } from '@/lib/analytics/server';
export async function GET(request: NextRequest, { params }: {
    params: Promise<{
        token: string;
    }>;
}) {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(token))
        return new NextResponse(null, { status: 404 });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (enabled() && request.cookies.get(CONSENT_COOKIE)?.value === 'granted' && request.headers.get('X-Argos-Report-View') === '1') {
        headers.Authorization = 'Bearer ' + process.env.ADMIN_API_TOKEN;
        headers['X-Product-Consent'] = 'granted';
    }
    try {
        const response = await fetch((process.env.API_BASE ?? 'http://api-backend:8081') + '/api/reports/' + token, { headers, cache: 'no-store', redirect: 'error' });
        return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    catch {
        return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
    }
}
