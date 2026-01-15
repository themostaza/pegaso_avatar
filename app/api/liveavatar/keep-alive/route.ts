import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionToken = body.session_token;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'session_token richiesto' },
        { status: 400 }
      );
    }

    // Chiama l'endpoint keep-alive di LiveAvatar
    const response = await fetch('https://api.liveavatar.com/v1/sessions/keep-alive', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Errore keep-alive LiveAvatar:', errorText);
      return NextResponse.json(
        { error: 'Errore nel keep-alive', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Errore nel keep-alive:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
