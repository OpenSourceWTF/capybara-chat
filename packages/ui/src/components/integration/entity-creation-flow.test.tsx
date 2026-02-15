/**
 * Integration tests for Entity Creation Flow
 *
 * Tests the full flow from slash command → editor → save
 * These tests verify that all components are properly wired together.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInputBar } from '../chat/MessageInputBar';
import { DocumentsLibrary } from '../library/DocumentsLibrary';
import type { ParsedCommand } from '../../lib/slash-command-parser';
import { SERVER_DEFAULTS } from '@capybara-chat/types';

// Mock SocketContext to avoid socket connection issues in tests
vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    connected: false,
    agentStatus: 'offline',
    processingSessions: new Set(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
  SocketProvider: ({ children }: { children: React.ReactNode }) => children,
}));


// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Entity Creation Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slash Command Integration in MessageInputBar', () => {
    it('should detect slash commands and call onSlashCommand callback', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      const onSlashCommand = vi.fn();

      render(
        <MessageInputBar
          onSend={onSend}
          onSlashCommand={onSlashCommand}
        />
      );

      const textarea = screen.getByTestId('message-input');
      await user.type(textarea, '/create prompt');
      await user.keyboard('{Enter}');

      // Should call onSlashCommand instead of onSend
      expect(onSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'new',
          entityType: 'prompt',
        })
      );
      expect(onSend).not.toHaveBeenCalled();
    });

    it('should send regular messages normally', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      const onSlashCommand = vi.fn();

      render(
        <MessageInputBar
          onSend={onSend}
          onSlashCommand={onSlashCommand}
        />
      );

      const textarea = screen.getByTestId('message-input');
      await user.type(textarea, 'Hello, world!');
      await user.keyboard('{Enter}');

      expect(onSend).toHaveBeenCalledWith('Hello, world!');
      expect(onSlashCommand).not.toHaveBeenCalled();
    });

    it('should show autocomplete suggestions when typing /', async () => {
      const user = userEvent.setup();

      render(
        <MessageInputBar
          onSend={vi.fn()}
          onSlashCommand={vi.fn()}
        />
      );

      const textarea = screen.getByTestId('message-input');
      await user.type(textarea, '/');

      // Should show autocomplete dropdown
      await waitFor(() => {
        expect(screen.getByTestId('slash-command-autocomplete')).toBeInTheDocument();
      });
    });

    it('should support /new alias for /create', async () => {
      const user = userEvent.setup();
      const onSlashCommand = vi.fn();

      render(
        <MessageInputBar
          onSend={vi.fn()}
          onSlashCommand={onSlashCommand}
        />
      );

      const textarea = screen.getByTestId('message-input');
      await user.type(textarea, '/new document');
      await user.keyboard('{Enter}');

      expect(onSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'new',
          entityType: 'document',
        })
      );
    });

    it('should support /edit command with entity ID (colon format)', async () => {
      const user = userEvent.setup();
      const onSlashCommand = vi.fn();

      render(
        <MessageInputBar
          onSend={vi.fn()}
          onSlashCommand={onSlashCommand}
        />
      );

      const textarea = screen.getByTestId('message-input');
      // Parser expects colon-separated IDs: /edit type:id
      await user.type(textarea, '/edit prompt:abc123');
      await user.keyboard('{Enter}');

      expect(onSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'edit',
          entityType: 'prompt',
          entityId: 'abc123',
        })
      );
    });
  });

  describe('DocumentsLibrary Integration', () => {
    it('should render documents list from API', async () => {
      const mockDocuments = {
        documents: [
          { id: 'doc-1', name: 'First Doc', content: 'Content 1', tags: [], status: 'published', updatedAt: Date.now() },
          { id: 'doc-2', name: 'Second Doc', content: 'Content 2', tags: ['api'], status: 'draft', updatedAt: Date.now() },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockDocuments })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: [] }) });

      render(
        <DocumentsLibrary
          serverUrl={SERVER_DEFAULTS.SERVER_URL}
          onDocumentSelect={vi.fn()}
          onNewDocument={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('First Doc')).toBeInTheDocument();
        expect(screen.getByText('Second Doc')).toBeInTheDocument();
      });
    });

    it('should call onNewDocument when New Document button is clicked', async () => {
      const user = userEvent.setup();
      const onNewDocument = vi.fn();

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ documents: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: [] }) });

      render(
        <DocumentsLibrary
          serverUrl={SERVER_DEFAULTS.SERVER_URL}
          onNewDocument={onNewDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('new-documents-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('new-documents-button'));
      expect(onNewDocument).toHaveBeenCalled();
    });

    it('should call onDocumentSelect when a document card is clicked', async () => {
      const user = userEvent.setup();
      const onDocumentSelect = vi.fn();

      const mockDocuments = {
        documents: [
          { id: 'doc-1', name: 'Click Me', content: 'Content', tags: [], status: 'published', updatedAt: Date.now() },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockDocuments })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: [] }) });

      render(
        <DocumentsLibrary
          serverUrl={SERVER_DEFAULTS.SERVER_URL}
          onDocumentSelect={onDocumentSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Click Me')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('document-card-doc-1'));
      expect(onDocumentSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'doc-1', name: 'Click Me' })
      );
    });

    it('should show draft badge for draft documents', async () => {
      const mockDocuments = {
        documents: [
          { id: 'doc-1', name: 'Draft Doc', content: 'Content', tags: [], status: 'draft', updatedAt: Date.now() },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockDocuments })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: [] }) });

      render(<DocumentsLibrary serverUrl={SERVER_DEFAULTS.SERVER_URL} />);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
      });
    });
  });

  describe('Full Flow: Slash Command → Editor', () => {
    it('should parse command and determine correct editor to open', async () => {
      const user = userEvent.setup();
      const onSlashCommand = vi.fn();

      // Step 1: Parse slash command
      render(
        <MessageInputBar onSend={vi.fn()} onSlashCommand={onSlashCommand} />
      );

      const textarea = screen.getByTestId('message-input');
      await user.type(textarea, '/create prompt');
      await user.keyboard('{Enter}');

      expect(onSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'new', entityType: 'prompt' })
      );

      // The command would be used by App.tsx to navigate to the entity URL
      const command = onSlashCommand.mock.calls[0][0] as ParsedCommand;
      expect(command.entityType).toBe('prompt');
      expect(command.action).toBe('new');
    });

    it('should handle document creation flow', async () => {
      const user = userEvent.setup();
      const onSlashCommand = vi.fn();

      render(
        <MessageInputBar onSend={vi.fn()} onSlashCommand={onSlashCommand} />
      );

      const textarea = screen.getByTestId('message-input');
      await user.type(textarea, '/new document');
      await user.keyboard('{Enter}');

      expect(onSlashCommand).toHaveBeenCalled();
      const command = onSlashCommand.mock.calls[0][0] as ParsedCommand;
      expect(command.entityType).toBe('document');
      expect(command.action).toBe('new');
    });

    it('should handle edit flow with entity ID (colon format)', async () => {
      const user = userEvent.setup();
      const onSlashCommand = vi.fn();

      render(
        <MessageInputBar onSend={vi.fn()} onSlashCommand={onSlashCommand} />
      );

      const textarea = screen.getByTestId('message-input');
      // Parser expects colon-separated IDs: /edit type:id
      await user.type(textarea, '/edit spec:my-spec-id');
      await user.keyboard('{Enter}');

      expect(onSlashCommand).toHaveBeenCalled();
      const command = onSlashCommand.mock.calls[0][0] as ParsedCommand;
      expect(command.entityType).toBe('spec');
      expect(command.action).toBe('edit');
      expect(command.entityId).toBe('my-spec-id');
    });
  });
});
