import React from 'react';
import { ChatTransport } from './transport';
export interface ChatTransportProviderProps {
    transport: ChatTransport;
    children: React.ReactNode;
}
export declare function ChatTransportProvider({ transport, children }: ChatTransportProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useChatTransport(): ChatTransport;
/**
 * Hook to access connection status from the transport
 */
export declare function useChatConnection(): boolean;
//# sourceMappingURL=ChatTransportContext.d.ts.map