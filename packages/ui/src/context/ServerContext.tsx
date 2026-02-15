/**
 * ServerContext - Centralized API configuration
 * 
 * Provides serverUrl to all components, eliminating prop drilling.
 * Reads from VITE_API_URL environment variable with sensible default.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { SERVER_DEFAULTS } from '@capybara-chat/types';

interface ServerConfig {
  serverUrl: string;
}

const defaultConfig: ServerConfig = {
  serverUrl: import.meta.env.VITE_API_URL || SERVER_DEFAULTS.SERVER_URL,
};

const ServerContext = createContext<ServerConfig>(defaultConfig);

/**
 * Hook to access server configuration
 */
export function useServer(): ServerConfig {
  return useContext(ServerContext);
}

interface ServerProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

/**
 * Provider component for server configuration
 * Wraps the app to provide serverUrl to all components
 */
export function ServerProvider({ children, serverUrl }: ServerProviderProps) {
  const config: ServerConfig = {
    serverUrl: serverUrl || defaultConfig.serverUrl,
  };

  return (
    <ServerContext.Provider value={config}>
      {children}
    </ServerContext.Provider>
  );
}
