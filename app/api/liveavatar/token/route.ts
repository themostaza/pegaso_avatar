import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LIVEAVATAR_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LIVEAVATAR_API_KEY non configurata' },
        { status: 500 }
      );
    }

    // Ottieni i parametri dal body (opzionali, altrimenti usa gli env)
    const body = await request.json().catch(() => ({}));
    
    const avatarId = body.avatar_id || process.env.NEXT_PUBLIC_AVATAR_ID || '9f63d9e0-48a2-4921-9b1a-d6b058167396';
    const voiceId = body.voice_id || process.env.NEXT_PUBLIC_VOICE_ID;
    const contextId = body.context_id || process.env.NEXT_PUBLIC_CONTEXT_ID;
    const language = body.language || 'it'; // Default italiano

    // Crea il session token con lingua italiana di default
    const response = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id: avatarId,
        avatar_persona: {
          voice_id: voiceId,
          context_id: contextId,
          language: language, // 🌍 Lingua configurabile
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Errore LiveAvatar API:', errorText);
      return NextResponse.json(
        { error: 'Errore nella creazione del token', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // L'API restituisce i dati dentro data.data
    const result = {
      session_id: data.data.session_id,
      session_token: data.data.session_token,
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Errore nel generare il token:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

