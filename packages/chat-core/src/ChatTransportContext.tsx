import React, { createContext, useContext, useEffect, useState } from 'react';
import { ChatTransport } from './transport';

const ChatTransportContext = createContext<ChatTransport | null>(null);

export interface ChatTransportProviderProps {
  transport: ChatTransport;
  children: React.ReactNode;
}

export function ChatTransportProvider({ transport, children }: ChatTransportProviderProps) {
  return (
    <ChatTransportContext.Provider value={transport}>
      {children}
    </ChatTransportContext.Provider>
  );
}

export function useChatTransport(): ChatTransport {
  const transport = useContext(ChatTransportContext);
  if (!transport) {
    throw new Error('useChatTransport must be used within a ChatTransportProvider');
  }
  return transport;
}

/**
 * Hook to access connection status from the transport
 */
export function useChatConnection() {
  const transport = useChatTransport();
  const [connected, setConnected] = useState(transport.connected);

  useEffect(() => {
    return transport.onConnectionChange(setConnected);
  }, [transport]);

  return connected;
}
