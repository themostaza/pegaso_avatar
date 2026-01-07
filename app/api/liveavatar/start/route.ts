import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return NextResponse.json(
        { error: 'Body JSON non valido' },
        { status: 400 }
      );
    }
    
    const { session_token } = body;

    if (!session_token) {
      return NextResponse.json(
        { error: 'session_token è richiesto' },
        { status: 400 }
      );
    }

    // Avvia la sessione LiveAvatar
    const response = await fetch('https://api.liveavatar.com/v1/sessions/start', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${session_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Errore nell\'avvio della sessione', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Restituisci direttamente data.data per semplificare l'uso nel frontend
    return NextResponse.json(data.data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore interno del server', details: String(error) },
      { status: 500 }
    );
  }
}

