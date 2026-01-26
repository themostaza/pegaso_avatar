'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { SessionEvent, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';

export default function LiveAvatarClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'it' | 'en' | 'es' | 'fr' | 'de'>('it');
  const [messages, setMessages] = useState<Array<{type: 'user' | 'avatar', text: string, timestamp: string}>>([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'GOOD' | 'BAD' | 'UNKNOWN'>('UNKNOWN');
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarInstanceRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref per tracciare le trascrizioni in corso (per evitare duplicati)
  const currentUserTranscriptRef = useRef<string | null>(null);
  const currentAvatarTranscriptRef = useRef<string | null>(null);

  // Stati dettagliati per tracciare comportamento avatar
  const [avatarState, setAvatarState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // Timeout per risposte avatar
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const RESPONSE_TIMEOUT_MS = 30000; // 30 secondi

  // Keep-alive: mantiene la sessione attiva chiamando l'endpoint periodicamente
  const startKeepAlive = useCallback((token: string) => {
    // Pulisci eventuali intervalli precedenti
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
    }

    // Chiama keep-alive ogni 30 secondi
    keepAliveIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/liveavatar/keep-alive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: token }),
        });
        
        if (!response.ok) {
          console.warn('Keep-alive fallito:', await response.text());
        }
      } catch (err) {
        console.warn('Errore keep-alive:', err);
      }
    }, 30000); // 30 secondi
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
  }, []);

  // Utility: retry con exponential backoff
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[HeyGen SDK] Tentativo ${attempt + 1}/${maxRetries + 1}...`);
        return await fn();
      } catch (err: any) {
        lastError = err;
        console.warn(`[HeyGen SDK] Tentativo ${attempt + 1} fallito:`, err.message);

        if (attempt < maxRetries) {
          const delayMs = initialDelayMs * Math.pow(2, attempt);
          console.log(`[HeyGen SDK] Riprovo tra ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error('Retry falliti');
  };

  // Utility: avvia timeout per risposta avatar
  const startResponseTimeout = useCallback(() => {
    // Cancella timeout precedente
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
    }

    responseTimeoutRef.current = setTimeout(() => {
      console.warn('[HeyGen SDK] Timeout: avatar non ha risposto in tempo');
      setAvatarState('idle');
      setError('L\'avatar impiega più tempo del solito. Riprova o attendi.');
    }, RESPONSE_TIMEOUT_MS);
  }, []);

  // Utility: cancella timeout risposta
  const clearResponseTimeout = useCallback(() => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }, []);

  // Inizializza la sessione
  const initializeSession = async (langOverride?: string) => {
    try {
      setStatus('loading');
      setError(null);
      setMessages([]);

      const currentLanguage = langOverride || language;

      // 1. Richiedi permesso microfono
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        throw new Error('Permesso microfono necessario per parlare con l\'avatar');
      }

      // 2. Ottieni il session token
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

      if (videoRef.current && tokenData.session_token) {
        const { LiveAvatarSession } = await import('@heygen/liveavatar-web-sdk');
        
        const avatar = new LiveAvatarSession(tokenData.session_token, {
          voiceChat: true,
        });

        avatar.on(SessionEvent.SESSION_STATE_CHANGED, (state: any) => {
          console.log('[HeyGen SDK] Session state changed:', state);

          // Aggiorna lo stato in base al cambio di stato della sessione
          if (state === 'connected') {
            console.log('[HeyGen SDK] Sessione connessa');
          } else if (state === 'disconnected') {
            console.warn('[HeyGen SDK] Sessione disconnessa');
            setAvatarState('idle');
          }
        });

        avatar.on(SessionEvent.SESSION_STREAM_READY, async () => {
          console.log('[HeyGen SDK] Stream pronto, avvio video...');

          if (videoRef.current) {
            try {
              videoRef.current.muted = false;
              await videoRef.current.play();
              console.log('[HeyGen SDK] Video avviato con successo');
            } catch (err: any) {
              console.warn('[HeyGen SDK] Errore autoplay video:', err.name);

              if (err.name === 'NotAllowedError') {
                // Retry con backoff per autoplay
                const retryPlay = async (attempt: number = 0, maxAttempts: number = 3) => {
                  if (attempt >= maxAttempts) {
                    console.error('[HeyGen SDK] Autoplay fallito dopo tutti i tentativi');
                    return;
                  }

                  const delayMs = 100 * Math.pow(2, attempt);
                  console.log(`[HeyGen SDK] Retry autoplay tra ${delayMs}ms (tentativo ${attempt + 1}/${maxAttempts})...`);

                  setTimeout(async () => {
                    try {
                      await videoRef.current?.play();
                      console.log('[HeyGen SDK] Video avviato dopo retry');
                    } catch (e) {
                      console.warn('[HeyGen SDK] Retry autoplay fallito, riprovo...');
                      await retryPlay(attempt + 1, maxAttempts);
                    }
                  }, delayMs);
                };

                await retryPlay();
              }
            }
          }

          setStatus('ready');
          setAvatarState('idle');
          console.log('[HeyGen SDK] Sessione pronta');

          // Avvia il keep-alive per mantenere la sessione attiva
          if (tokenData.session_token) {
            startKeepAlive(tokenData.session_token);
          }
        });

        avatar.on(SessionEvent.SESSION_DISCONNECTED, (reason: any) => {
          setStatus('error');
          setError('Sessione disconnessa: ' + reason);
        });

        avatar.on(SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED, (quality: any) => {
          setConnectionQuality(quality);
        });

        // Eventi utente
        avatar.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
          console.log('[HeyGen SDK] Utente ha iniziato a parlare');
          // Reset della trascrizione utente quando inizia a parlare
          currentUserTranscriptRef.current = null;
          setIsUserSpeaking(true);
          setAvatarState('listening');
          clearResponseTimeout(); // Cancella timeout precedente
        });

        avatar.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
          console.log('[HeyGen SDK] Utente ha smesso di parlare');
          setIsUserSpeaking(false);
          setAvatarState('thinking'); // Avatar sta elaborando
          startResponseTimeout(); // Avvia timeout per risposta
        });

        // Trascrizione utente - evita duplicati confrontando con testo precedente
        avatar.on(AgentEventsEnum.USER_TRANSCRIPTION, (event: any) => {
          if (event.text && event.text !== currentUserTranscriptRef.current) {
            console.log('[HeyGen SDK] Trascrizione utente ricevuta:', event.text.substring(0, 50) + '...');
            currentUserTranscriptRef.current = event.text;
            setMessages(prev => [...prev, { type: 'user', text: event.text, timestamp: new Date().toISOString() }]);
          }
        });

        // Eventi avatar
        avatar.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
          console.log('[HeyGen SDK] Avatar ha iniziato a parlare');
          // Reset della trascrizione avatar quando inizia a parlare
          currentAvatarTranscriptRef.current = null;
          setAvatarState('speaking');
          clearResponseTimeout(); // Avatar ha risposto, cancella timeout
        });

        avatar.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
          console.log('[HeyGen SDK] Avatar ha finito di parlare');
          setAvatarState('idle');
          clearResponseTimeout();
        });

        // Trascrizione avatar - evita duplicati confrontando con testo precedente
        avatar.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event: any) => {
          if (event.text && event.text !== currentAvatarTranscriptRef.current) {
            console.log('[HeyGen SDK] Trascrizione avatar ricevuta:', event.text.substring(0, 50) + '...');
            currentAvatarTranscriptRef.current = event.text;
            setMessages(prev => [...prev, { type: 'avatar', text: event.text, timestamp: new Date().toISOString() }]);
          }
        });

        avatarInstanceRef.current = avatar;

        // Avvia sessione con retry logic
        console.log('[HeyGen SDK] Avvio sessione avatar...');
        await retryWithBackoff(async () => {
          await avatar.start();
          console.log('[HeyGen SDK] Avatar.start() completato');
        }, 3, 2000);

        // Attach video con retry
        console.log('[HeyGen SDK] Attach video element...');
        await retryWithBackoff(async () => {
          if (!videoRef.current) {
            throw new Error('Video element non disponibile');
          }
          avatar.attach(videoRef.current);
          console.log('[HeyGen SDK] Avatar.attach() completato');
        }, 2, 1000);

        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
          console.log('[HeyGen SDK] Configurazione video completata');
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

  const handleInitialInteraction = () => {
    setHasUserInteracted(true);
  };

  const sendTextMessage = async () => {
    if (!textInput.trim() || !avatarInstanceRef.current || status !== 'ready') {
      console.warn('[HeyGen SDK] Impossibile inviare messaggio: condizioni non soddisfatte');
      return;
    }

    // Previeni invii multipli se avatar sta già elaborando
    if (avatarState === 'thinking' || avatarState === 'speaking') {
      console.warn('[HeyGen SDK] Avatar occupato, attendi la risposta precedente');
      setError('Attendi che l\'avatar finisca di rispondere');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const messageToSend = textInput;
    setTextInput('');

    try {
      console.log('[HeyGen SDK] Invio messaggio:', messageToSend);
      setAvatarState('thinking');
      startResponseTimeout();

      await avatarInstanceRef.current.message(messageToSend);
      console.log('[HeyGen SDK] Messaggio inviato con successo');
    } catch (err: any) {
      console.error('[HeyGen SDK] Errore invio messaggio:', err);
      setError('Errore nell\'invio del messaggio. Riprova.');
      setAvatarState('idle');
      clearResponseTimeout();
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const closeSession = async () => {
    console.log('[HeyGen SDK] Chiusura sessione...');

    // Ferma il keep-alive
    stopKeepAlive();

    // Cancella timeout risposta
    clearResponseTimeout();

    // Reset delle trascrizioni in corso
    currentUserTranscriptRef.current = null;
    currentAvatarTranscriptRef.current = null;

    if (avatarInstanceRef.current) {
      try {
        await avatarInstanceRef.current.stop();
        console.log('[HeyGen SDK] Sessione chiusa con successo');
      } catch (err) {
        console.warn('[HeyGen SDK] Errore durante chiusura sessione:', err);
      }
      avatarInstanceRef.current = null;
    }

    setStatus('idle');
    setHasUserInteracted(false);
    setSessionId(null);
    setSessionToken(null);
    setConnectionQuality('UNKNOWN');
    setAvatarState('idle');
    setIsUserSpeaking(false);
  };

  const changeLanguage = async (newLang: 'it' | 'en' | 'es' | 'fr' | 'de') => {
    await closeSession();
    setLanguage(newLang);
    setTimeout(() => initializeSession(newLang), 500);
  };

  // Cleanup quando il componente viene smontato
  useEffect(() => {
    return () => {
      // Ferma il keep-alive
      stopKeepAlive();
      
      if (avatarInstanceRef.current) {
        avatarInstanceRef.current.stop();
      }
    };
  }, [stopKeepAlive]);

  return (
    <div className="w-full h-screen flex flex-col lg:flex-row gap-4 p-4 bg-zinc-50 dark:bg-zinc-900">
      {/* Colonna sinistra - Video */}
      <div className={`flex-1 flex flex-col ${showChatOnMobile ? 'hidden lg:flex' : 'flex'}`}>
        <div className="relative w-full flex-1 bg-black rounded-2xl shadow-2xl overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain rounded-2xl"
            autoPlay
            playsInline
            muted={false}
            controls={false}
          />
          
          {/* Bottone Privacy Policy - alto centro */}
          <a
            href="https://fondopegaso.it/privacy-policy-pegaso/"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-zinc-900/80 hover:bg-zinc-800/90 text-white text-xs rounded-lg transition-colors backdrop-blur-sm"
          >
            Privacy Policy
          </a>
          
          {status === 'ready' && (
            <>
              {/* Indicatore stato avatar - in alto a destra */}
              <div className="absolute top-3 right-3 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-sm rounded-lg shadow-lg">
                <div className="flex items-center gap-2">
                  {avatarState === 'listening' && (
                    <>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs font-medium">In ascolto...</span>
                    </>
                  )}
                  {avatarState === 'thinking' && (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs font-medium">Sto elaborando...</span>
                    </>
                  )}
                  {avatarState === 'speaking' && (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs font-medium">Sto parlando...</span>
                    </>
                  )}
                  {avatarState === 'idle' && !isUserSpeaking && (
                    <>
                      <div className="w-2 h-2 bg-zinc-500 rounded-full"></div>
                      <span className="text-white text-xs font-medium">Pronto</span>
                    </>
                  )}
                </div>
              </div>

              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 items-center">
                <button
                  onClick={() => setShowChatOnMobile(!showChatOnMobile)}
                  className="lg:hidden w-14 h-14 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-xl"
                  title="Mostra conversazione"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </button>

                {/* Indicatore qualità connessione */}
                <div
                  className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center shadow-lg"
                  title={`Connessione: ${connectionQuality === 'GOOD' ? 'Buona' : connectionQuality === 'BAD' ? 'Scarsa' : 'Sconosciuta'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {/* Barre del segnale */}
                    <rect x="2" y="16" width="4" height="6" rx="1" className={connectionQuality !== 'UNKNOWN' ? (connectionQuality === 'GOOD' ? 'fill-green-500 stroke-green-500' : 'fill-red-500 stroke-red-500') : 'fill-zinc-500 stroke-zinc-500'} />
                    <rect x="8" y="12" width="4" height="10" rx="1" className={connectionQuality !== 'UNKNOWN' ? (connectionQuality === 'GOOD' ? 'fill-green-500 stroke-green-500' : 'fill-zinc-600 stroke-zinc-600') : 'fill-zinc-500 stroke-zinc-500'} />
                    <rect x="14" y="8" width="4" height="14" rx="1" className={connectionQuality === 'GOOD' ? 'fill-green-500 stroke-green-500' : 'fill-zinc-600 stroke-zinc-600'} />
                    <rect x="20" y="4" width="4" height="18" rx="1" className={connectionQuality === 'GOOD' ? 'fill-green-500 stroke-green-500' : 'fill-zinc-600 stroke-zinc-600'} />
                  </svg>
                </div>

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
            </>
          )}
          
          {!hasUserInteracted && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
              <div className="text-center">
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
                <a
                  href="https://fondopegaso.it/privacy-policy-pegaso/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-white/60 hover:text-white/90 text-xs underline transition-colors"
                >
                  Privacy Policy
                </a>
              </div>
            </div>
          )}

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

      {/* Colonna destra - Chat */}
      <div className={`w-full lg:w-96 h-full flex flex-col bg-white dark:bg-zinc-800 rounded-2xl shadow-xl overflow-hidden relative ${showChatOnMobile ? 'flex' : 'hidden lg:flex'}`}>
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
            <>
              {messages.map((msg, idx) => (
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
              ))}

              {/* Indicatore "avatar sta elaborando" */}
              {avatarState === 'thinking' && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-600">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">Sto elaborando...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

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
