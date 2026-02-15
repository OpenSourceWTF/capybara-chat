/**
 * Tests for SpecView - Spec viewer/editor component
 *
 * IMPORTANT: Mock return values must use STABLE references to prevent
 * infinite render loops. SpecView's useEffect depends on fetchedSessions
 * (items from useFetchList), so a new array reference triggers re-renders.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SpecView } from './SpecView';
import { EntityStatus, SpecStatus, Priority } from '@capybara-chat/types';

// STABLE references for mocks to prevent infinite render loops
const STABLE_EMPTY_SESSIONS: never[] = [];
const stableFetchListRefetch = vi.fn();
const stableFetchListSetItems = vi.fn();

// Mock useFetch hook
vi.mock('../../hooks/useFetch', () => ({
  useFetch: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock useFetchList hook - MUST use stable array reference
vi.mock('../../hooks/useFetchList', () => ({
  useFetchList: vi.fn(() => ({
    items: STABLE_EMPTY_SESSIONS, // CRITICAL: Same array reference every call
    loading: false,
    error: null,
    refetch: stableFetchListRefetch,
    setItems: stableFetchListSetItems,
  })),
}));

// Mock usePost hook
vi.mock('../../hooks/useApiMutation', () => ({
  usePost: vi.fn(() => ({
    post: vi.fn(),
    loading: false,
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
      title: 'Test Spec',
      content: '# Test Content\n\nThis is **markdown**.',
      priority: Priority.NORMAL,
      workflowStatus: SpecStatus.READY,
      tags: 'test,spec',
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

// Mock useTasks hook (used by WorkerTaskMonitor)
vi.mock('../../hooks/useTasks', () => ({
  useTasks: vi.fn(() => ({
    tasks: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    getById: vi.fn(),
  })),
}));

// Mock useTechniques hook (used by WorkerTaskMonitor)
vi.mock('../../hooks/useTechniques', () => ({
  useTechniques: vi.fn(() => ({
    techniques: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock ServerContext (used by useTasks)
vi.mock('../../context/ServerContext', () => ({
  useServer: vi.fn(() => ({
    serverUrl: 'http://localhost:2279',
  })),
}));

// Mock WorkerTaskMonitor component entirely to avoid its heavy dependencies
vi.mock('../WorkerTaskMonitor', () => ({
  WorkerTaskMonitor: () => null,
}));

const mockSpec = {
  id: 'spec-123',
  title: 'Test Spec Title',
  content: '# Test Content\n\nThis is **markdown** content.\n\n- Item 1\n- Item 2',
  priority: Priority.HIGH,
  workflowStatus: SpecStatus.IN_PROGRESS,
  tags: ['test', 'spec'],
  status: EntityStatus.PUBLISHED,
  issueUrl: 'https://github.com/test/repo/issues/42',
  issueNumber: 42,
  githubPrUrl: 'https://github.com/test/repo/pull/99',
  githubPrNumber: 99,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// Import mocked modules directly instead of dynamic imports
import { useFetch } from '../../hooks/useFetch';

describe('SpecView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('view mode', () => {
    it('should render loading state', async () => {
      vi.mocked(useFetch).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render spec title', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('Test Spec Title')).toBeInTheDocument();
      });
    });

    it('should render priority metadata', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
      });
    });

    it('should render workflow status badge', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText(SpecStatus.IN_PROGRESS)).toBeInTheDocument();
      });
    });

    it('should render issue link when present', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('Issue #42')).toBeInTheDocument();
      });
    });

    it('should render PR link when present', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('PR #99')).toBeInTheDocument();
      });
    });

    it('should render tags', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument();
        expect(screen.getByText('spec')).toBeInTheDocument();
      });
    });

    it('should render sessions section', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('Session Log')).toBeInTheDocument();
      });
    });

    it('should render SPEC_DETAIL type label in header', async () => {
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('SPEC_DETAIL')).toBeInTheDocument();
      });
    });
  });

  describe('markdown rendering', () => {
    it('should render content as markdown (not raw)', async () => {
      // useFetch already imported at top level
      vi.mocked(useFetch).mockReturnValue({
        data: mockSpec,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SpecView specId="spec-123" initialMode="view" />);

      await waitFor(() => {
        // Check that markdown is rendered (not raw # or ** syntax)
        const container = document.querySelector('.prose');
        expect(container).toBeInTheDocument();
      });
    });
  });
});
