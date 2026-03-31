import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API = process.env.API_BASE_URL || 'https://staging-api.shodh.ai';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_API}/integrations/github/status`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch GitHub status' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GitHub status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
