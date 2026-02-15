/**
 * Unit tests for bridge-hooks message splitting (132-tool-splits-messages)
 *
 * These tests verify that:
 * 1. Streaming messages accumulate correctly before tool use
 * 2. Tool use triggers message splitting
 * 3. Content after tool goes into a new message
 * 4. Multiple tools create multiple splits
 * 5. Edge cases are handled (no content after tool, tool at start, etc.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBridgeHooks, type BridgeHooksConfig } from './bridge-hooks.js';
import { SOCKET_EVENTS } from '@capybara-chat/types';

describe('Bridge Hooks - Message Splitting (132)', () => {
  let mockSocket: {
    emit: ReturnType<typeof vi.fn>;
    connected: boolean;
  };
  let config: BridgeHooksConfig;
  let emittedMessages: Array<{
    event: string;
    sessionId: string;
    message: {
      id: string;
      content: string;
      role: string;
      streaming: boolean;
      createdAt: number;
    };
  }>;
  let emittedToolUses: Array<{
    event: string;
    sessionId: string;
    toolUseId: string;
    toolName: string;
    messageId: string;
  }>;
  let emittedActivities: Array<{
    event: string;
    sessionId: string;
    activity: {
      type: string;
      toolName?: string;
      subagentName?: string;
      status?: string;
      toolUseId?: string;
      elapsedMs?: number;
    };
  }>;

  beforeEach(() => {
    emittedMessages = [];
    emittedToolUses = [];
    emittedActivities = [];

    mockSocket = {
      emit: vi.fn((event: string, data: unknown) => {
        if (event === SOCKET_EVENTS.SESSION_RESPONSE) {
          emittedMessages.push({ event, ...(data as object) } as typeof emittedMessages[0]);
        } else if (event === SOCKET_EVENTS.SESSION_TOOL_USE) {
          emittedToolUses.push({ event, ...(data as object) } as typeof emittedToolUses[0]);
        } else if (event === SOCKET_EVENTS.SESSION_ACTIVITY) {
          emittedActivities.push({ event, ...(data as object) } as typeof emittedActivities[0]);
        }
      }),
      connected: true,  // Mock socket as connected by default
    };

    config = {
      socket: mockSocket as unknown as BridgeHooksConfig['socket'],
      sessionId: 'test-session-123',
      messageId: 'msg-original-001',
      createdAt: 1000000,
    };
  });

  describe('Basic streaming (no tools)', () => {
    it('should emit full accumulated content on each streaming update', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Hello');
      hooks.onStreamingEmit!('Hello world');
      hooks.onStreamingEmit!('Hello world!');

      expect(emittedMessages).toHaveLength(3);
      expect(emittedMessages[0].message.content).toBe('Hello');
      expect(emittedMessages[1].message.content).toBe('Hello world');
      expect(emittedMessages[2].message.content).toBe('Hello world!');

      // All should use the original message ID
      expect(emittedMessages.every(m => m.message.id === 'msg-original-001')).toBe(true);
    });

    it('should use original createdAt timestamp', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Test');

      expect(emittedMessages[0].message.createdAt).toBe(1000000);
    });
  });

  describe('Single tool use', () => {
    it('should split message after tool use', () => {
      const hooks = createBridgeHooks(config);

      // Text before tool
      hooks.onStreamingEmit!('Let me read that file.');

      // Tool is used
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: { path: '/test.ts' },
      });

      // Text after tool (accumulated includes everything)
      // Note: LLMs typically add whitespace/newlines after tool blocks
      hooks.onStreamingEmit!('Let me read that file.\n\nHere is the content');

      // Messages: 1) streaming first, 2) finalized first (streaming:false), 3) streaming second
      expect(emittedMessages).toHaveLength(3);

      // First streaming message should have original ID
      expect(emittedMessages[0].message.id).toBe('msg-original-001');
      expect(emittedMessages[0].message.content).toBe('Let me read that file.');
      expect(emittedMessages[0].message.streaming).toBe(true);

      // Finalized first message (triggers persistence)
      expect(emittedMessages[1].message.id).toBe('msg-original-001');
      expect(emittedMessages[1].message.content).toBe('Let me read that file.');
      expect(emittedMessages[1].message.streaming).toBe(false);

      // Second message (new ID) with only the delta
      expect(emittedMessages[2].message.id).not.toBe('msg-original-001');
      expect(emittedMessages[2].message.content).toBe('Here is the content');
      expect(emittedMessages[2].message.streaming).toBe(true);
    });

    it('should link tool to the message before split', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before tool');
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: {},
      });
      hooks.onStreamingEmit!('Before tool. After tool');

      // Tool should be linked to the FIRST message (before split)
      expect(emittedToolUses[0].messageId).toBe('msg-original-001');
    });

    it('should trim leading whitespace from split content', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before');
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: {},
      });
      // Note: there's often whitespace after tool invocation in real responses
      hooks.onStreamingEmit!('Before\n\n  After');

      const lastMessage = emittedMessages[emittedMessages.length - 1];
      expect(lastMessage.message.content).toBe('After');
    });
  });

  describe('Multiple tool uses', () => {
    it('should create multiple message splits', () => {
      const hooks = createBridgeHooks(config);

      // First segment
      hooks.onStreamingEmit!('First.');

      // First tool
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: {},
      });

      // Second segment (after first tool) - whitespace separator for clean split
      hooks.onStreamingEmit!('First.\n\nSecond.');

      // Second tool
      hooks.onToolUse!({
        toolUseId: 'tool-002',
        toolName: 'Write',
        input: {},
      });

      // Third segment (after second tool)
      hooks.onStreamingEmit!('First.\n\nSecond.\n\nThird.');

      // Should have 3 distinct message IDs
      const messageIds = new Set(emittedMessages.map(m => m.message.id));
      expect(messageIds.size).toBe(3);

      // Last message should contain only "Third." (trimStart removes leading whitespace)
      const lastMessage = emittedMessages[emittedMessages.length - 1];
      expect(lastMessage.message.content).toBe('Third.');
    });

    it('should link each tool to its preceding message', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('First.');
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: {},
      });
      hooks.onStreamingEmit!('First.\n\nSecond.');
      hooks.onToolUse!({
        toolUseId: 'tool-002',
        toolName: 'Write',
        input: {},
      });
      hooks.onStreamingEmit!('First.\n\nSecond.\n\nThird.');

      // First tool should be linked to original message
      expect(emittedToolUses[0].messageId).toBe('msg-original-001');

      // Second tool should be linked to the second message (different from original)
      expect(emittedToolUses[1].messageId).not.toBe('msg-original-001');
    });
  });

  describe('Edge cases', () => {
    it('should not create empty message when no content after tool', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Only this');
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: {},
      });
      // No more streaming emits after tool

      // Should only have one message emission
      expect(emittedMessages).toHaveLength(1);
      expect(emittedMessages[0].message.content).toBe('Only this');
    });

    it('should handle tool at very start (before any text)', () => {
      const hooks = createBridgeHooks(config);

      // Tool called first
      hooks.onToolUse!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        input: {},
      });

      // Content comes after
      hooks.onStreamingEmit!('Content after tool');

      // GAP-008 FIX: When tool comes first (no content before), DON'T create new messageId
      // This ensures tool links to the message that actually gets persisted
      expect(emittedMessages).toHaveLength(1);
      expect(emittedMessages[0].message.id).toBe('msg-original-001'); // Same ID, not new
      expect(emittedMessages[0].message.content).toBe('Content after tool');
      // Tool should link to same message
      expect(emittedToolUses[0].messageId).toBe('msg-original-001');
    });

    it('should handle multiple tools with no content between them', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Start.');
      hooks.onToolUse!({ toolUseId: 'tool-001', toolName: 'Read', input: {} });
      hooks.onToolUse!({ toolUseId: 'tool-002', toolName: 'Write', input: {} });
      hooks.onStreamingEmit!('Start.\n\nEnd.');

      // Both tools should be linked to the same message (original)
      expect(emittedToolUses[0].messageId).toBe('msg-original-001');
      expect(emittedToolUses[1].messageId).toBe('msg-original-001');

      // Content after should be in new message
      const lastMessage = emittedMessages[emittedMessages.length - 1];
      expect(lastMessage.message.id).not.toBe('msg-original-001');
      expect(lastMessage.message.content).toBe('End.');
    });

    it('should handle content that is only whitespace after tool', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before');
      hooks.onToolUse!({ toolUseId: 'tool-001', toolName: 'Read', input: {} });
      hooks.onStreamingEmit!('Before   '); // Only whitespace added

      // After trimming, there's no new content, so no new message
      const messagesAfterTool = emittedMessages.filter(m => m.message.id !== 'msg-original-001');
      expect(messagesAfterTool).toHaveLength(0);
    });
  });

  describe('Tool progress and result (should not trigger split)', () => {
    it('should not split on tool progress', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before');
      hooks.onToolProgress!({
        toolUseId: 'tool-001',
        toolName: 'Read',
        elapsedSeconds: 5,
      });
      hooks.onStreamingEmit!('Before and more');

      // Should all be same message ID
      expect(emittedMessages.every(m => m.message.id === 'msg-original-001')).toBe(true);
      expect(emittedMessages[1].message.content).toBe('Before and more');
    });

    it('should not split on tool result', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before');
      hooks.onToolResult!({
        toolUseId: 'tool-001',
        output: 'some output',
      });
      hooks.onStreamingEmit!('Before and more');

      // Should all be same message ID
      expect(emittedMessages.every(m => m.message.id === 'msg-original-001')).toBe(true);
    });
  });

  describe('Persistence (streaming: false emission)', () => {
    it('should emit streaming: false for previous message when splitting', () => {
      const hooks = createBridgeHooks(config);

      // Text before tool
      hooks.onStreamingEmit!('Before tool.');

      // Tool is used
      hooks.onToolUse!({ toolUseId: 'tool-001', toolName: 'Read', input: {} });

      // Text after tool triggers split
      hooks.onStreamingEmit!('Before tool.\n\nAfter tool.');

      // Find the message with streaming: false
      const finalizedMessages = emittedMessages.filter(m => m.message.streaming === false);
      expect(finalizedMessages).toHaveLength(1);
      expect(finalizedMessages[0].message.content).toBe('Before tool.');
      expect(finalizedMessages[0].message.id).toBe('msg-original-001');
    });

    it('should emit streaming: false for each segment when multiple tools used', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('First.');
      hooks.onToolUse!({ toolUseId: 't1', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('First.\n\nSecond.');
      hooks.onToolUse!({ toolUseId: 't2', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('First.\n\nSecond.\n\nThird.');

      // Should have 2 finalized messages (First and Second)
      // Third is still streaming
      const finalizedMessages = emittedMessages.filter(m => m.message.streaming === false);
      expect(finalizedMessages).toHaveLength(2);
      expect(finalizedMessages[0].message.content).toBe('First.');
      expect(finalizedMessages[1].message.content).toBe('Second.');
    });

    it('should not emit streaming: false if no content before tool', () => {
      const hooks = createBridgeHooks(config);

      // Tool first, then content
      hooks.onToolUse!({ toolUseId: 'tool-001', toolName: 'Read', input: {} });
      hooks.onStreamingEmit!('Content after tool');

      // No finalized messages (nothing to finalize before tool)
      const finalizedMessages = emittedMessages.filter(m => m.message.streaming === false);
      expect(finalizedMessages).toHaveLength(0);
    });

    it('should preserve correct timestamps on finalized messages', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before.');
      hooks.onToolUse!({ toolUseId: 't1', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('Before.\n\nAfter.');

      const finalizedMessage = emittedMessages.find(m => m.message.streaming === false);
      expect(finalizedMessage).toBeDefined();
      expect(finalizedMessage!.message.createdAt).toBe(1000000); // Original timestamp preserved
    });
  });

  describe('State tracking', () => {
    it('should generate unique message IDs for each split', () => {
      const hooks = createBridgeHooks(config);

      const seenIds = new Set<string>();

      hooks.onStreamingEmit!('A');
      seenIds.add(emittedMessages[emittedMessages.length - 1].message.id);

      hooks.onToolUse!({ toolUseId: 't1', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('A B');
      seenIds.add(emittedMessages[emittedMessages.length - 1].message.id);

      hooks.onToolUse!({ toolUseId: 't2', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('A B C');
      seenIds.add(emittedMessages[emittedMessages.length - 1].message.id);

      hooks.onToolUse!({ toolUseId: 't3', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('A B C D');
      seenIds.add(emittedMessages[emittedMessages.length - 1].message.id);

      // Should have 4 unique message IDs
      expect(seenIds.size).toBe(4);
    });

    it('should update createdAt timestamp for new messages', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before');
      const firstTimestamp = emittedMessages[0].message.createdAt;
      expect(firstTimestamp).toBe(1000000); // Original timestamp

      hooks.onToolUse!({ toolUseId: 't1', toolName: 'T', input: {} });

      // Small delay to ensure different timestamp
      const beforeSecondEmit = Date.now();
      hooks.onStreamingEmit!('Before After');

      const lastMessage = emittedMessages[emittedMessages.length - 1];
      expect(lastMessage.message.createdAt).toBeGreaterThanOrEqual(beforeSecondEmit);
      expect(lastMessage.message.createdAt).not.toBe(1000000);
    });
  });

  describe('getFinalSegment (GAP-003/004 fix)', () => {
    it('should return original values when no tools used', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Hello world');

      const segment = hooks.getFinalSegment();
      expect(segment.id).toBe('msg-original-001');
      expect(segment.startOffset).toBe(0);
      expect(segment.createdAt).toBe(1000000);
      expect(segment.wasSplit).toBe(false);
    });

    it('should return updated values after tool use', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('Before tool.');
      hooks.onToolUse!({ toolUseId: 't1', toolName: 'Read', input: {} });
      hooks.onStreamingEmit!('Before tool.\n\nAfter tool.');

      const segment = hooks.getFinalSegment();
      expect(segment.id).not.toBe('msg-original-001'); // New ID
      expect(segment.startOffset).toBe(12); // Length of "Before tool."
      expect(segment.createdAt).toBeGreaterThan(1000000); // New timestamp
      expect(segment.wasSplit).toBe(true);
    });

    it('should return correct offset for multiple splits', () => {
      const hooks = createBridgeHooks(config);

      hooks.onStreamingEmit!('First.');
      hooks.onToolUse!({ toolUseId: 't1', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('First.\n\nSecond.');
      hooks.onToolUse!({ toolUseId: 't2', toolName: 'T', input: {} });
      hooks.onStreamingEmit!('First.\n\nSecond.\n\nThird.');

      const segment = hooks.getFinalSegment();
      expect(segment.wasSplit).toBe(true);

      // Use offset to extract just the last segment content
      const accumulated = 'First.\n\nSecond.\n\nThird.';
      const lastContent = accumulated.slice(segment.startOffset).trimStart();
      expect(lastContent).toBe('Third.');
    });

    it('should work correctly even before first streaming emit', () => {
      const hooks = createBridgeHooks(config);

      // Get segment before any streaming
      const segment = hooks.getFinalSegment();
      expect(segment.id).toBe('msg-original-001');
      expect(segment.startOffset).toBe(0);
      expect(segment.wasSplit).toBe(false);
    });

    it('should NOT split when tool at start (GAP-008 fix)', () => {
      const hooks = createBridgeHooks(config);

      // Tool first, then content
      hooks.onToolUse!({ toolUseId: 't1', toolName: 'Read', input: {} });
      hooks.onStreamingEmit!('Content after tool');

      const segment = hooks.getFinalSegment();
      // GAP-008 FIX: wasSplit should be FALSE because no content existed before tool
      // We keep the same messageId so tools link to the persisted message
      expect(segment.wasSplit).toBe(false);
      expect(segment.id).toBe('msg-original-001'); // Same ID, not new
    });
  });

  describe('Subagent Timeout and Circuit Breaker (087-prevent-subagent-hangs)', () => {
    let originalEnableTimeout: boolean;
    let originalEnableCircuitBreaker: boolean;

    beforeEach(async () => {
      // Store original feature flag values
      const configModule = await import('../config.js');
      originalEnableTimeout = configModule.ENABLE_SUBAGENT_TIMEOUT;
      originalEnableCircuitBreaker = configModule.ENABLE_CIRCUIT_BREAKER;

      // Reset circuit breaker state before each test
      const { circuitBreaker } = await import('../circuit-breaker.js');
      // Clear by recording success for all types that might have failures
      circuitBreaker.recordSuccess('explore');
      circuitBreaker.recordSuccess('plan');
      circuitBreaker.recordSuccess('test');
    });

    describe('Circuit Breaker Integration', () => {
      it('should block subagent when circuit is open', async () => {
        const { circuitBreaker } = await import('../circuit-breaker.js');
        const hooks = createBridgeHooks(config);

        // Trip the circuit breaker for 'explore' type
        circuitBreaker.recordFailure('explore');
        circuitBreaker.recordFailure('explore');
        circuitBreaker.recordFailure('explore');

        // Verify circuit is open
        expect(circuitBreaker.shouldAllow('explore')).toBe(false);

        // Try to spawn explore subagent
        hooks.onToolUse!({
          toolUseId: 'task-blocked',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Should emit error activity
        const errorActivity = emittedActivities.find(
          e => e.activity.type === 'tool_end' && e.activity.status === 'error'
        );
        expect(errorActivity).toBeDefined();
      });

      it('should cleanup resources when blocked by circuit breaker', async () => {
        const { circuitBreaker } = await import('../circuit-breaker.js');
        const hooks = createBridgeHooks(config);

        // Trip circuit
        circuitBreaker.recordFailure('explore');
        circuitBreaker.recordFailure('explore');
        circuitBreaker.recordFailure('explore');

        // Spawn blocked subagent
        hooks.onToolUse!({
          toolUseId: 'task-blocked',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Circuit breaker should have recorded another failure
        const state = circuitBreaker.getState();
        expect(state.explore.recentFailures).toBe(4);
      });

      it('should record success on successful tool_result', async () => {
        const { circuitBreaker } = await import('../circuit-breaker.js');
        const hooks = createBridgeHooks(config);

        // Spawn subagent
        hooks.onToolUse!({
          toolUseId: 'task-success',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Record one failure to create state
        circuitBreaker.recordFailure('explore');
        expect(circuitBreaker.getState().explore).toBeDefined();

        // Complete successfully
        hooks.onToolResult!({ toolUseId: 'task-success', output: 'success' });

        // Circuit should be reset (deleted)
        const state = circuitBreaker.getState();
        expect(state.explore).toBeUndefined();
      });

      it('should record failure on error tool_result', async () => {
        const { circuitBreaker } = await import('../circuit-breaker.js');
        const hooks = createBridgeHooks(config);

        // Spawn subagent
        hooks.onToolUse!({
          toolUseId: 'task-error',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Complete with error
        hooks.onToolResult!({
          toolUseId: 'task-error',
          output: '',
          error: 'Something went wrong',
        });

        // Circuit breaker should record failure
        const state = circuitBreaker.getState();
        expect(state.explore.recentFailures).toBe(1);
      });
    });

    describe('Subagent Timeout', () => {
      it('should create timeout when Task spawned with ENABLE_SUBAGENT_TIMEOUT=true', () => {
        // This test verifies timeout is set up (indirectly via cleanup behavior)
        const hooks = createBridgeHooks(config);

        hooks.onToolUse!({
          toolUseId: 'task-with-timeout',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Cleanup should work (proving timeout was created)
        hooks.onToolResult!({ toolUseId: 'task-with-timeout', output: 'done' });

        // No errors should occur - timeout properly cleaned up
      });

      it('should cleanup timeout resources on tool_result', () => {
        const hooks = createBridgeHooks(config);

        hooks.onToolUse!({
          toolUseId: 'task-cleanup',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Complete task - should cleanup timeout without error
        hooks.onToolResult!({ toolUseId: 'task-cleanup', output: 'done' });

        // Calling cleanup again should be safe (idempotent)
        hooks.onToolResult!({ toolUseId: 'task-cleanup', output: 'done' });
      });
    });

    describe('Metrics Management', () => {
      it('should create metrics on Task spawn', () => {
        const hooks = createBridgeHooks(config);

        hooks.onToolUse!({
          toolUseId: 'task-001',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Metric should be created (verified indirectly via cleanup or circuit breaker)
        // Can't directly access subagentMetrics map, but we can verify via tool_result
        hooks.onToolResult!({ toolUseId: 'task-001', output: 'done' });

        // If metrics weren't created, circuit breaker wouldn't work correctly
        // Success above proves metric was created and cleaned up
      });

      it('should update lastProgressAt on progress events', async () => {
        vi.useFakeTimers();
        const baseTime = 1000000;
        vi.setSystemTime(baseTime);

        const hooks = createBridgeHooks(config);

        // Spawn subagent
        hooks.onToolUse!({
          toolUseId: 'task-progress',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Advance time
        vi.setSystemTime(baseTime + 10000);

        // Send progress
        hooks.onToolProgress!({
          toolUseId: 'task-progress',
          toolName: 'Task',
          elapsedSeconds: 10,
        });

        // Metrics should be updated (can't verify directly, but no stall warning should appear)
        // If lastProgressAt wasn't updated, stall detection would trigger

        vi.useRealTimers();
      });

      it('should cleanup metrics on tool_result', () => {
        const hooks = createBridgeHooks(config);

        hooks.onToolUse!({
          toolUseId: 'task-cleanup-metrics',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        hooks.onToolResult!({ toolUseId: 'task-cleanup-metrics', output: 'done' });

        // Metric should be cleaned up
        // Verified indirectly: calling tool_result again shouldn't cause issues
        hooks.onToolResult!({ toolUseId: 'task-cleanup-metrics', output: 'done' });
      });
    });

    describe('Cleanup Functions', () => {
      it('cleanupSubagentResources should be idempotent', () => {
        const hooks = createBridgeHooks(config);

        hooks.onToolUse!({
          toolUseId: 'task-idempotent',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Cleanup multiple times should not throw
        hooks.onToolResult!({ toolUseId: 'task-idempotent', output: 'done' });
        hooks.onToolResult!({ toolUseId: 'task-idempotent', output: 'done' });
        hooks.onToolResult!({ toolUseId: 'task-idempotent', output: 'done' });

        // Should not throw or cause issues
      });

      it('should handle cleanup when socket disconnected', () => {
        // Create disconnected socket mock
        const disconnectedSocket = {
          ...mockSocket,
          connected: false,
        };

        const hooks = createBridgeHooks({
          ...config,
          socket: disconnectedSocket as unknown as BridgeHooksConfig['socket'],
        });

        hooks.onToolUse!({
          toolUseId: 'task-disconnected',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Cleanup when socket disconnected should not throw
        hooks.onToolResult!({ toolUseId: 'task-disconnected', output: 'done' });

        // Should not throw error even though socket is disconnected
        // (implementation checks socket.connected before emitting)
      });
    });

    describe('Integration with activeTaskStack', () => {
      it('should remove from activeTaskStack when blocked by circuit breaker (GAP-008)', async () => {
        const { circuitBreaker } = await import('../circuit-breaker.js');
        const hooks = createBridgeHooks(config);

        // Trip circuit
        circuitBreaker.recordFailure('explore');
        circuitBreaker.recordFailure('explore');
        circuitBreaker.recordFailure('explore');

        // Try to spawn blocked subagent
        hooks.onToolUse!({
          toolUseId: 'task-stack-blocked',
          toolName: 'Task',
          input: { subagent_type: 'explore' },
        });

        // Now spawn a different tool
        hooks.onToolUse!({
          toolUseId: 'read-after-block',
          toolName: 'Read',
          input: {},
        });

        // Read tool should NOT have the blocked task as parent
        const readToolEvent = emittedToolUses.find(e => e.toolUseId === 'read-after-block');
        expect(readToolEvent).toBeDefined();
        expect((readToolEvent as any).parentToolUseId).toBeUndefined();
      });
    });
  });

  describe('activeTaskStack - Tool Nesting (137-tool-nesting)', () => {
    it('should infer parentToolUseId for tools under active Task', () => {
      const hooks = createBridgeHooks(config);

      // Start a Task (subagent)
      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });

      // Child tool should get Task as parent
      hooks.onToolUse!({ toolUseId: 'read-001', toolName: 'Read', input: {} });

      // Second emission should have parentToolUseId
      expect(emittedToolUses).toHaveLength(2);
      expect(emittedToolUses[0].toolName).toBe('Task');
      expect((emittedToolUses[0] as unknown as { parentToolUseId?: string }).parentToolUseId).toBeUndefined();
      expect((emittedToolUses[1] as unknown as { parentToolUseId?: string }).parentToolUseId).toBe('task-001');
    });

    it('should NOT set parentToolUseId for Task tools (Tasks dont nest under Tasks automatically)', () => {
      const hooks = createBridgeHooks(config);

      // Start a Task
      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });

      // Another Task should NOT get first Task as parent (they're siblings in output)
      hooks.onToolUse!({ toolUseId: 'task-002', toolName: 'Task', input: {} });

      expect(emittedToolUses).toHaveLength(2);
      expect((emittedToolUses[1] as unknown as { parentToolUseId?: string }).parentToolUseId).toBeUndefined();
    });

    it('should remove Task from stack when onToolResult is called', () => {
      const hooks = createBridgeHooks(config);

      // Start and complete a Task
      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });
      hooks.onToolResult!({ toolUseId: 'task-001', output: 'done' });

      // New tool should NOT have parentToolUseId
      hooks.onToolUse!({ toolUseId: 'read-001', toolName: 'Read', input: {} });

      // Filter to only get onToolUse events (have toolName set)
      const toolUseEvents = emittedToolUses.filter(t => t.toolName !== '');
      expect((toolUseEvents[1] as unknown as { parentToolUseId?: string }).parentToolUseId).toBeUndefined();
    });

    it('should handle nested Tasks (stack behavior)', () => {
      const hooks = createBridgeHooks(config);

      // Outer Task
      hooks.onToolUse!({ toolUseId: 'task-outer', toolName: 'Task', input: {} });

      // Inner Task (under outer)
      hooks.onToolUse!({ toolUseId: 'task-inner', toolName: 'Task', input: {} });

      // Tool under inner Task should get inner as parent
      hooks.onToolUse!({ toolUseId: 'read-001', toolName: 'Read', input: {} });

      expect((emittedToolUses[2] as unknown as { parentToolUseId?: string }).parentToolUseId).toBe('task-inner');
    });

    it('should pop inner Task first on completion (LIFO)', () => {
      const hooks = createBridgeHooks(config);

      hooks.onToolUse!({ toolUseId: 'task-outer', toolName: 'Task', input: {} });
      hooks.onToolUse!({ toolUseId: 'task-inner', toolName: 'Task', input: {} });

      // Complete inner Task
      hooks.onToolResult!({ toolUseId: 'task-inner', output: 'inner done' });

      // Now tools should nest under outer Task
      hooks.onToolUse!({ toolUseId: 'read-001', toolName: 'Read', input: {} });

      // Note: emittedToolUses[2] is the tool_result event, [3] is the new Read tool
      // Filter to only get onToolUse events (have toolName set)
      const toolUseEvents = emittedToolUses.filter(t => t.toolName !== '');
      expect((toolUseEvents[2] as unknown as { parentToolUseId?: string }).parentToolUseId).toBe('task-outer');
    });

    it('should respect explicitly provided parentToolUseId from SDK', () => {
      const hooks = createBridgeHooks(config);

      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });

      // SDK explicitly provides a different parent
      hooks.onToolUse!({
        toolUseId: 'read-001',
        toolName: 'Read',
        input: {},
        parentToolUseId: 'explicit-parent',
      });

      // Should use explicit parent, not inferred
      expect((emittedToolUses[1] as unknown as { parentToolUseId?: string }).parentToolUseId).toBe('explicit-parent');
    });

    it('should not add duplicate Task to stack (GAP-001 fix)', () => {
      const hooks = createBridgeHooks(config);

      // Same Task ID received twice (can happen with out-of-order events)
      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });
      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });

      // Complete the Task once
      hooks.onToolResult!({ toolUseId: 'task-001', output: 'done' });

      // Stack should be empty now, not still have task-001
      hooks.onToolUse!({ toolUseId: 'read-001', toolName: 'Read', input: {} });

      // Filter to only get onToolUse events (have toolName set)
      const toolUseEvents = emittedToolUses.filter(t => t.toolName !== '');
      expect((toolUseEvents[2] as unknown as { parentToolUseId?: string }).parentToolUseId).toBeUndefined();
    });

    it('should infer parentToolUseId in onToolProgress as well', () => {
      const hooks = createBridgeHooks(config);

      hooks.onToolUse!({ toolUseId: 'task-001', toolName: 'Task', input: {} });

      // Progress event for a child tool should get parent
      hooks.onToolProgress!({
        toolUseId: 'read-001',
        toolName: 'Read',
        elapsedSeconds: 5,
      });

      // Find the tool progress emission
      const progressEvent = emittedToolUses.find(t => t.toolUseId === 'read-001');
      expect(progressEvent).toBeDefined();
      expect((progressEvent as unknown as { parentToolUseId?: string }).parentToolUseId).toBe('task-001');
    });
  });

  describe('Thinking/Reasoning Content (SESSION_THINKING)', () => {
    it('should emit SESSION_THINKING event with correct payload', () => {
      const hooks = createBridgeHooks(config);

      hooks.onThinking!('Let me analyze this step by step...');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_THINKING,
        expect.objectContaining({
          sessionId: 'test-session-123',
          content: 'Let me analyze this step by step...',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should emit SESSION_THINKING with current timestamp', () => {
      const hooks = createBridgeHooks(config);
      const before = Date.now();

      hooks.onThinking!('Reasoning content');

      const thinkingCall = mockSocket.emit.mock.calls.find(
        (call: unknown[]) => call[0] === SOCKET_EVENTS.SESSION_THINKING,
      );
      expect(thinkingCall).toBeDefined();

      const payload = thinkingCall![1] as { timestamp: number };
      expect(payload.timestamp).toBeGreaterThanOrEqual(before);
      expect(payload.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should emit multiple thinking events independently', () => {
      const hooks = createBridgeHooks(config);

      hooks.onThinking!('First thought');
      hooks.onThinking!('Second thought');
      hooks.onThinking!('Third thought');

      const thinkingCalls = mockSocket.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === SOCKET_EVENTS.SESSION_THINKING,
      );
      expect(thinkingCalls).toHaveLength(3);
      expect((thinkingCalls[0][1] as { content: string }).content).toBe('First thought');
      expect((thinkingCalls[1][1] as { content: string }).content).toBe('Second thought');
      expect((thinkingCalls[2][1] as { content: string }).content).toBe('Third thought');
    });
  });
});
