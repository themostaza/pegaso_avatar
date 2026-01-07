// Types per LiveAvatar SDK

export interface SessionTokenResponse {
  session_id: string;
  session_token: string;
}

export interface SessionStartResponse {
  livekit_url: string;
  livekit_client_token: string;
  session_id: string;
}

export interface ConversationLog {
  session_id: string;
  type: 'user' | 'avatar';
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface LiveAvatarConfig {
  mode: 'FULL' | 'CUSTOM';
  avatar_id: string;
  avatar_persona: {
    voice_id?: string;
    context_id?: string;
    language: string;
  };
}

