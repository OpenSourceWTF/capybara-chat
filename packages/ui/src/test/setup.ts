/**
 * Test Setup for Huddle
 *
 * Configures the testing environment with DOM matchers
 * and global mocks for browser APIs.
 *
 * Memory optimization notes:
 * - Using happy-dom instead of jsdom (lighter weight)
 * - vi.resetModules() clears module cache to prevent accumulation
 * - Explicit DOM cleanup prevents happy-dom reference retention
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { vi, beforeAll, afterEach } from 'vitest';

// Mock window.matchMedia for components that use media queries
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock ResizeObserver for components that observe size changes
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Clean up after each test - critical for memory management
afterEach(() => {
  // Clean up React testing library (unmount components, clear timers)
  cleanup();
  // Clear all mock state
  vi.clearAllMocks();
  vi.restoreAllMocks();
  // Reset fake timers if any test used them
  vi.useRealTimers();
  // Clean up DOM to prevent memory accumulation
  document.body.innerHTML = '';
});

// Mock import.meta.env for environment variables
vi.stubEnv('MODE', 'test');
