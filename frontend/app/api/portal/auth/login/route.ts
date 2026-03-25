import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ERP_API_URL = (process.env.BACKEND_API_URL || 'http://backend:8000').replace(/\/$/, '');

export async function POST(request: NextRequest) {
  const body = await request.text();
  const upstreamResponse = await fetch(`${ERP_API_URL}/api/v1/auth/login/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body,
    cache: 'no-store',
    redirect: 'follow',
  });

  const responseHeaders = new Headers();
  const contentType = upstreamResponse.headers.get('content-type');

  if (contentType) {
    responseHeaders.set('content-type', contentType);
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
