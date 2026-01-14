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
    
    const sessionId = logData.session_id;
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id è richiesto' },
        { status: 400 }
      );
    }
    
    // 1. Cerca se esiste già un record per questa sessione
    // Usa .maybeSingle() invece di .single() per evitare errore quando non ci sono risultati
    const { data: existing, error: fetchError } = await supabase
      .from('chat_logs')
      .select('*')
      .filter('data->>session_id', 'eq', sessionId)
      .maybeSingle();
    
    // Se c'è un errore reale (non "nessun risultato"), logga e continua con insert
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Errore nella ricerca del record:', fetchError);
    }
    
    let result;
    
    if (existing && existing.data) {
      // 2a. Aggiorna il record esistente aggiungendo il nuovo messaggio
      const currentMessages = Array.isArray(existing.data.messages) ? existing.data.messages : [];
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
            ...existing.data,
            messages: updatedMessages,
            last_updated: new Date().toISOString()
          }
        })
        .eq('id', existing.id)
        .select();
      
      if (error) {
        console.error('Errore update Supabase:', error);
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
        console.error('Errore insert Supabase:', error);
        return NextResponse.json(
          { error: 'Errore nel salvare su Supabase', details: error.message },
          { status: 500 }
        );
      }
      
      result = data;
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Errore generale log API:', error);
    return NextResponse.json(
      { error: 'Errore nel salvare il log', details: String(error) },
      { status: 500 }
    );
  }
}

