/**
 * useSessionMessages Hook Tests
 *
 * TDD Verification for GAP-008: Tools visible during streaming disappear after page reload.
 *
 * These tests verify that embedToolsInMessages() correctly:
 * 1. Embeds tools in their parent messages by messageId
 * 2. Handles orphaned tools (messageId but no matching message)
 * 3. Handles legacy tools without messageId
 *
 * Test Strategy: Level 4 (UI Hook Verification)
 * Tests the embedding logic in isolation with mock data.
 */

import { describe, it, expect } from 'vitest';
import { embedToolsInMessages, type TimelineItem, type UIChatMessage, type ToolUseItem } from './useSessionMessages';

describe('GAP-008: embedToolsInMessages', () => {
  /**
   * Test: Tools with messageId should be embedded in their parent message.
   * This is the happy path - tool has messageId, message exists.
   */
  it('should embed tools in messages by messageId', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'message',
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'assistant',
        content: 'Test response',
        createdAt: 1000,
      } as UIChatMessage & { itemType: 'message' },
      {
        itemType: 'tool_use',
        id: 'toolu_123',
        sessionId: 'sess-001',
        toolName: 'Read',
        input: { file_path: '/test' },
        output: 'file contents',
        status: 'complete',
        timestamp: 1001,
        createdAt: 1001,
        messageId: 'msg-001', // Links to message
      } as ToolUseItem & { messageId: string },
    ];

    const processed = embedToolsInMessages(rawTimeline);

    // Message should have embedded tool
    const message = processed.find(
      (item): item is UIChatMessage & { itemType: 'message' } =>
        item.itemType === 'message' && item.id === 'msg-001'
    );
    expect(message).toBeDefined();
    expect(message!.toolUses).toBeDefined();
    expect(message!.toolUses!.length).toBe(1);
    expect(message!.toolUses![0].id).toBe('toolu_123');
    expect(message!.toolUses![0].toolName).toBe('Read');
    expect(message!.toolUses![0].output).toBe('file contents');

    // Tool should NOT appear as separate item in timeline
    const separateTool = processed.find(
      item => item.itemType === 'tool_use' && item.id === 'toolu_123'
    );
    expect(separateTool).toBeUndefined();
  });

  /**
   * Test: Multiple tools should all be embedded in the same message.
   * Messages can have many tool uses during a conversation turn.
   */
  it('should embed multiple tools in the same message', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'message',
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'assistant',
        content: 'Reading multiple files...',
        createdAt: 1000,
      } as UIChatMessage & { itemType: 'message' },
      {
        itemType: 'tool_use',
        id: 'toolu_1',
        sessionId: 'sess-001',
        toolName: 'Read',
        input: { file_path: '/file1.ts' },
        output: 'contents 1',
        status: 'complete',
        timestamp: 1001,
        createdAt: 1001,
        messageId: 'msg-001',
      } as ToolUseItem & { messageId: string },
      {
        itemType: 'tool_use',
        id: 'toolu_2',
        sessionId: 'sess-001',
        toolName: 'Read',
        input: { file_path: '/file2.ts' },
        output: 'contents 2',
        status: 'complete',
        timestamp: 1002,
        createdAt: 1002,
        messageId: 'msg-001',
      } as ToolUseItem & { messageId: string },
      {
        itemType: 'tool_use',
        id: 'toolu_3',
        sessionId: 'sess-001',
        toolName: 'Bash',
        input: { command: 'ls' },
        output: 'output',
        status: 'complete',
        timestamp: 1003,
        createdAt: 1003,
        messageId: 'msg-001',
      } as ToolUseItem & { messageId: string },
    ];

    const processed = embedToolsInMessages(rawTimeline);

    const message = processed.find(
      (item): item is UIChatMessage & { itemType: 'message' } =>
        item.itemType === 'message' && item.id === 'msg-001'
    );
    expect(message).toBeDefined();
    expect(message!.toolUses).toBeDefined();
    expect(message!.toolUses!.length).toBe(3);
    expect(message!.toolUses!.map(t => t.id)).toEqual(['toolu_1', 'toolu_2', 'toolu_3']);
  });

  /**
   * Test: Orphaned tools (messageId exists but message doesn't) should appear standalone.
   * This can happen if:
   * - Message wasn't persisted (e.g., streaming interrupted)
   * - Message was deleted
   * - Database inconsistency
   * We MUST NOT lose these tools - they should appear as standalone items.
   */
  it('should handle orphaned tools (messageId but no matching message)', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'tool_use',
        id: 'toolu_123',
        sessionId: 'sess-001',
        toolName: 'Read',
        input: { file_path: '/test' },
        output: 'file contents',
        status: 'complete',
        timestamp: 1000,
        createdAt: 1000,
        messageId: 'msg-nonexistent', // Message doesn't exist
      } as ToolUseItem & { messageId: string },
    ];

    const processed = embedToolsInMessages(rawTimeline);

    // Orphaned tool should appear as standalone item
    const tool = processed.find(
      item => item.itemType === 'tool_use' && item.id === 'toolu_123'
    );
    expect(tool).toBeDefined();
    expect(tool!.itemType).toBe('tool_use');
  });

  /**
   * Test: Tools without messageId (legacy) should appear as standalone items.
   * This handles backwards compatibility with tools created before messageId tracking.
   */
  it('should handle tools without messageId (legacy)', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'tool_use',
        id: 'toolu_legacy',
        sessionId: 'sess-001',
        toolName: 'Read',
        input: { file_path: '/test' },
        status: 'complete',
        timestamp: 1000,
        createdAt: 1000,
        // NO messageId - legacy tool
      } as ToolUseItem,
    ];

    const processed = embedToolsInMessages(rawTimeline);

    // Legacy tool should appear as standalone item
    const tool = processed.find(
      item => item.itemType === 'tool_use' && item.id === 'toolu_legacy'
    );
    expect(tool).toBeDefined();
    expect(tool!.itemType).toBe('tool_use');
  });

  /**
   * Test: Mixed scenario with embedded, orphaned, and legacy tools.
   * Real-world timelines may have all three types.
   */
  it('should handle mixed embedded, orphaned, and legacy tools', () => {
    const rawTimeline: TimelineItem[] = [
      // Message with tool
      {
        itemType: 'message',
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'assistant',
        content: 'Response 1',
        createdAt: 1000,
      } as UIChatMessage & { itemType: 'message' },
      {
        itemType: 'tool_use',
        id: 'toolu_embedded',
        sessionId: 'sess-001',
        toolName: 'Read',
        input: { file_path: '/test' },
        status: 'complete',
        timestamp: 1001,
        createdAt: 1001,
        messageId: 'msg-001', // Will be embedded
      } as ToolUseItem & { messageId: string },
      // Orphaned tool (message doesn't exist)
      {
        itemType: 'tool_use',
        id: 'toolu_orphan',
        sessionId: 'sess-001',
        toolName: 'Bash',
        input: { command: 'pwd' },
        status: 'complete',
        timestamp: 1002,
        createdAt: 1002,
        messageId: 'msg-deleted', // Message doesn't exist
      } as ToolUseItem & { messageId: string },
      // Legacy tool (no messageId)
      {
        itemType: 'tool_use',
        id: 'toolu_legacy',
        sessionId: 'sess-001',
        toolName: 'Write',
        input: { file_path: '/out' },
        status: 'complete',
        timestamp: 1003,
        createdAt: 1003,
        // No messageId
      } as ToolUseItem,
    ];

    const processed = embedToolsInMessages(rawTimeline);

    // Embedded tool should be in message
    const message = processed.find(
      (item): item is UIChatMessage & { itemType: 'message' } =>
        item.itemType === 'message' && item.id === 'msg-001'
    );
    expect(message).toBeDefined();
    expect(message!.toolUses).toBeDefined();
    expect(message!.toolUses!.length).toBe(1);
    expect(message!.toolUses![0].id).toBe('toolu_embedded');

    // Orphaned tool should be standalone
    const orphan = processed.find(
      item => item.itemType === 'tool_use' && item.id === 'toolu_orphan'
    );
    expect(orphan).toBeDefined();

    // Legacy tool should be standalone
    const legacy = processed.find(
      item => item.itemType === 'tool_use' && item.id === 'toolu_legacy'
    );
    expect(legacy).toBeDefined();
  });

  /**
   * Test: Timeline should be sorted by createdAt after processing.
   * This ensures correct display order regardless of arrival order.
   */
  it('should sort timeline by createdAt', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'message',
        id: 'msg-002',
        sessionId: 'sess-001',
        role: 'assistant',
        content: 'Later message',
        createdAt: 2000, // Later
      } as UIChatMessage & { itemType: 'message' },
      {
        itemType: 'message',
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'user',
        content: 'Earlier message',
        createdAt: 1000, // Earlier
      } as UIChatMessage & { itemType: 'message' },
    ];

    const processed = embedToolsInMessages(rawTimeline);

    expect(processed[0].id).toBe('msg-001');
    expect(processed[1].id).toBe('msg-002');
  });

  /**
   * Test: Events should pass through unchanged.
   * Events (like context_injected) are not affected by tool embedding.
   */
  it('should preserve events in timeline', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'event',
        id: 'evt-001',
        sessionId: 'sess-001',
        type: 'context_injected',
        metadata: { entityType: 'spec' },
        createdAt: 1000,
      } as TimelineItem,
      {
        itemType: 'message',
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'assistant',
        content: 'Response',
        createdAt: 1001,
      } as UIChatMessage & { itemType: 'message' },
    ];

    const processed = embedToolsInMessages(rawTimeline);

    const event = processed.find(item => item.itemType === 'event');
    expect(event).toBeDefined();
    expect(event!.id).toBe('evt-001');
  });

  /**
   * Test: Tools are embedded with all their properties preserved.
   * input, output, error, elapsedMs, parentToolUseId, status, timestamp
   */
  it('should preserve all tool properties when embedding', () => {
    const rawTimeline: TimelineItem[] = [
      {
        itemType: 'message',
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'assistant',
        content: 'Response',
        createdAt: 1000,
      } as UIChatMessage & { itemType: 'message' },
      {
        itemType: 'tool_use',
        id: 'toolu_123',
        sessionId: 'sess-001',
        toolName: 'Task',
        input: { prompt: 'do something', subagent_type: 'Explore' },
        output: 'task result',
        error: undefined,
        elapsedMs: 5000,
        parentToolUseId: 'toolu_parent',
        status: 'complete',
        timestamp: 1001,
        createdAt: 1001,
        messageId: 'msg-001',
      } as ToolUseItem & { messageId: string },
    ];

    const processed = embedToolsInMessages(rawTimeline);

    const message = processed.find(
      (item): item is UIChatMessage & { itemType: 'message' } =>
        item.itemType === 'message'
    );
    const embeddedTool = message!.toolUses![0];

    expect(embeddedTool.id).toBe('toolu_123');
    expect(embeddedTool.toolName).toBe('Task');
    expect(embeddedTool.input).toEqual({ prompt: 'do something', subagent_type: 'Explore' });
    expect(embeddedTool.output).toBe('task result');
    expect(embeddedTool.elapsedMs).toBe(5000);
    expect(embeddedTool.parentToolUseId).toBe('toolu_parent');
    expect(embeddedTool.status).toBe('complete');
    expect(embeddedTool.timestamp).toBe(1001);
  });
});
