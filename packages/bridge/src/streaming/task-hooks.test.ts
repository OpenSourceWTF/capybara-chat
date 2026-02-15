/**
 * Task Hooks Tests
 *
 * Tests the hook factory for background task execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskHooks, type TaskHooksConfig } from './task-hooks.js';
import { SOCKET_EVENTS } from '@capybara-chat/types';

// Mock socket
function createMockSocket() {
  return {
    emit: vi.fn(),
  };
}

describe('Task Hooks', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let baseConfig: TaskHooksConfig;

  beforeEach(() => {
    mockSocket = createMockSocket();
    baseConfig = {
      socket: mockSocket as unknown as TaskHooksConfig['socket'],
      taskId: 'task-123',
      capybaraSessionId: 'session-456',
      messageId: 'msg-789',
      createdAt: 1234567890,
    };
  });

  describe('onMessageChunk', () => {
    it('should emit TASK_OUTPUT delta', () => {
      const hooks = createTaskHooks(baseConfig);
      const before = Date.now();

      hooks.onMessageChunk!('chunk content', 'accumulated');

      const after = Date.now();

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_OUTPUT, {
        taskId: 'task-123',
        content: 'chunk content',
        type: 'delta',
        timestamp: expect.any(Number),
      });

      // Verify timestamp is reasonable
      const timestamp = (mockSocket.emit.mock.calls[0][1] as { timestamp: number }).timestamp;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('onStreamingEmit', () => {
    it('should emit SESSION_RESPONSE for session persistence', () => {
      const hooks = createTaskHooks(baseConfig);

      hooks.onStreamingEmit!('accumulated content');

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_RESPONSE, {
        sessionId: 'session-456', // capybaraSessionId
        message: {
          id: 'msg-789',
          content: 'accumulated content',
          role: 'assistant',
          streaming: true,
          createdAt: 1234567890,
        },
      });
    });
  });

  describe('onSessionInit', () => {
    it('should call async onClaudeSessionCapture callback', async () => {
      const onClaudeSessionCapture = vi.fn().mockResolvedValue(undefined);
      const hooks = createTaskHooks({ ...baseConfig, onClaudeSessionCapture });

      await hooks.onSessionInit!({ claudeSessionId: 'claude-abc' });

      expect(onClaudeSessionCapture).toHaveBeenCalledWith('claude-abc');
    });

    it('should work without callback', async () => {
      const hooks = createTaskHooks(baseConfig);

      // Should not throw
      await hooks.onSessionInit!({ claudeSessionId: 'claude-abc' });
    });
  });

  describe('onToolUse', () => {
    it('should emit SESSION_TOOL_USE with capybaraSessionId', () => {
      const hooks = createTaskHooks(baseConfig);

      hooks.onToolUse!({
        toolUseId: 'tool-1',
        toolName: 'Bash',
        input: { command: 'ls' },
        parentToolUseId: 'parent-1',
        timestamp: 9999999999,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: 'session-456', // capybaraSessionId, not taskId
        toolUseId: 'tool-1',
        toolName: 'Bash',
        input: { command: 'ls' },
        parentToolUseId: 'parent-1',
        timestamp: 9999999999,
        messageId: 'msg-789',  // 131-tool-embedding
      });
    });

    it('should use Date.now() fallback when no timestamp', () => {
      const hooks = createTaskHooks(baseConfig);
      const before = Date.now();

      hooks.onToolUse!({
        toolUseId: 'tool-1',
        toolName: 'Read',
      });

      const after = Date.now();
      const emittedTimestamp = (mockSocket.emit.mock.calls[0][1] as { timestamp: number }).timestamp;
      expect(emittedTimestamp).toBeGreaterThanOrEqual(before);
      expect(emittedTimestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('onToolProgress', () => {
    it('should emit SESSION_TOOL_USE with elapsed time', () => {
      const hooks = createTaskHooks(baseConfig);

      hooks.onToolProgress!({
        toolUseId: 'tool-1',
        toolName: 'Edit',
        elapsedSeconds: 3,
        parentToolUseId: null,
        timestamp: 8888888888,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: 'session-456',
        toolUseId: 'tool-1',
        toolName: 'Edit',
        parentToolUseId: null,
        elapsedMs: 3000, // Converted from seconds
        timestamp: 8888888888,
        messageId: 'msg-789',  // 131-tool-embedding
      });
    });

    it('should use legacy tool field if toolName not present', () => {
      const hooks = createTaskHooks(baseConfig);

      hooks.onToolProgress!({
        tool: 'LegacyTool',
        toolUseId: 'tool-1',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: 'session-456',
        toolUseId: 'tool-1',
        toolName: 'LegacyTool',
        parentToolUseId: undefined,
        elapsedMs: undefined,
        timestamp: expect.any(Number),
        messageId: 'msg-789',  // 131-tool-embedding
      });
    });
  });

  describe('onToolResult', () => {
    it('should emit SESSION_TOOL_USE with output', () => {
      const hooks = createTaskHooks(baseConfig);

      hooks.onToolResult!({
        toolUseId: 'tool-1',
        output: { result: 'success' },
        timestamp: 7777777777,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_TOOL_USE, {
        sessionId: 'session-456',
        toolUseId: 'tool-1',
        toolName: '', // Not available in tool_result
        output: { result: 'success' },
        error: undefined,
        timestamp: 7777777777,
        messageId: 'msg-789',  // 131-tool-embedding
      });
    });

    it('should emit error field when present', () => {
      const hooks = createTaskHooks(baseConfig);

      hooks.onToolResult!({
        toolUseId: 'tool-1',
        output: null,
        error: 'Command failed',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_TOOL_USE,
        expect.objectContaining({
          error: 'Command failed',
        })
      );
    });
  });

  describe('onResult', () => {
    it('should emit SESSION_ACTIVITY tool_end', async () => {
      const hooks = createTaskHooks(baseConfig);

      await hooks.onResult!({ cost: 0.001 });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_ACTIVITY, {
        sessionId: 'session-456',
        activity: { type: 'tool_end', status: 'complete' },
      });
    });

    it('should emit TASK_COST_UPDATE and SESSION_COST when cost present', async () => {
      const onCostUpdate = vi.fn().mockResolvedValue(undefined);
      const hooks = createTaskHooks({ ...baseConfig, onCostUpdate });

      await hooks.onResult!({ cost: 0.0025 });

      expect(onCostUpdate).toHaveBeenCalledWith(0.0025);

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_COST_UPDATE, {
        taskId: 'task-123',
        cost: 0.0025,
        timestamp: expect.any(Number),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_COST, {
        sessionId: 'session-456',
        cost: 0.0025,
      });
    });

    it('should not emit cost events when cost undefined', async () => {
      const onCostUpdate = vi.fn();
      const hooks = createTaskHooks({ ...baseConfig, onCostUpdate });

      await hooks.onResult!({});

      expect(onCostUpdate).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        SOCKET_EVENTS.TASK_COST_UPDATE,
        expect.anything()
      );
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_COST,
        expect.anything()
      );
    });
  });

  describe('intentionally missing hooks', () => {
    it('should NOT have onFinalContent (handled by task-executor.ts)', () => {
      const hooks = createTaskHooks(baseConfig);

      expect(hooks.onFinalContent).toBeUndefined();
    });
  });

  describe('task vs bridge hook differences', () => {
    it('should have onMessageChunk (unlike bridge hooks)', () => {
      const hooks = createTaskHooks(baseConfig);

      expect(hooks.onMessageChunk).toBeDefined();
    });

    it('should use capybaraSessionId for session events, taskId for task events', () => {
      const hooks = createTaskHooks(baseConfig);

      // Session event uses capybaraSessionId
      hooks.onStreamingEmit!('test');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_RESPONSE,
        expect.objectContaining({ sessionId: 'session-456' })
      );

      // Task event uses taskId
      hooks.onMessageChunk!('test', 'test');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.TASK_OUTPUT,
        expect.objectContaining({ taskId: 'task-123' })
      );
    });
  });
});
