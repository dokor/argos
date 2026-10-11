import { NextRequest, NextResponse } from 'next/server';
import { CONSENT_COOKIE, enabled, sameOrigin, smallJson } from '@/lib/analytics/server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { const value = request.cookies.get(CONSENT_COOKIE)?.value; return NextResponse.json({ enabled: enabled(), choice: value === 'granted' || value === 'refused' ? value : 'unset' }, { headers: { 'Cache-Control': 'private, no-store' } }); }
export async function POST(request: NextRequest) { if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 }); if (!enabled())
    return new NextResponse(null, { status: 204 }); let body: unknown; try {
    body = await smallJson(request);
}
catch {
    return NextResponse.json({ error: 'Invalid choice' }, { status: 400 });
} if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || !['granted', 'refused'].includes(String((body as {
    choice?: unknown;
}).choice)))
    return NextResponse.json({ error: 'Invalid choice' }, { status: 400 }); const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }); response.cookies.set(CONSENT_COOKIE, String((body as {
    choice: string;
}).choice), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' }); return response; }
