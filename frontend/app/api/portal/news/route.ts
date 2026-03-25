import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ERP_API_URL = (process.env.BACKEND_API_URL || 'http://backend:8000').replace(/\/$/, '');

const buildForwardHeaders = (request: NextRequest): Headers => {
  const headers = new Headers();
  const acceptLanguage = request.headers.get('accept-language');

  headers.set('accept', 'application/json');

  if (acceptLanguage) {
    headers.set('accept-language', acceptLanguage);
  }

  return headers;
};

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search || '';
  const upstreamUrl = `${ERP_API_URL}/api/v1/hvac/public/news/${search}`;
  const upstreamResponse = await fetch(upstreamUrl, {
    method: 'GET',
    headers: buildForwardHeaders(request),
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
