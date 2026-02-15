/**
 * Message Pipeline Tests
 *
 * Tests for MessagePipeline with:
 * - Timeout protection (GAP-023)
 * - Fail-fast error handling (GAP-020)
 * - AbortSignal cancellation (GAP-031)
 * - Stage contract validation (GAP-029)
 * - Lock safety (GAP-005)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagePipeline } from './message-pipeline.js';
import { SessionContextStore } from './session-context-store.js';
import { SessionConcurrencyManager } from '../concurrency.js';
import type { SessionContext } from './session-context.js';
import type { PipelineStage, BridgeDependencies } from './pipeline-stage.js';

describe('MessagePipeline', () => {
  let store: SessionContextStore;
  let concurrency: SessionConcurrencyManager;
  let ctx: SessionContext;
  let deps: BridgeDependencies;

  beforeEach(() => {
    store = new SessionContextStore();
    concurrency = new SessionConcurrencyManager();
    ctx = store.getOrCreate('sess-1');
    ctx.currentMessage = {
      id: 'msg-1',
      content: 'test message',
      createdAt: Date.now(),
    };

    // Mock dependencies
    deps = {
      socket: {} as any,
      assistantPool: {} as any,
      buildFullContext: vi.fn().mockResolvedValue('full context'),
      streamClaudeResponse: vi.fn().mockResolvedValue({
        messageId: 'msg-2',
        content: 'response',
        createdAt: Date.now(),
        contextUsage: { used: 1000, total: 10000, percent: 10 },
      }),
    };
  });

  describe('Basic execution', () => {
    it('should execute all stages successfully', async () => {
      const executionOrder: string[] = [];

      const stage1: PipelineStage = {
        name: 'stage1',
        execute: async (ctx) => {
          executionOrder.push('stage1');
          ctx.status = 'locked';
          return ctx;
        },
      };

      const stage2: PipelineStage = {
        name: 'stage2',
        execute: async (ctx) => {
          executionOrder.push('stage2');
          ctx.status = 'streaming';
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage1, stage2], concurrency, store);

      // Acquire lock first
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      const result = await pipeline.execute(ctx, deps);

      expect(executionOrder).toEqual(['stage1', 'stage2']);
      expect(result.status).toBe('streaming');
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'pipeline:start' })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'stage:stage1:start' })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'stage:stage1:complete' })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'pipeline:complete' })
      );
    });

    it('should update lastActivityAt after each stage', async () => {
      const initialActivity = ctx.lastActivityAt;

      const stage: PipelineStage = {
        name: 'stage',
        execute: async (ctx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      const result = await pipeline.execute(ctx, deps);

      expect(result.lastActivityAt).toBeGreaterThan(initialActivity);
    });
  });

  describe('Timeout protection (GAP-023)', () => {
    it('should timeout slow stage', async () => {
      const slowStage: PipelineStage = {
        name: 'slow',
        timeout: 100,
        execute: async (ctx, deps, log, signal) => {
          // Stage must check signal for cooperative cancellation
          const startTime = Date.now();
          while (Date.now() - startTime < 300) {
            await new Promise(resolve => setTimeout(resolve, 20));
            if (signal.aborted) {
              throw signal.reason || new Error('Aborted');
            }
          }
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([slowStage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      await expect(pipeline.execute(ctx, deps)).rejects.toThrow('timed out after 100ms');
    });

    it('should not timeout fast stage', async () => {
      const fastStage: PipelineStage = {
        name: 'fast',
        timeout: 1000,
        execute: async (ctx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          ctx.status = 'complete';
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([fastStage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      const result = await pipeline.execute(ctx, deps);
      expect(result.status).toBe('complete');
    });

    it('should use default timeout if not specified', async () => {
      const stage: PipelineStage = {
        name: 'stage',
        // No timeout specified, should use 120000ms default
        execute: async (ctx) => {
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      // Should not timeout for quick execution
      await expect(pipeline.execute(ctx, deps)).resolves.toBeDefined();
    });
  });

  describe('AbortSignal cancellation (GAP-031, GAP-034)', () => {
    it('should pass AbortSignal to all stages', async () => {
      const receivedSignals: AbortSignal[] = [];

      const stage: PipelineStage = {
        name: 'test',
        execute: async (ctx, deps, log, signal) => {
          receivedSignals.push(signal);
          expect(signal).toBeInstanceOf(AbortSignal);
          expect(signal.aborted).toBe(false);
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      await pipeline.execute(ctx, deps);

      expect(receivedSignals.length).toBe(1);
    });

    it('should abort signal on timeout', async () => {
      let capturedSignal: AbortSignal | undefined;

      const slowStage: PipelineStage = {
        name: 'slow',
        timeout: 100,
        execute: async (ctx, deps, log, signal) => {
          capturedSignal = signal;

          // Simulate checking signal in a loop
          for (let i = 0; i < 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 20));

            if (signal.aborted) {
              throw signal.reason || new Error('Aborted');
            }
          }

          return ctx;
        },
      };

      const pipeline = new MessagePipeline([slowStage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      await expect(pipeline.execute(ctx, deps)).rejects.toThrow('timed out after 100ms');
      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe('Error handling (GAP-020, GAP-005)', () => {
    it('should set status to error on failure', async () => {
      const failingStage: PipelineStage = {
        name: 'fail',
        execute: async () => {
          throw new Error('Stage failed');
        },
      };

      const pipeline = new MessagePipeline([failingStage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      try {
        await pipeline.execute(ctx, deps);
        // Should not reach here
      } catch (error: unknown) {
        // Expected - explicitly typed
      }

      const updatedCtx = store.get('sess-1');
      expect(updatedCtx?.status).toBe('error');
      expect(updatedCtx?.events).toContainEqual(
        expect.objectContaining({ type: 'pipeline:error' })
      );
    });

    it('should reject waiters on pipeline error (GAP-020 fail-fast)', async () => {
      // First message acquires lock
      const msg1Data = { sessionId: 'sess-1', content: 'msg1', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msg1Data);

      // Second message queues
      const msg2Data = { sessionId: 'sess-1', content: 'msg2', messageId: 'msg-2' };
      const waiterResult = concurrency.acquireLock('sess-1', msg2Data);
      expect(waiterResult.acquired).toBe(false);

      // Pipeline fails
      const failingStage: PipelineStage = {
        name: 'fail',
        execute: async () => {
          throw new Error('Stage failed');
        },
      };
      const pipeline = new MessagePipeline([failingStage], concurrency, store);

      try {
        await pipeline.execute(ctx, deps);
      } catch {
        // Expected
      }

      // Waiter should be rejected (fail-fast) - actual error message from clearSession
      await expect(waiterResult.waitPromise).rejects.toThrow('Session sess-1 was cleared while messages were pending');
    });

    it('should always release lock in finally block (GAP-005)', async () => {
      const failingStage: PipelineStage = {
        name: 'fail',
        execute: async () => {
          throw new Error('Stage failed');
        },
      };

      const pipeline = new MessagePipeline([failingStage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'msg', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      try {
        await pipeline.execute(ctx, deps);
      } catch {
        // Expected
      }

      // Lock should be released (use isProcessing instead of isLocked)
      expect(concurrency.isProcessing('sess-1')).toBe(false);
    });

    it('should release lock on success', async () => {
      const stage: PipelineStage = {
        name: 'stage',
        execute: async (ctx) => {
          ctx.status = 'complete';
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'msg', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      await pipeline.execute(ctx, deps);

      // Lock should be released (use isProcessing instead of isLocked)
      expect(concurrency.isProcessing('sess-1')).toBe(false);
    });
  });

  describe('Stage contract validation (GAP-029)', () => {
    it('should throw if stage corrupts sessionId', async () => {
      const executionOrder: string[] = [];

      const stage1: PipelineStage = {
        name: 'stage1',
        execute: async (ctx) => {
          executionOrder.push('stage1');
          ctx.status = 'locked';
          return ctx;
        },
      };

      const badStage: PipelineStage = {
        name: 'bad',
        execute: async (ctx) => {
          executionOrder.push('bad');
          // Corrupt sessionId
          return { ...ctx, sessionId: 'corrupted' } as SessionContext;
        },
      };

      const stage3: PipelineStage = {
        name: 'stage3',
        execute: async (ctx) => {
          executionOrder.push('stage3'); // Should never reach here
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage1, badStage, stage3], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      await expect(pipeline.execute(ctx, deps)).rejects.toThrow('Stage bad corrupted sessionId');

      // Stage3 should not have executed
      expect(executionOrder).toEqual(['stage1', 'bad']);
    });
  });

  describe('Context updates (GAP-025)', () => {
    it('should update store after every stage', async () => {
      const updateSpy = vi.spyOn(store, 'update');

      const stage1: PipelineStage = {
        name: 'stage1',
        execute: async (ctx) => {
          ctx.status = 'locked';
          return ctx;
        },
      };

      const stage2: PipelineStage = {
        name: 'stage2',
        execute: async (ctx) => {
          ctx.status = 'streaming';
          return ctx;
        },
      };

      const pipeline = new MessagePipeline([stage1, stage2], concurrency, store);
      const msgData = { sessionId: 'sess-1', content: 'test', messageId: 'msg-1' };
      concurrency.acquireLock('sess-1', msgData);

      await pipeline.execute(ctx, deps);

      // Should update after each stage (2 times) plus once on error (not called in success)
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });
  });
});
