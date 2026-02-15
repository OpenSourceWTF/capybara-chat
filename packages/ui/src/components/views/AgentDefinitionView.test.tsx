/**
 * Tests for AgentDefinitionView - Agent definition viewer/editor component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentDefinitionView } from './AgentDefinitionView';
import { EntityStatus, AgentDefinitionRole } from '@capybara-chat/types';

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
      name: 'Test Agent',
      slug: 'test-agent',
      description: 'A test agent',
      systemPrompt: '# System Prompt',
      systemPromptSegmentId: null,
      role: AgentDefinitionRole.ASSISTANT,
      tags: 'test',
      skills: 'python',
      allowedTools: ['Read', 'Write'],
      mcpServers: [],
      subagents: [],
      prefilledConversation: [],
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

const mockAgentDefinition = {
  id: 'agent-123',
  name: 'Test Agent Name',
  slug: 'test-agent',
  description: 'A helpful test agent for testing.',
  systemPromptSegmentId: null,
  role: AgentDefinitionRole.ASSISTANT,
  skills: ['python', 'analysis'],
  tags: ['test', 'agent'],
  status: EntityStatus.PUBLISHED,
  isSystem: false,
  isDefault: true,
  prefilledConversation: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  agentContext: {
    systemPrompt: '# Test System Prompt\n\nYou are a **helpful** assistant.\n\n- Be polite\n- Be accurate',
    allowedTools: ['Read', 'Write', 'Bash'],
    model: 'sonnet',
    mcpServers: [{ name: 'test-mcp', command: 'test' }],
    subagents: { 'sub-agent-1': { name: 'Sub Agent' } },
  },
};

describe('AgentDefinitionView', () => {
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

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render agent name', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent Name')).toBeInTheDocument();
      });
    });

    it('should render slug', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('SLUG::')).toBeInTheDocument();
        expect(screen.getByText('test-agent')).toBeInTheDocument();
      });
    });

    it('should render role', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('ROLE::')).toBeInTheDocument();
        expect(screen.getByText(`[${AgentDefinitionRole.ASSISTANT}]`)).toBeInTheDocument();
      });
    });

    it('should render isDefault badge when true', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('[DEFAULT]')).toBeInTheDocument();
      });
    });

    it('should render description', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('A helpful test agent for testing.')).toBeInTheDocument();
      });
    });

    it('should render skills', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('SKILLS::')).toBeInTheDocument();
        expect(screen.getByText('[python]')).toBeInTheDocument();
        expect(screen.getByText('[analysis]')).toBeInTheDocument();
      });
    });

    it('should render tags', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('TAGS::')).toBeInTheDocument();
        // Tags render with brackets, use getAllByText since "test" may appear multiple times
        expect(screen.getAllByText('test').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('agent').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render allowed tools', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('TOOLS::')).toBeInTheDocument();
        expect(screen.getByText('[Read]')).toBeInTheDocument();
        expect(screen.getByText('[Write]')).toBeInTheDocument();
        expect(screen.getByText('[Bash]')).toBeInTheDocument();
      });
    });

    it('should render MCP servers', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('MCP_SERVERS [1]')).toBeInTheDocument();
        expect(screen.getByText('test-mcp')).toBeInTheDocument();
      });
    });

    it('should render subagents', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('SUBAGENTS [1]')).toBeInTheDocument();
        expect(screen.getByText('sub-agent-1')).toBeInTheDocument();
      });
    });

    it('should render system prompt section', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('SYSTEM_PROMPT::')).toBeInTheDocument();
      });
    });

    it('should render prefilled conversation section (collapsible)', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('PREFILLED_CONVERSATION [2 messages]')).toBeInTheDocument();
      });
    });
  });

  describe('markdown rendering', () => {
    it('should render system prompt with markdown', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        // Check that markdown rendering container is present
        const container = document.querySelector('.prose');
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('model badge', () => {
    it('should render model badge in metadata', async () => {
      const { useFetch } = await import('../../hooks/useFetch');
      vi.mocked(useFetch).mockReturnValue({
        data: mockAgentDefinition,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AgentDefinitionView entityId="agent-123" initialMode="view" />);

      await waitFor(() => {
        expect(screen.getByText('[Claude Sonnet 4.5]')).toBeInTheDocument();
      });
    });
  });
});
