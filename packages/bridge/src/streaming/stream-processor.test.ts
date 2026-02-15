/**
 * Stream Processor Tests
 *
 * Tests the core streaming loop that processes Claude SDK messages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processClaudeStream } from './stream-processor.js';
import type { StreamEventHooks, StreamProcessorConfig } from './types.js';

// Helper to create an async generator from messages
async function* createMockStream(messages: Array<{ type: string; content?: string; data?: unknown; total_cost_usd?: number }>) {
  for (const msg of messages) {
    yield msg;
  }
}

describe('Stream Processor', () => {
  const baseConfig: StreamProcessorConfig = {
    sessionId: 'test-session',
    messageId: 'test-message',
    createdAt: Date.now(),
  };

  describe('message accumulation', () => {
    it('should accumulate message content', async () => {
      const stream = createMockStream([
        { type: 'message', content: 'Hello' },
        { type: 'message', content: 'World' },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.content).toBe('Hello World');
      expect(result.wasAborted).toBe(false);
    });

    it('should handle messages with line breaks', async () => {
      const stream = createMockStream([
        { type: 'message', content: 'Line 1\n' },
        { type: 'message', content: 'Line 2' },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.content).toBe('Line 1\nLine 2');
    });

    it('should skip empty message content', async () => {
      const stream = createMockStream([
        { type: 'message', content: 'Hello' },
        { type: 'message', content: '' },
        { type: 'message' }, // no content
        { type: 'message', content: 'World' },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.content).toBe('Hello World');
    });
  });

  describe('session_init handling', () => {
    it('should capture claudeSessionId from session_init', async () => {
      const stream = createMockStream([
        { type: 'session_init', data: { claudeSessionId: 'claude-123' } },
        { type: 'message', content: 'Response' },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.claudeSessionId).toBe('claude-123');
    });

    it('should call onSessionInit hook', async () => {
      const onSessionInit = vi.fn();
      const stream = createMockStream([
        { type: 'session_init', data: { claudeSessionId: 'claude-456' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onSessionInit });

      expect(onSessionInit).toHaveBeenCalledWith({ claudeSessionId: 'claude-456' });
    });

    it('should ignore session_init without claudeSessionId', async () => {
      const onSessionInit = vi.fn();
      const stream = createMockStream([
        { type: 'session_init', data: {} },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig, { onSessionInit });

      expect(result.claudeSessionId).toBeUndefined();
      expect(onSessionInit).not.toHaveBeenCalled();
    });
  });

  describe('tool events', () => {
    it('should call onToolUse hook with correct data', async () => {
      const onToolUse = vi.fn();
      const stream = createMockStream([
        {
          type: 'tool_use',
          data: {
            toolUseId: 'tool-1',
            toolName: 'Read',
            input: { path: '/test' },
            parentToolUseId: null,
          },
        },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onToolUse });

      expect(onToolUse).toHaveBeenCalledWith({
        toolUseId: 'tool-1',
        toolName: 'Read',
        input: { path: '/test' },
        parentToolUseId: null,
      });
    });

    it('should call onToolProgress hook', async () => {
      const onToolProgress = vi.fn();
      const stream = createMockStream([
        {
          type: 'tool_progress',
          data: {
            toolUseId: 'tool-1',
            toolName: 'Bash',
            elapsedSeconds: 5,
          },
        },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onToolProgress });

      expect(onToolProgress).toHaveBeenCalledWith({
        toolUseId: 'tool-1',
        toolName: 'Bash',
        elapsedSeconds: 5,
      });
    });

    it('should call onToolResult hook with output', async () => {
      const onToolResult = vi.fn();
      const stream = createMockStream([
        {
          type: 'tool_result',
          data: {
            toolUseId: 'tool-1',
            output: 'Command completed',
            timestamp: 1234567890,
          },
        },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onToolResult });

      expect(onToolResult).toHaveBeenCalledWith({
        toolUseId: 'tool-1',
        output: 'Command completed',
        error: undefined,
        timestamp: 1234567890,
      });
    });

    it('should ignore tool_use without required fields', async () => {
      const onToolUse = vi.fn();
      const stream = createMockStream([
        { type: 'tool_use', data: { toolUseId: 'tool-1' } }, // missing toolName
        { type: 'tool_use', data: { toolName: 'Read' } }, // missing toolUseId
        { type: 'tool_use', data: {} },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onToolUse });

      expect(onToolUse).not.toHaveBeenCalled();
    });
  });

  describe('thinking handling', () => {
    it('should call onThinking hook with thinking content', async () => {
      const onThinking = vi.fn();
      const stream = createMockStream([
        { type: 'thinking', data: { content: 'Let me analyze this problem step by step...' } },
        { type: 'message', content: 'Here is my answer.' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onThinking });

      expect(onThinking).toHaveBeenCalledOnce();
      expect(onThinking).toHaveBeenCalledWith('Let me analyze this problem step by step...');
    });

    it('should not call onThinking for empty content', async () => {
      const onThinking = vi.fn();
      const stream = createMockStream([
        { type: 'thinking', data: { content: '' } },
        { type: 'thinking', data: {} },
        { type: 'thinking' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onThinking });

      expect(onThinking).not.toHaveBeenCalled();
    });

    it('should call onThinking multiple times for multiple thinking blocks', async () => {
      const onThinking = vi.fn();
      const stream = createMockStream([
        { type: 'thinking', data: { content: 'First thought' } },
        { type: 'thinking', data: { content: 'Second thought' } },
        { type: 'message', content: 'Final answer.' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onThinking });

      expect(onThinking).toHaveBeenCalledTimes(2);
      expect(onThinking).toHaveBeenNthCalledWith(1, 'First thought');
      expect(onThinking).toHaveBeenNthCalledWith(2, 'Second thought');
    });
  });

  describe('result handling', () => {
    it('should capture cost from result data', async () => {
      const stream = createMockStream([
        { type: 'result', data: { cost: 0.0025 } },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.cost).toBe(0.0025);
    });

    it('should capture cost from total_cost_usd', async () => {
      const stream = createMockStream([
        { type: 'result', total_cost_usd: 0.005 },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.cost).toBe(0.005);
    });

    it('should capture result text by default', async () => {
      const stream = createMockStream([
        { type: 'result', data: { result: 'Subagent output here' } },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.content).toBe('Subagent output here');
    });

    it('should append result text to accumulated content', async () => {
      const stream = createMockStream([
        { type: 'message', content: 'Main response' },
        { type: 'result', data: { result: 'Additional output' } },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      expect(result.content).toContain('Main response');
      expect(result.content).toContain('Additional output');
    });

    it('should skip result text capture when disabled', async () => {
      const stream = createMockStream([
        { type: 'result', data: { result: 'Should not appear' } },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, {
        ...baseConfig,
        captureResultText: false,
      });

      expect(result.content).toBe('');
    });

    it('should not duplicate result text if already in accumulated', async () => {
      const stream = createMockStream([
        { type: 'message', content: 'Same text' },
        { type: 'result', data: { result: 'Same text' } },
        { type: 'complete' },
      ]);

      const result = await processClaudeStream(stream, baseConfig);

      // Should not have duplicate
      expect(result.content.split('Same text').length - 1).toBe(1);
    });

    it('should call onResult hook', async () => {
      const onResult = vi.fn();
      const stream = createMockStream([
        { type: 'result', data: { cost: 0.001, result: 'Done' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onResult });

      expect(onResult).toHaveBeenCalledWith({
        cost: 0.001,
        result: 'Done',
      });
    });
  });

  describe('complete and error handling', () => {
    it('should call onComplete hook', async () => {
      const onComplete = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Done' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onComplete });

      expect(onComplete).toHaveBeenCalled();
    });

    it('should throw on error messages', async () => {
      const onError = vi.fn();
      const stream = createMockStream([
        { type: 'error', content: 'Something went wrong' },
      ]);

      await expect(processClaudeStream(stream, baseConfig, { onError }))
        .rejects.toThrow('Something went wrong');

      expect(onError).toHaveBeenCalledWith('Something went wrong');
    });

    it('should use default error message', async () => {
      const stream = createMockStream([
        { type: 'error' },
      ]);

      await expect(processClaudeStream(stream, baseConfig))
        .rejects.toThrow('Unknown error');
    });
  });

  describe('abort signal', () => {
    it('should stop processing when aborted', async () => {
      const abortController = new AbortController();
      const onMessageChunk = vi.fn();

      // Create a longer stream
      const stream = createMockStream([
        { type: 'message', content: 'First' },
        { type: 'message', content: 'Second' },
        { type: 'message', content: 'Third' },
        { type: 'complete' },
      ]);

      // Abort after first message processing
      abortController.abort();

      const result = await processClaudeStream(
        stream,
        { ...baseConfig, abortSignal: abortController.signal },
        { onMessageChunk }
      );

      expect(result.wasAborted).toBe(true);
    });

    it('should not call onFinalContent when aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const onFinalContent = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Content' },
        { type: 'complete' },
      ]);

      await processClaudeStream(
        stream,
        { ...baseConfig, abortSignal: abortController.signal },
        { onFinalContent }
      );

      expect(onFinalContent).not.toHaveBeenCalled();
    });
  });

  describe('streaming hooks', () => {
    it('should call onMessageChunk with chunk and accumulated', async () => {
      const onMessageChunk = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Hello' },
        { type: 'message', content: 'World' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onMessageChunk });

      expect(onMessageChunk).toHaveBeenCalledTimes(2);
      expect(onMessageChunk).toHaveBeenNthCalledWith(1, 'Hello', 'Hello');
      expect(onMessageChunk).toHaveBeenNthCalledWith(2, 'World', 'Hello World');
    });

    it('should call onStreamingEmit with accumulated content', async () => {
      const onStreamingEmit = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'A' },
        { type: 'message', content: 'B' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onStreamingEmit });

      expect(onStreamingEmit).toHaveBeenCalledTimes(2);
      expect(onStreamingEmit).toHaveBeenNthCalledWith(1, 'A');
      expect(onStreamingEmit).toHaveBeenNthCalledWith(2, 'A B');
    });

    it('should call onStreamingEmit after result text capture (132-tool-splits-messages audit fix)', async () => {
      // CRITICAL: This test verifies the fix for subagent output being invisible during streaming.
      // When result text is captured (e.g., from Task tool / subagent), onStreamingEmit MUST be called
      // so the UI sees the content and message splitting can occur.
      const onStreamingEmit = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Before tool' },
        { type: 'tool_use', data: { toolUseId: 'tool-1', toolName: 'Task' } },
        { type: 'result', data: { result: 'Subagent output' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onStreamingEmit });

      // Should be called twice: once for message, once for result text
      expect(onStreamingEmit).toHaveBeenCalledTimes(2);
      expect(onStreamingEmit).toHaveBeenNthCalledWith(1, 'Before tool');
      expect(onStreamingEmit).toHaveBeenNthCalledWith(2, 'Before tool\nSubagent output');
    });

    it('should call onStreamingEmit for result-only streams (no prior message)', async () => {
      // Edge case: Claude uses a subagent immediately with no preamble text
      const onStreamingEmit = vi.fn();
      const stream = createMockStream([
        { type: 'tool_use', data: { toolUseId: 'tool-1', toolName: 'Task' } },
        { type: 'result', data: { result: 'Only subagent output' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onStreamingEmit });

      expect(onStreamingEmit).toHaveBeenCalledTimes(1);
      expect(onStreamingEmit).toHaveBeenCalledWith('Only subagent output');
    });

    it('should call onFinalContent with final accumulated content', async () => {
      const onFinalContent = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Final content' },
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onFinalContent });

      expect(onFinalContent).toHaveBeenCalledWith('Final content');
    });

    it('should not call onFinalContent with empty content', async () => {
      const onFinalContent = vi.fn();
      const stream = createMockStream([
        { type: 'complete' },
      ]);

      await processClaudeStream(stream, baseConfig, { onFinalContent });

      expect(onFinalContent).not.toHaveBeenCalled();
    });
  });

  describe('onStreamActivity callback (137-idle-timeout)', () => {
    it('should call onStreamActivity for every stream message', async () => {
      const onStreamActivity = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Hello' },
        { type: 'tool_use', data: { toolUseId: 'tool-1', toolName: 'Read' } },
        { type: 'tool_result', data: { toolUseId: 'tool-1', output: 'file content' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(
        stream,
        { ...baseConfig, onStreamActivity }
      );

      expect(onStreamActivity).toHaveBeenCalledTimes(4);
      expect(onStreamActivity).toHaveBeenNthCalledWith(1, 'message');
      expect(onStreamActivity).toHaveBeenNthCalledWith(2, 'tool_use');
      expect(onStreamActivity).toHaveBeenNthCalledWith(3, 'tool_result');
      expect(onStreamActivity).toHaveBeenNthCalledWith(4, 'complete');
    });

    it('should call onStreamActivity for session_init', async () => {
      const onStreamActivity = vi.fn();
      const stream = createMockStream([
        { type: 'session_init', data: { claudeSessionId: 'claude-123' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(
        stream,
        { ...baseConfig, onStreamActivity }
      );

      expect(onStreamActivity).toHaveBeenCalledWith('session_init');
    });

    it('should call onStreamActivity for tool_progress', async () => {
      const onStreamActivity = vi.fn();
      const stream = createMockStream([
        { type: 'tool_progress', data: { toolUseId: 'tool-1', toolName: 'Task', elapsedSeconds: 30 } },
        { type: 'complete' },
      ]);

      await processClaudeStream(
        stream,
        { ...baseConfig, onStreamActivity }
      );

      expect(onStreamActivity).toHaveBeenCalledWith('tool_progress');
    });

    it('should call onStreamActivity for result', async () => {
      const onStreamActivity = vi.fn();
      const stream = createMockStream([
        { type: 'result', data: { cost: 0.001, result: 'Done' } },
        { type: 'complete' },
      ]);

      await processClaudeStream(
        stream,
        { ...baseConfig, onStreamActivity }
      );

      expect(onStreamActivity).toHaveBeenCalledWith('result');
    });

    it('should not call onStreamActivity after abort', async () => {
      const abortController = new AbortController();
      abortController.abort(); // Pre-abort
      const onStreamActivity = vi.fn();
      const stream = createMockStream([
        { type: 'message', content: 'Should not trigger activity' },
        { type: 'complete' },
      ]);

      await processClaudeStream(
        stream,
        { ...baseConfig, abortSignal: abortController.signal, onStreamActivity }
      );

      // Should not be called because abort check happens before activity notification
      expect(onStreamActivity).not.toHaveBeenCalled();
    });

    it('should work without onStreamActivity callback (optional)', async () => {
      const stream = createMockStream([
        { type: 'message', content: 'Hello' },
        { type: 'complete' },
      ]);

      // Should not throw when onStreamActivity is not provided
      const result = await processClaudeStream(stream, baseConfig);
      expect(result.content).toBe('Hello');
    });
  });
});
