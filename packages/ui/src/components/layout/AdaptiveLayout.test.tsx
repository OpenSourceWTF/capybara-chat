/**
 * Tests for AdaptiveLayout
 *
 * 168-right-bar-elimination: Updated for 2-pane layout (sessions pane removed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdaptiveLayout } from './AdaptiveLayout';
import { LayoutModeProvider } from '../../context/LayoutModeContext';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('AdaptiveLayout', () => {
  const defaultProps = {
    chatPane: <div data-testid="chat">Chat</div>,
    contentPane: <div data-testid="content">Content</div>,
    contentHeader: <div data-testid="content-header">Tabs</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Normal mode', () => {
    it('should render content and chat panes in normal mode', () => {
      render(
        <LayoutModeProvider>
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      expect(screen.getByTestId('chat')).toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByTestId('content-header')).toBeInTheDocument();
    });

    it('should have data-mode attribute set to normal', () => {
      render(
        <LayoutModeProvider>
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      const layout = screen.getByTestId('adaptive-layout');
      expect(layout).toHaveAttribute('data-mode', 'normal');
    });

    it('should have correct CSS classes', () => {
      render(
        <LayoutModeProvider>
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      const layout = screen.getByTestId('adaptive-layout');
      expect(layout).toHaveClass('adaptive-layout');
    });
  });

  describe('Focus mode', () => {
    it('should have data-mode attribute set to focus', () => {
      render(
        <LayoutModeProvider initialMode="focus">
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      const layout = screen.getByTestId('adaptive-layout');
      expect(layout).toHaveAttribute('data-mode', 'focus');
    });

    it('should hide chat pane in focus mode', () => {
      render(
        <LayoutModeProvider initialMode="focus">
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
    });

    it('should render content pane with header in focus mode', () => {
      render(
        <LayoutModeProvider initialMode="focus">
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByTestId('content-header')).toBeInTheDocument();
    });
  });

  describe('Immersive mode', () => {
    it('should have data-mode attribute set to immersive', () => {
      render(
        <LayoutModeProvider initialMode="immersive">
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      const layout = screen.getByTestId('adaptive-layout');
      expect(layout).toHaveAttribute('data-mode', 'immersive');
    });

    it('should hide chat pane in immersive mode', () => {
      render(
        <LayoutModeProvider initialMode="immersive">
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
    });

    it('should render content pane full width in immersive mode', () => {
      render(
        <LayoutModeProvider initialMode="immersive">
          <AdaptiveLayout {...defaultProps} />
        </LayoutModeProvider>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('Props handling', () => {
    it('should render without contentHeader', () => {
      const propsWithoutHeader = {
        chatPane: defaultProps.chatPane,
        contentPane: defaultProps.contentPane,
      };

      render(
        <LayoutModeProvider>
          <AdaptiveLayout {...propsWithoutHeader} />
        </LayoutModeProvider>
      );

      expect(screen.queryByTestId('content-header')).not.toBeInTheDocument();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });
});
