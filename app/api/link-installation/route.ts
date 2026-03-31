import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API = process.env.API_BASE_URL || 'https://staging-api.shodh.ai';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_API}/link-installation`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: await request.text(),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to link installation' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Link installation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
