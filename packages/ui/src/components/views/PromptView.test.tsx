/**
 * Tests for PromptView - Prompt viewer/editor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PromptView } from './PromptView';
import { EntityStatus, PromptOutputType } from '@capybara-chat/types';

// Mock useFetch hook
vi.mock('../../hooks/useFetch', () => ({
  useFetch: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock useSocket
vi.mock('../../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({
    socket: null,
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
  })),
}));

// Mock useLayoutMode
vi.mock('../../context/LayoutModeContext', () => ({
  useLayoutMode: vi.fn(() => ({
    setEditingContext: vi.fn(),
    currentSessionId: null,
  })),
}));

// Mock useNavigationGuard
vi.mock('../../context/NavigationGuardContext', () => ({
  useNavigationGuard: vi.fn(() => ({
    setDirty: vi.fn(),
    pendingNavigation: null,
    confirmNavigation: vi.fn(),
    cancelNavigation: vi.fn(),
  })),
}));

// Mock useEntityForm
vi.mock('../../hooks/useEntityForm', () => ({
  useEntityForm: vi.fn(() => ({
    formData: {
      name: 'Test Prompt',
      content: '# Test Content',
      summary: 'A test prompt',
      tags: 'test',
      outputType: PromptOutputType.SPEC,
    },
    setField: vi.fn(),
    hasChanges: false,
    isSaving: false,
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    saveWithStatus: vi.fn(),
    aiFilledFields: new Map(),
  })),
}));

const mockPrompt = {
  id: 'prompt-123',
  name: 'Test Prompt Name',
  content: '# Instructions\n\nThis is **markdown** with {{variable}}.',
  summary: 'A summary of the prompt',
  tags: ['test', 'prompt'],
  variables: ['variable', 'another'],
  color: '#ff6b6b',
  outputType: PromptOutputType.SPEC,
  status: EntityStatus.PUBLISHED,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('PromptView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('should render loading state', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<PromptView promptId="prompt-123" initialMode="view" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render prompt name', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockPrompt,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<PromptView promptId="prompt-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('Test Prompt Name')).toBeInTheDocument();
      });
    });

    it('should render output type', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockPrompt,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<PromptView promptId="prompt-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('OUTPUT_TYPE::')).toBeInTheDocument();
        expect(screen.getByText(`[${PromptOutputType.SPEC}]`)).toBeInTheDocument();
      });
    });

    it('should render variables section', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockPrompt,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<PromptView promptId="prompt-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('VARIABLES [2]::')).toBeInTheDocument();
        expect(screen.getByText('{{variable}}')).toBeInTheDocument();
        expect(screen.getByText('{{another}}')).toBeInTheDocument();
      });
    });

    it('should render tags', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockPrompt,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<PromptView promptId="prompt-123" initialMode="view" />);

      await waitFor(() => {
        // Tags may appear multiple times (in header, etc.), use getAllByText
        expect(screen.getAllByText('test').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('prompt').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('markdown rendering', () => {
    it('should render content with markdown support', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockPrompt,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<PromptView promptId="prompt-123" initialMode="view" />);

      await waitFor(() => {
        // Check that markdown rendering is enabled
        const container = document.querySelector('.prose');
        expect(container).toBeInTheDocument();
      });
    });
  });
});
