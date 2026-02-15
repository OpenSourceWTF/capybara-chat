/**
 * Tests for SpecsLibrary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SpecsLibrary } from './SpecsLibrary';
import { SpecStatus } from '@capybara-chat/types';

// Mock useFetchList hook
vi.mock('../../hooks/useFetchList', () => ({
  useFetchList: vi.fn(() => ({
    items: [],
    loading: false,
    error: null,
  })),
}));

// Mock entity-events
vi.mock('../../lib/entity-events', () => ({
  openNewEntity: vi.fn(),
}));

// Mock useSocket for socket event handling
vi.mock('../../context/SocketContext', () => ({
  useSocket: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    connected: true,
  })),
}));

describe('SpecsLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', async () => {
    const { useFetchList } = await import('../../hooks/useFetchList');
    vi.mocked(useFetchList).mockReturnValue({
      items: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
      setItems: vi.fn(),
    });

    render(<SpecsLibrary />);

    expect(screen.getByText('Loading specs...')).toBeInTheDocument();
  });

  it('should render empty state', async () => {
    const { useFetchList } = await import('../../hooks/useFetchList');
    vi.mocked(useFetchList).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
      setItems: vi.fn(),
    });

    render(<SpecsLibrary />);

    expect(screen.getByText('No specs found.')).toBeInTheDocument();
  });

  it('should render specs list', async () => {
    const { useFetchList } = await import('../../hooks/useFetchList');
    vi.mocked(useFetchList).mockReturnValue({
      items: [
        {
          id: 'spec-1',
          title: 'Test Spec',
          content: 'Test content',
          status: 'published',
          workflowStatus: 'DRAFT',
          priority: 'normal',
          tags: ['test'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
      setItems: vi.fn(),
    });

    render(<SpecsLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Test Spec')).toBeInTheDocument();
    });
  });

  it('should call onSpecSelect when spec is clicked', async () => {
    const onSpecSelect = vi.fn();
    const { useFetchList } = await import('../../hooks/useFetchList');
    vi.mocked(useFetchList).mockReturnValue({
      items: [
        {
          id: 'spec-1',
          title: 'Test Spec',
          content: 'Test content',
          status: 'published',
          workflowStatus: 'DRAFT',
          priority: 'normal',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
      setItems: vi.fn(),
    });

    render(<SpecsLibrary onSpecSelect={onSpecSelect} />);

    await waitFor(() => {
      const specRow = screen.getByText('Test Spec');
      specRow.click();
    });

    expect(onSpecSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec-1', title: 'Test Spec' })
    );
  });

  describe('execution state filter toggle', () => {
    const createSpec = (id: string, title: string, workflowStatus: string) => ({
      id,
      title,
      content: 'Test content',
      status: 'published',
      workflowStatus,
      priority: 'normal',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    it('should render ALL/NEW/EXECUTED toggle buttons', async () => {
      const { useFetchList } = await import('../../hooks/useFetchList');
      vi.mocked(useFetchList).mockReturnValue({
        items: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
        setItems: vi.fn(),
      });

      render(<SpecsLibrary />);

      expect(screen.getByText('ALL')).toBeInTheDocument();
      expect(screen.getByText('NEW')).toBeInTheDocument();
      expect(screen.getByText('EXECUTED')).toBeInTheDocument();
    });

    it('should filter to NEW specs (DRAFT, READY) when NEW is clicked', async () => {
      const { useFetchList } = await import('../../hooks/useFetchList');
      vi.mocked(useFetchList).mockReturnValue({
        items: [
          createSpec('spec-draft', 'Draft Spec', SpecStatus.DRAFT),
          createSpec('spec-ready', 'Ready Spec', SpecStatus.READY),
          createSpec('spec-progress', 'In Progress Spec', SpecStatus.IN_PROGRESS),
          createSpec('spec-complete', 'Complete Spec', SpecStatus.COMPLETE),
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        setItems: vi.fn(),
      });

      render(<SpecsLibrary />);

      // Initially shows all
      await waitFor(() => {
        expect(screen.getByText('Draft Spec')).toBeInTheDocument();
        expect(screen.getByText('In Progress Spec')).toBeInTheDocument();
      });

      // Click NEW filter
      fireEvent.click(screen.getByText('NEW'));

      // Should show only DRAFT and READY
      await waitFor(() => {
        expect(screen.getByText('Draft Spec')).toBeInTheDocument();
        expect(screen.getByText('Ready Spec')).toBeInTheDocument();
        expect(screen.queryByText('In Progress Spec')).not.toBeInTheDocument();
        expect(screen.queryByText('Complete Spec')).not.toBeInTheDocument();
      });
    });

    it('should filter to EXECUTED specs (IN_PROGRESS, BLOCKED, COMPLETE) when EXECUTED is clicked', async () => {
      const { useFetchList } = await import('../../hooks/useFetchList');
      vi.mocked(useFetchList).mockReturnValue({
        items: [
          createSpec('spec-draft', 'Draft Spec', SpecStatus.DRAFT),
          createSpec('spec-progress', 'In Progress Spec', SpecStatus.IN_PROGRESS),
          createSpec('spec-blocked', 'Blocked Spec', SpecStatus.BLOCKED),
          createSpec('spec-complete', 'Complete Spec', SpecStatus.COMPLETE),
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        setItems: vi.fn(),
      });

      render(<SpecsLibrary />);

      // Click EXECUTED filter
      fireEvent.click(screen.getByText('EXECUTED'));

      // Should show only IN_PROGRESS, BLOCKED, COMPLETE
      await waitFor(() => {
        expect(screen.queryByText('Draft Spec')).not.toBeInTheDocument();
        expect(screen.getByText('In Progress Spec')).toBeInTheDocument();
        expect(screen.getByText('Blocked Spec')).toBeInTheDocument();
        expect(screen.getByText('Complete Spec')).toBeInTheDocument();
      });
    });

    it('should always filter out ARCHIVED specs', async () => {
      const { useFetchList } = await import('../../hooks/useFetchList');
      vi.mocked(useFetchList).mockReturnValue({
        items: [
          createSpec('spec-draft', 'Draft Spec', SpecStatus.DRAFT),
          createSpec('spec-archived', 'Archived Spec', SpecStatus.ARCHIVED),
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        setItems: vi.fn(),
      });

      render(<SpecsLibrary />);

      // Should show DRAFT but not ARCHIVED
      await waitFor(() => {
        expect(screen.getByText('Draft Spec')).toBeInTheDocument();
        expect(screen.queryByText('Archived Spec')).not.toBeInTheDocument();
      });

      // Even when clicking ALL, ARCHIVED should not show
      fireEvent.click(screen.getByText('ALL'));
      await waitFor(() => {
        expect(screen.queryByText('Archived Spec')).not.toBeInTheDocument();
      });
    });

    it('should show all non-archived specs when ALL is clicked', async () => {
      const { useFetchList } = await import('../../hooks/useFetchList');
      vi.mocked(useFetchList).mockReturnValue({
        items: [
          createSpec('spec-draft', 'Draft Spec', SpecStatus.DRAFT),
          createSpec('spec-complete', 'Complete Spec', SpecStatus.COMPLETE),
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        setItems: vi.fn(),
      });

      render(<SpecsLibrary />);

      // Click NEW first
      fireEvent.click(screen.getByText('NEW'));
      await waitFor(() => {
        expect(screen.queryByText('Complete Spec')).not.toBeInTheDocument();
      });

      // Click ALL to show everything
      fireEvent.click(screen.getByText('ALL'));
      await waitFor(() => {
        expect(screen.getByText('Draft Spec')).toBeInTheDocument();
        expect(screen.getByText('Complete Spec')).toBeInTheDocument();
      });
    });
  });
});
