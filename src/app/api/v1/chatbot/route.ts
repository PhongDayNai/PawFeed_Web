import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000/v1';
  const url = `${backendUrl}/chatbot`;

  const headers = new Headers();
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }
  headers.set('Content-Type', 'application/json');

  const body = await request.text();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      return new NextResponse(errText, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set headers for SSE streaming
    const resHeaders = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Pipe the response body stream to the client
    const stream = response.body;
    return new NextResponse(stream, {
      status: 200,
      headers: resHeaders,
    });
  } catch (error: any) {
    console.error('Chatbot proxy error:', error);
    return NextResponse.json(
      { ok: false, error: { message: 'Internal Server Error' } },
      { status: 500 }
    );
  }
}
