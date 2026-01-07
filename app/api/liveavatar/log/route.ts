import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// Questo endpoint salva le conversazioni su Supabase
export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();
    
    // Verifica che Supabase sia configurato
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
      return NextResponse.json(
        { error: 'Supabase non configurato' },
        { status: 500 }
      );
    }
    
    const sessionId = logData.session_id || 'no-session';
    
    // 1. Cerca se esiste già un record per questa sessione
    const { data: existing, error: fetchError } = await supabase
      .from('chat_logs')
      .select('*')
      .eq('data->>session_id', sessionId)
      .single();
    
    let result;
    
    if (existing) {
      // 2a. Aggiorna il record esistente aggiungendo il nuovo messaggio
      const currentMessages = existing.data?.messages || [];
      const updatedMessages = [
        ...currentMessages,
        {
          type: logData.type,
          message: logData.message,
          timestamp: logData.timestamp
        }
      ];
      
      const { data, error } = await supabase
        .from('chat_logs')
        .update({
          data: {
            session_id: sessionId,
            messages: updatedMessages,
            last_updated: new Date().toISOString()
          }
        })
        .eq('id', existing.id)
        .select();
      
      if (error) {
        return NextResponse.json(
          { error: 'Errore nell\'aggiornare su Supabase', details: error.message },
          { status: 500 }
        );
      }
      
      result = data;
    } else {
      // 2b. Crea un nuovo record per questa sessione
      const { data, error } = await supabase
        .from('chat_logs')
        .insert({
          data: {
            session_id: sessionId,
            messages: [
              {
                type: logData.type,
                message: logData.message,
                timestamp: logData.timestamp
              }
            ],
            started_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          }
        })
        .select();
      
      if (error) {
        return NextResponse.json(
          { error: 'Errore nel salvare su Supabase', details: error.message },
          { status: 500 }
        );
      }
      
      result = data;
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore nel salvare il log', details: String(error) },
      { status: 500 }
    );
  }
}

