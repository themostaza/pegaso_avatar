'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { SessionEvent, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';

interface LiveAvatarClientProps {
  sessionId?: string;
  onConversationLog?: (log: any) => void;
}

export default function LiveAvatarClient({ 
  sessionId: initialSessionId,
  onConversationLog 
}: LiveAvatarClientProps) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'it' | 'en' | 'es' | 'fr' | 'de'>('it');
  const [messages, setMessages] = useState<Array<{type: 'user' | 'avatar', text: string, timestamp: string}>>([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarInstanceRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Aggiorna il ref quando sessionId cambia
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Funzione per loggare le conversazioni (usa ref per evitare closure stale)
  const logConversation = async (type: 'user' | 'avatar', message: string, metadata?: any) => {
    const currentSessionId = sessionIdRef.current;
    
    // Non loggare se non c'è una sessione attiva
    if (!currentSessionId) {
      console.warn('logConversation: sessione non disponibile');
      return;
    }
    
    // Invia in background senza bloccare
    fetch('/api/liveavatar/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSessionId,
        type,
        message,
        metadata,
        timestamp: new Date().toISOString(),
      }),
    }).then(() => {
      if (onConversationLog) {
        onConversationLog({ type, message, metadata });
      }
    }).catch((err) => {
      // Errore silenzioso per non interrompere l'esperienza utente
      console.error('Errore log conversazione:', err);
    });
  };

  // Inizializza la sessione
  const initializeSession = async (langOverride?: string) => {
    try {
      setStatus('loading');
      setError(null);
      
      // Pulisci i messaggi solo quando avvii una nuova sessione
      setMessages([]);

      const currentLanguage = langOverride || language;

      // 1. Richiedi permesso microfono
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Ferma lo stream, l'SDK lo riattiverà
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        throw new Error('Permesso microfono necessario per parlare con l\'avatar');
      }

      // 2. Ottieni il session token con la lingua selezionata
      const tokenResponse = await fetch('/api/liveavatar/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: currentLanguage }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Errore nel generare il token');
      }

      const tokenData = await tokenResponse.json();
      
      setSessionId(tokenData.session_id);
      setSessionToken(tokenData.session_token);

      // 2. Inizializza l'SDK LiveAvatar
      // L'SDK gestisce tutto internamente - non serve chiamare /start separatamente!
      if (videoRef.current && tokenData.session_token) {
        // Importa dinamicamente l'SDK
        const { LiveAvatarSession } = await import('@heygen/liveavatar-web-sdk');
        
        const avatar = new LiveAvatarSession(tokenData.session_token, {
          voiceChat: true,
        });

        // Event listeners per il ciclo di vita della sessione
        avatar.on(SessionEvent.SESSION_STATE_CHANGED, (state: any) => {});

        avatar.on(SessionEvent.SESSION_STREAM_READY, async () => {
          if (videoRef.current) {
            try {
              videoRef.current.muted = false;
              await videoRef.current.play();
            } catch (err: any) {
              if (err.name === 'NotAllowedError') {
                setTimeout(async () => {
                  try {
                    await videoRef.current?.play();
                  } catch (e) {}
                }, 100);
              }
            }
          }
          
          setStatus('ready');
        });

        avatar.on(SessionEvent.SESSION_DISCONNECTED, (reason: any) => {
          setStatus('error');
          setError('Sessione disconnessa: ' + reason);
        });

        avatar.on(SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED, (quality: any) => {});

        // Event listeners per le interazioni
        avatar.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {});
        avatar.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {});

        avatar.on(AgentEventsEnum.USER_TRANSCRIPTION, (event: any) => {
          logConversation('user', event.text);
          setMessages(prev => [...prev, { type: 'user', text: event.text, timestamp: new Date().toISOString() }]);
        });

        avatar.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {});
        avatar.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {});

        avatar.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event: any) => {
          logConversation('avatar', event.text);
          setMessages(prev => [...prev, { type: 'avatar', text: event.text, timestamp: new Date().toISOString() }]);
        });

        avatarInstanceRef.current = avatar;
        
        // Avvia la sessione PRIMA di attaccare
        await avatar.start();
        
        // Attacca il video element DOPO l'avvio
        avatar.attach(videoRef.current);
        
        // Configura audio/video
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'inizializzazione');
      setStatus('error');
    }
  };

  // Scroll automatico ai nuovi messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Avvio automatico dopo che l'utente ha interagito
  useEffect(() => {
    if (hasUserInteracted && status === 'idle') {
      initializeSession();
    }
  }, [hasUserInteracted, status]);

  // Handler per l'interazione iniziale
  const handleInitialInteraction = () => {
    setHasUserInteracted(true);
  };

  // Funzione per inviare un messaggio testuale
  const sendTextMessage = () => {
    if (!textInput.trim() || !avatarInstanceRef.current || status !== 'ready') return;
    
    // Invia il messaggio all'avatar
    // L'SDK emetterà l'evento USER_TRANSCRIPTION che aggiungerà il messaggio alla chat
    avatarInstanceRef.current.message(textInput);
    
    // Pulisci l'input
    setTextInput('');
  };

  // Handler per invio con Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // Funzione per chiudere la sessione
  const closeSession = async () => {
    if (avatarInstanceRef.current) {
      await avatarInstanceRef.current.stop();
      avatarInstanceRef.current = null;
    }
    setStatus('idle');
    setHasUserInteracted(false); // Reset per mostrare di nuovo il bottone "Avvia conversazione"
    // Non pulire i messaggi - rimangono visibili fino alla prossima sessione
    setSessionId(null);
    setSessionToken(null);
  };

  // Funzione per cambiare lingua (riavvia la sessione)
  const changeLanguage = async (newLang: 'it' | 'en' | 'es' | 'fr' | 'de') => {
    await closeSession();
    setLanguage(newLang);
    setTimeout(() => initializeSession(newLang), 500);
  };

  // Cleanup quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (avatarInstanceRef.current) {
        avatarInstanceRef.current.stop();
      }
    };
  }, []);

  const languageNames = {
    it: '🇮🇹 Italiano',
    en: '🇬🇧 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch',
  };

  return (
    <div className="w-full h-screen flex flex-col lg:flex-row gap-4 p-4 bg-zinc-50 dark:bg-zinc-900">
      {/* Colonna sinistra - Video (nascosto su mobile se chat è aperta) */}
      <div className={`flex-1 flex flex-col ${showChatOnMobile ? 'hidden lg:flex' : 'flex'}`}>
        {/* Video container */}
        <div className="relative w-full flex-1 bg-black rounded-2xl shadow-2xl overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain rounded-2xl"
            autoPlay
            playsInline
            muted={false}
            controls={false}
          />
          
          {/* Bottoni - al centro in basso */}
          {status === 'ready' && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3">
              {/* Bottone toggle chat (solo mobile) */}
              <button
                onClick={() => setShowChatOnMobile(!showChatOnMobile)}
                className="lg:hidden w-14 h-14 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-xl"
                title="Mostra conversazione"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
              
              {/* Bottone chiudi chiamata */}
              <button
                onClick={closeSession}
                className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-xl"
                title="Chiudi chiamata"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  <path d="M21 8l-4-4m0 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
          
          {/* Overlay iniziale per interazione utente */}
          {!hasUserInteracted && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
              <div className="text-center">
                {/* Favicon circolare */}
                <div className="mb-6 flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-xl overflow-hidden">
                    <img 
                      src="/favicon.ico" 
                      alt="Logo" 
                      className="w-full h-full object-cover scale-110"
                    />
                  </div>
                </div>
                
                <button
                  onClick={() => handleInitialInteraction()}
                  className="px-8 py-3 bg-white hover:bg-zinc-100 text-zinc-900 text-base font-medium rounded-lg transition-colors shadow-lg"
                >
                  Avvia conversazione
                </button>
                <p className="mt-4 text-white text-sm opacity-80">
                  Clicca per parlare con il tuo assistente virtuale
                </p>
              </div>
            </div>
          )}

          {/* Overlay per gli stati */}
          {hasUserInteracted && status !== 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              {status === 'idle' && (
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-lg">Avvio in corso...</p>
                </div>
              )}
              
              {status === 'loading' && (
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-lg">Sto avviando la conversazione...</p>
                </div>
              )}
              
              {status === 'error' && (
                <div className="text-white text-center px-4">
                  <p className="text-red-400 text-xl mb-4">⚠️ Errore</p>
                  <p className="text-sm mb-4">{error}</p>
                  <button
                    onClick={() => initializeSession()}
                    className="px-6 py-2 bg-white hover:bg-zinc-100 text-zinc-900 rounded-lg transition-colors"
                  >
                    Riprova
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Colonna destra - Trascrizione conversazione (nascosta su mobile se video è visibile) */}
      <div className={`w-full lg:w-96 h-full flex flex-col bg-white dark:bg-zinc-800 rounded-2xl shadow-xl overflow-hidden relative ${showChatOnMobile ? 'flex' : 'hidden lg:flex'}`}>
        {/* Header con bottone chiudi (solo mobile) */}
        <div className="lg:hidden flex items-center justify-end p-4 border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setShowChatOnMobile(false)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            title="Torna al video"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm mt-8">
              La conversazione apparirà qui...
            </p>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    msg.type === 'user'
                      ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                      : 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input per messaggi testuali - FISSO in fondo */}
        {status === 'ready' && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Scrivi un messaggio..."
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendTextMessage}
                disabled={!textInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

