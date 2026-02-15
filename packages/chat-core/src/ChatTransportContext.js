import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
const ChatTransportContext = createContext(null);
export function ChatTransportProvider({ transport, children }) {
    return (_jsx(ChatTransportContext.Provider, { value: transport, children: children }));
}
export function useChatTransport() {
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
//# sourceMappingURL=ChatTransportContext.js.map