/**
 * Test Utilities
 *
 * Provides helper functions and wrappers for testing React components.
 */

import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { createContext, type ReactElement, type ReactNode } from 'react';
import { ServerProvider } from '../context/ServerContext';
import { SERVER_DEFAULTS } from '@capybara-chat/types';

interface WrapperProps {
  children: ReactNode;
}

/**
 * Mock Socket Context for testing
 * Provides the same interface as SocketContext but with no-op implementations
 */
const MockSocketContext = createContext({
  socket: null,
  connected: false,
  agentStatus: 'offline' as const,
  processingSessions: new Set<string>(),
  emit: () => {},
  on: () => {},
  off: () => {},
});

/**
 * Mock Socket Provider for testing
 */
export function MockSocketProvider({ children }: { children: ReactNode }) {
  const value = {
    socket: null,
    connected: false,
    agentStatus: 'offline' as const,
    processingSessions: new Set<string>(),
    emit: () => {},
    on: () => {},
    off: () => {},
  };
  return <MockSocketContext.Provider value={value}>{children}</MockSocketContext.Provider>;
}

/**
 * Custom render function that wraps components with necessary providers
 */
function AllProviders({ children }: WrapperProps) {
  return (
    <ServerProvider serverUrl={SERVER_DEFAULTS.SERVER_URL}>
      <MockSocketProvider>
        {children}
      </MockSocketProvider>
    </ServerProvider>
  );
}

/**
 * Custom render function that includes all providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };
