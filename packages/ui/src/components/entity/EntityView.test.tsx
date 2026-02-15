/**
 * EntityView ARIA Tabs Tests (TDD)
 *
 * Tests for enhanced EntityView component with proper ARIA tab pattern.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Requirements:
 * 1. Has role="tablist" on container
 * 2. Each tab has role="tab"
 * 3. Active tab has aria-selected="true"
 * 4. Panel has role="tabpanel"
 * 5. Panel has aria-labelledby pointing to active tab
 * 6. ArrowLeft/Right navigates between tabs
 * 7. Tab key moves focus to panel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityView } from './EntityView';
import { EntityStatus } from '@capybara-chat/types';
import type { EntitySchemaDefinition, FieldDefinition } from '../../schemas/define-schema';

// Mock required contexts and hooks

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
      title: 'Test Entity',
      content: 'Test content',
      tags: '',
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

// Import mocked hooks for manipulation
import { useFetch } from '../../hooks/useFetch';

// Define test schema
interface TestEntity {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  status?: EntityStatus;
  createdAt?: number;
  updatedAt?: number;
}

interface TestForm {
  title: string;
  content: string;
  tags: string;
}

const testSchema: EntitySchemaDefinition<TestEntity, TestForm> = {
  entityType: 'spec',
  defaultValues: {
    title: '',
    content: '',
    tags: '',
  },
  toFormData: (entity: TestEntity | null) => ({
    title: entity?.title ?? '',
    content: entity?.content ?? '',
    tags: entity?.tags?.join(',') ?? '',
  }),
  fromFormData: (form: TestForm) => ({
    title: form.title,
    content: form.content,
    tags: form.tags.split(',').filter(Boolean),
  }),
  fields: {
    title: {
      type: 'text',
      label: 'Title',
      required: true,
    } as FieldDefinition,
    content: {
      type: 'markdown',
      label: 'Content',
    } as FieldDefinition,
    tags: {
      type: 'tags',
      label: 'Tags',
    } as FieldDefinition,
  },
};

const mockEntity: TestEntity = {
  id: 'entity-123',
  title: 'Test Entity Title',
  content: '# Test Content',
  tags: ['test', 'entity'],
  status: EntityStatus.PUBLISHED,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('EntityView ARIA Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFetch).mockReturnValue({
      data: mockEntity,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  describe('tab structure', () => {
    it('should have role="tablist" on tab container', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('should have role="tab" on each tab', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveTextContent('Details');
      expect(tabs[1]).toHaveTextContent('Settings');
    });

    it('should have role="tabpanel" on active panel', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const panel = screen.getByRole('tabpanel');
      expect(panel).toBeInTheDocument();
    });
  });

  describe('aria-selected state', () => {
    it('should have aria-selected="true" on active tab', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tabs = screen.getAllByRole('tab');
      // First tab should be selected by default
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('should update aria-selected when tab changes', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tabs = screen.getAllByRole('tab');

      // Click second tab
      await user.click(tabs[1]);

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('panel-tab relationship', () => {
    it('should have aria-labelledby on panel pointing to active tab', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const activeTab = screen.getByRole('tab', { name: 'Details' });
      const panel = screen.getByRole('tabpanel');

      const tabId = activeTab.getAttribute('id');
      expect(panel).toHaveAttribute('aria-labelledby', tabId);
    });

    it('should have aria-controls on tab pointing to panel', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const activeTab = screen.getByRole('tab', { name: 'Details' });
      const panel = screen.getByRole('tabpanel');

      const panelId = panel.getAttribute('id');
      expect(activeTab).toHaveAttribute('aria-controls', panelId);
    });

    it('should update aria-labelledby when active tab changes', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      await user.click(settingsTab);

      const panel = screen.getByRole('tabpanel');
      const settingsTabId = settingsTab.getAttribute('id');
      expect(panel).toHaveAttribute('aria-labelledby', settingsTabId);
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate to next tab with ArrowRight', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
            { id: 'history', label: 'History' },
          ]}
        />
      );

      // Focus first tab
      const firstTab = screen.getByRole('tab', { name: 'Details' });
      firstTab.focus();

      // Press ArrowRight
      await user.keyboard('{ArrowRight}');

      // Second tab should be focused and selected
      const secondTab = screen.getByRole('tab', { name: 'Settings' });
      expect(secondTab).toHaveFocus();
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should navigate to previous tab with ArrowLeft', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
            { id: 'history', label: 'History' },
          ]}
        />
      );

      // Click second tab to select it
      const secondTab = screen.getByRole('tab', { name: 'Settings' });
      await user.click(secondTab);

      // Press ArrowLeft
      await user.keyboard('{ArrowLeft}');

      // First tab should be focused and selected
      const firstTab = screen.getByRole('tab', { name: 'Details' });
      expect(firstTab).toHaveFocus();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap from last to first tab with ArrowRight', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      // Click last tab
      const lastTab = screen.getByRole('tab', { name: 'Settings' });
      await user.click(lastTab);

      // Press ArrowRight (should wrap to first)
      await user.keyboard('{ArrowRight}');

      const firstTab = screen.getByRole('tab', { name: 'Details' });
      expect(firstTab).toHaveFocus();
    });

    it('should wrap from first to last tab with ArrowLeft', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      // Focus first tab
      const firstTab = screen.getByRole('tab', { name: 'Details' });
      firstTab.focus();

      // Press ArrowLeft (should wrap to last)
      await user.keyboard('{ArrowLeft}');

      const lastTab = screen.getByRole('tab', { name: 'Settings' });
      expect(lastTab).toHaveFocus();
    });

    it('should move focus to panel content with Tab key', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
          renderTabContent={(tabId) => (
            <div>
              <button data-testid={`${tabId}-button`}>Action</button>
            </div>
          )}
        />
      );

      // Focus first tab
      const firstTab = screen.getByRole('tab', { name: 'Details' });
      firstTab.focus();

      // Press Tab to move to panel content
      await user.keyboard('{Tab}');

      // Focus should move to first focusable element in panel
      const panelButton = screen.getByTestId('details-button');
      expect(panelButton).toHaveFocus();
    });

    it('should activate tab with Enter or Space', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      // Focus second tab without clicking
      const secondTab = screen.getByRole('tab', { name: 'Settings' });
      secondTab.focus();

      // Press Enter
      await user.keyboard('{Enter}');

      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should jump to first tab with Home key', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
            { id: 'history', label: 'History' },
          ]}
        />
      );

      // Click last tab
      const lastTab = screen.getByRole('tab', { name: 'History' });
      await user.click(lastTab);

      // Press Home
      await user.keyboard('{Home}');

      const firstTab = screen.getByRole('tab', { name: 'Details' });
      expect(firstTab).toHaveFocus();
    });

    it('should jump to last tab with End key', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
            { id: 'history', label: 'History' },
          ]}
        />
      );

      // Focus first tab
      const firstTab = screen.getByRole('tab', { name: 'Details' });
      firstTab.focus();

      // Press End
      await user.keyboard('{End}');

      const lastTab = screen.getByRole('tab', { name: 'History' });
      expect(lastTab).toHaveFocus();
    });
  });

  describe('tab tabindex', () => {
    it('should have tabindex=0 on active tab only', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tabs = screen.getAllByRole('tab');

      // Active tab (first) should have tabindex=0
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
      // Inactive tabs should have tabindex=-1
      expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    });

    it('should update tabindex when active tab changes', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      );

      const tabs = screen.getAllByRole('tab');

      // Click second tab
      await user.click(tabs[1]);

      // Now second tab should have tabindex=0
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });
  });

  describe('without tabs prop', () => {
    it('should not render tablist when tabs prop is not provided', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
        />
      );

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    it('should not render tabpanel when tabs prop is not provided', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
        />
      );

      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    });
  });

  describe('disabled tabs', () => {
    it('should have aria-disabled="true" on disabled tabs', () => {
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings', disabled: true },
          ]}
        />
      );

      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      expect(settingsTab).toHaveAttribute('aria-disabled', 'true');
    });

    it('should skip disabled tabs during keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings', disabled: true },
            { id: 'history', label: 'History' },
          ]}
        />
      );

      // Focus first tab
      const firstTab = screen.getByRole('tab', { name: 'Details' });
      firstTab.focus();

      // Press ArrowRight - should skip disabled tab and go to History
      await user.keyboard('{ArrowRight}');

      const historyTab = screen.getByRole('tab', { name: 'History' });
      expect(historyTab).toHaveFocus();
    });

    it('should not activate disabled tab on click', async () => {
      const user = userEvent.setup();
      render(
        <EntityView
          schema={testSchema}
          entityId="entity-123"
          apiPath="/api/entities"
          tabs={[
            { id: 'details', label: 'Details' },
            { id: 'settings', label: 'Settings', disabled: true },
          ]}
        />
      );

      const settingsTab = screen.getByRole('tab', { name: 'Settings' });
      await user.click(settingsTab);

      // First tab should still be selected
      const detailsTab = screen.getByRole('tab', { name: 'Details' });
      expect(detailsTab).toHaveAttribute('aria-selected', 'true');
      expect(settingsTab).toHaveAttribute('aria-selected', 'false');
    });
  });
});
