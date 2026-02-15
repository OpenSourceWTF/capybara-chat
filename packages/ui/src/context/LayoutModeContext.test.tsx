/**
 * Tests for LayoutModeContext
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { LayoutModeProvider, useLayoutMode } from './LayoutModeContext';

describe('LayoutModeContext', () => {
  // Test component to access context
  function TestComponent() {
    const { mode, enterFocus, exitFocus, enterImmersive, exitImmersive, focusContext, previousState } = useLayoutMode();
    return (
      <div>
        <span data-testid="mode">{mode}</span>
        <span data-testid="focus-context">{JSON.stringify(focusContext)}</span>
        <span data-testid="previous-state">{JSON.stringify(previousState)}</span>
        <button onClick={() => enterFocus({ entityType: 'prompt', entityId: '123' })}>Enter Focus</button>
        <button onClick={() => enterFocus({ entityType: 'prompt' }, { tab: 'prompts', selectedEntity: null })}>Enter Focus With State</button>
        <button onClick={() => exitFocus()}>Exit Focus</button>
        <button onClick={() => enterImmersive({ entityType: 'pipeline' })}>Enter Immersive</button>
        <button onClick={() => exitImmersive()}>Exit Immersive</button>
      </div>
    );
  }

  it('should default to normal mode', () => {
    render(
      <LayoutModeProvider>
        <TestComponent />
      </LayoutModeProvider>
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('normal');
  });

  it('should allow initial mode override', () => {
    render(
      <LayoutModeProvider initialMode="focus">
        <TestComponent />
      </LayoutModeProvider>
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('focus');
  });

  it('should enter focus mode with context', async () => {
    render(
      <LayoutModeProvider>
        <TestComponent />
      </LayoutModeProvider>
    );

    await act(async () => {
      screen.getByText('Enter Focus').click();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('focus');
    expect(screen.getByTestId('focus-context')).toHaveTextContent('prompt');
    expect(screen.getByTestId('focus-context')).toHaveTextContent('123');
  });

  it('should store previous state when entering focus mode', async () => {
    render(
      <LayoutModeProvider>
        <TestComponent />
      </LayoutModeProvider>
    );

    await act(async () => {
      screen.getByText('Enter Focus With State').click();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('focus');
    expect(screen.getByTestId('previous-state')).toHaveTextContent('prompts');
  });

  it('should exit focus mode and return to normal', async () => {
    render(
      <LayoutModeProvider>
        <TestComponent />
      </LayoutModeProvider>
    );

    await act(async () => {
      screen.getByText('Enter Focus').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('focus');

    await act(async () => {
      screen.getByText('Exit Focus').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('normal');
    expect(screen.getByTestId('focus-context')).toHaveTextContent('null');
  });

  it('should enter immersive mode', async () => {
    render(
      <LayoutModeProvider>
        <TestComponent />
      </LayoutModeProvider>
    );

    await act(async () => {
      screen.getByText('Enter Immersive').click();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('immersive');
    expect(screen.getByTestId('focus-context')).toHaveTextContent('pipeline');
  });

  it('should exit immersive mode', async () => {
    render(
      <LayoutModeProvider>
        <TestComponent />
      </LayoutModeProvider>
    );

    await act(async () => {
      screen.getByText('Enter Immersive').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('immersive');

    await act(async () => {
      screen.getByText('Exit Immersive').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('normal');
  });

  it('should throw error when useLayoutMode is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLayoutMode());
    }).toThrow('useLayoutMode must be used within a LayoutModeProvider');

    consoleSpy.mockRestore();
  });

  it('should manage currentSessionId', async () => {
    function SessionTestComponent() {
      const { currentSessionId, setCurrentSessionId } = useLayoutMode();
      return (
        <div>
          <span data-testid="session">{currentSessionId || 'none'}</span>
          <button onClick={() => setCurrentSessionId('session-123')}>Set Session</button>
        </div>
      );
    }

    render(
      <LayoutModeProvider>
        <SessionTestComponent />
      </LayoutModeProvider>
    );

    expect(screen.getByTestId('session')).toHaveTextContent('none');

    await act(async () => {
      screen.getByText('Set Session').click();
    });

    expect(screen.getByTestId('session')).toHaveTextContent('session-123');
  });
});
