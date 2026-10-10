import { NextRequest } from 'next/server';
import { adminReadProxy } from '@/lib/admin-read-proxy';
export async function GET(request: NextRequest) { const raw = Number(request.nextUrl.searchParams.get('days')); const days = [7, 30, 90].includes(raw) ? raw : 30; return adminReadProxy(request, '/api/product-analytics/metrics?days=' + days); }
