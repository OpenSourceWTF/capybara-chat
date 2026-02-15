/**
 * Tests for DocumentView - Document viewer/editor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DocumentView } from './DocumentView';
import { EntityStatus } from '@capybara-chat/types';

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
      name: 'Test Document',
      content: '# Test Content',
      tags: 'test',
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

const mockDocument = {
  id: 'doc-123',
  name: 'Test Document Name',
  content: '# Documentation\n\nThis is **markdown** documentation.\n\n## Section\n\n- Point 1\n- Point 2\n\n```typescript\nconst x = 1;\n```',
  tags: ['docs', 'test'],
  status: EntityStatus.PUBLISHED,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('DocumentView', () => {
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

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render document name', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockDocument,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('Test Document Name')).toBeInTheDocument();
      });
    });

    it('should render tags', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockDocument,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(screen.getByText('test')).toBeInTheDocument();
      });
    });
  });

  describe('markdown rendering', () => {
    it('should render content as markdown', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockDocument,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      await waitFor(() => {
        // Check that markdown rendering container is present
        const container = document.querySelector('.prose');
        expect(container).toBeInTheDocument();
      });
    });

    it('should render headings properly', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockDocument,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      await waitFor(() => {
        // The markdown should render headings - we expect multiple (title + content headings)
        const headings = document.querySelectorAll('h1, h2');
        // We should have at least 2 headings: the document title and markdown content headings
        expect(headings.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should render code blocks properly', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockDocument,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      await waitFor(() => {
        // Code blocks should be rendered
        const codeBlock = document.querySelector('code');
        expect(codeBlock).toBeInTheDocument();
      });
    });

    it('should render lists properly', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockDocument,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DocumentView documentId="doc-123" initialMode="view" />);

      await waitFor(() => {
        // Lists should be rendered
        const list = document.querySelector('ul, ol');
        expect(list).toBeInTheDocument();
      });
    });
  });
});
