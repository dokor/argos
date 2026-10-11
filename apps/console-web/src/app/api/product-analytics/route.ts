import { NextRequest, NextResponse } from 'next/server';
import { eventPayload } from '@/lib/analytics/contract';
import { CONSENT_COOKIE, enabled, sameOrigin, smallJson, count } from '@/lib/analytics/server';
export async function POST(request: NextRequest) { if (!sameOrigin(request))
    return new NextResponse(null, { status: 403 }); if (!enabled() || request.cookies.get(CONSENT_COOKIE)?.value !== 'granted')
    return new NextResponse(null, { status: 204 }); let value: unknown; try {
    value = await smallJson(request);
}
catch {
    return new NextResponse(null, { status: 400 });
} const event = eventPayload(value); if (!event)
    return new NextResponse(null, { status: 400 }); await count(event); return new NextResponse(null, { status: 204 }); }
