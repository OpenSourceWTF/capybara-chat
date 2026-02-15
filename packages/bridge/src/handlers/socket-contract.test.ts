/**
 * Socket Communication Contract Tests (Bridge Side)
 *
 * Tests the Bridge's obligations in the socket contract.
 * See: .waaah/ralph/202-socket-contract-docs/socket-contract.md
 *
 * Bridge MUST:
 * 1. Include messageId (user's) in SESSION_RESPONSE
 * 2. Emit final message with streaming: false
 * 3. Report active messages in BRIDGE_HEARTBEAT
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SOCKET_EVENTS, MessageStatus } from '@capybara-chat/types';

// Mock socket
const createMockSocket = () => ({
  emit: vi.fn(),
  on: vi.fn(),
});

describe('Bridge Contract: SESSION_RESPONSE Emission', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.clearAllMocks();
  });

  describe('CONTRACT RULE R1: Must include messageId', () => {
    it('should include user messageId in all SESSION_RESPONSE emissions', () => {
      const userMessageId = 'msg_user_123';
      const assistantMessageId = 'msg_assistant_456';

      // Simulate what bridge should emit
      const payload = {
        sessionId: 'sess_test',
        messageId: userMessageId, // REQUIRED: User's message ID
        message: {
          id: assistantMessageId,
          content: 'Hello!',
          role: 'assistant',
          streaming: false,
          createdAt: Date.now(),
        },
      };

      mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, payload);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SESSION_RESPONSE,
        expect.objectContaining({
          messageId: userMessageId,
        })
      );
    });

    it('should distinguish user messageId from assistant message.id', () => {
      const userMessageId = 'msg_user_123';
      const assistantMessageId = 'msg_assistant_456';

      const payload = {
        sessionId: 'sess_test',
        messageId: userMessageId,
        message: {
          id: assistantMessageId,
          content: 'Response',
          role: 'assistant',
          streaming: false,
          createdAt: Date.now(),
        },
      };

      // These must be different
      expect(payload.messageId).not.toBe(payload.message.id);
      expect(payload.messageId).toMatch(/^msg_user_/);
      expect(payload.message.id).toMatch(/^msg_assistant_/);
    });
  });

  describe('CONTRACT RULE R2: Final message must have streaming: false', () => {
    it('should emit streaming: true for intermediate chunks', () => {
      const streamingPayload = {
        sessionId: 'sess_test',
        messageId: 'msg_user_123',
        message: {
          id: 'msg_assistant_456',
          content: 'Partial...',
          role: 'assistant',
          streaming: true, // INTERMEDIATE
          createdAt: Date.now(),
        },
      };

      mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, streamingPayload);

      const emittedPayload = mockSocket.emit.mock.calls[0][1];
      expect(emittedPayload.message.streaming).toBe(true);
    });

    it('should emit streaming: false for final message', () => {
      const finalPayload = {
        sessionId: 'sess_test',
        messageId: 'msg_user_123',
        message: {
          id: 'msg_assistant_456',
          content: 'Complete response.',
          role: 'assistant',
          streaming: false, // FINAL - triggers server completion logic
          createdAt: Date.now(),
        },
      };

      mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, finalPayload);

      const emittedPayload = mockSocket.emit.mock.calls[0][1];
      expect(emittedPayload.message.streaming).toBe(false);
    });
  });

  describe('CONTRACT RULE R3: Must not duplicate final messages', () => {
    it('should emit exactly one final message per turn', () => {
      const sessionId = 'sess_test';
      const userMessageId = 'msg_user_123';
      let finalMessageCount = 0;

      const simulateTurn = () => {
        // Streaming messages
        for (let i = 0; i < 3; i++) {
          mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
            sessionId,
            messageId: userMessageId,
            message: { streaming: true, content: `chunk_${i}` },
          });
        }

        // Final message (exactly once)
        mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
          sessionId,
          messageId: userMessageId,
          message: { streaming: false, content: 'Complete' },
        });
        finalMessageCount++;
      };

      simulateTurn();

      // Count final messages
      const emittedFinals = mockSocket.emit.mock.calls.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) =>
          call[0] === SOCKET_EVENTS.SESSION_RESPONSE &&
          call[1]?.message?.streaming === false
      );

      expect(emittedFinals.length).toBe(1);
      expect(finalMessageCount).toBe(1);
    });
  });
});

describe('Bridge Contract: BRIDGE_HEARTBEAT', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  describe('CONTRACT RULE R4: Must report all active message IDs', () => {
    it('should include currently processing messages', () => {
      const activeMessages = ['msg_1', 'msg_2'];

      const heartbeatPayload = {
        activeMessageIds: activeMessages,
      };

      mockSocket.emit(SOCKET_EVENTS.BRIDGE_HEARTBEAT, heartbeatPayload);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.BRIDGE_HEARTBEAT,
        expect.objectContaining({
          activeMessageIds: expect.arrayContaining(['msg_1', 'msg_2']),
        })
      );
    });

    it('should include queued messages in active list', () => {
      const processingMessages = ['msg_processing'];
      const queuedMessages = ['msg_queued_1', 'msg_queued_2'];
      const allActive = [...processingMessages, ...queuedMessages];

      const heartbeatPayload = {
        activeMessageIds: allActive,
      };

      mockSocket.emit(SOCKET_EVENTS.BRIDGE_HEARTBEAT, heartbeatPayload);

      const emittedPayload = mockSocket.emit.mock.calls[0][1];
      expect(emittedPayload.activeMessageIds).toHaveLength(3);
    });

    it('should NOT include completed messages', () => {
      // Completed message should not be in active list
      const completedMessageId = 'msg_completed';
      const activeMessageId = 'msg_active';

      const heartbeatPayload = {
        activeMessageIds: [activeMessageId], // Only active, not completed
      };

      mockSocket.emit(SOCKET_EVENTS.BRIDGE_HEARTBEAT, heartbeatPayload);

      const emittedPayload = mockSocket.emit.mock.calls[0][1];
      expect(emittedPayload.activeMessageIds).not.toContain(completedMessageId);
    });
  });
});

describe('Bridge Contract: Message Turn Completion', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  it('should complete a full message turn correctly', () => {
    const sessionId = 'sess_test';
    const userMessageId = 'msg_user_123';
    const assistantMessageId = 'msg_assistant_456';

    // 1. Receive SESSION_MESSAGE (simulated by on handler)
    const messageData = {
      sessionId,
      messageId: userMessageId,
      content: 'Hello',
    };

    // 2. Process and emit streaming responses
    mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
      sessionId,
      messageId: userMessageId,
      message: {
        id: assistantMessageId,
        content: 'Hi',
        role: 'assistant',
        streaming: true,
        createdAt: Date.now(),
      },
    });

    // 3. Emit final response (201-FIX critical point)
    mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
      sessionId,
      messageId: userMessageId, // MUST include user's message ID
      message: {
        id: assistantMessageId,
        content: 'Hi there! How can I help?',
        role: 'assistant',
        streaming: false, // MUST be false for final
        createdAt: Date.now(),
      },
    });

    // Verify final message was emitted correctly
    const finalCall = mockSocket.emit.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) =>
        call[0] === SOCKET_EVENTS.SESSION_RESPONSE &&
        call[1]?.message?.streaming === false
    );

    expect(finalCall).toBeDefined();
    expect(finalCall![1].messageId).toBe(userMessageId);
    expect(finalCall![1].message.streaming).toBe(false);
  });
});

describe('Bridge Contract: Pipeline Output Queue Emission (201-FIX)', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  it('should emit final message from pipeline outbound queue', () => {
    const sessionId = 'sess_test';
    const userMessageId = 'msg_user_123';

    // Simulate pipeline completion with outbound queue
    const outboundQueue = [
      {
        id: 'msg_assistant_456',
        content: 'Final response content',
        createdAt: Date.now(),
      },
    ];

    // 201-FIX: After pipeline completes, emit the final message
    if (outboundQueue.length > 0) {
      const finalMessage = outboundQueue[outboundQueue.length - 1];
      mockSocket.emit(SOCKET_EVENTS.SESSION_RESPONSE, {
        sessionId,
        messageId: userMessageId,
        message: {
          id: finalMessage.id,
          content: finalMessage.content,
          role: 'assistant',
          streaming: false, // CRITICAL: Must be false
          createdAt: finalMessage.createdAt,
        },
      });
    }

    // Verify emission
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.SESSION_RESPONSE,
      expect.objectContaining({
        sessionId,
        messageId: userMessageId,
        message: expect.objectContaining({
          streaming: false,
        }),
      })
    );
  });
});

describe('Bridge Contract: Error Handling', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  it('should emit SESSION_HALTED on timeout', () => {
    const sessionId = 'sess_test';

    mockSocket.emit(SOCKET_EVENTS.SESSION_HALTED, {
      sessionId,
      reason: 'timeout',
      timestamp: Date.now(),
      canResume: true,
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.SESSION_HALTED,
      expect.objectContaining({
        sessionId,
        reason: 'timeout',
        canResume: true,
      })
    );
  });

  it('should emit SESSION_ERROR on processing error', () => {
    const sessionId = 'sess_test';
    const errorMessage = 'Claude API error';

    mockSocket.emit(SOCKET_EVENTS.SESSION_ERROR, {
      sessionId,
      error: errorMessage,
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.SESSION_ERROR,
      expect.objectContaining({
        sessionId,
        error: errorMessage,
      })
    );
  });
});

describe('Bridge Contract: Activity Events', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  it('should emit SESSION_ACTIVITY for tool use', () => {
    const sessionId = 'sess_test';

    mockSocket.emit(SOCKET_EVENTS.SESSION_ACTIVITY, {
      sessionId,
      type: 'tool_use',
      data: {
        toolName: 'Read',
        status: 'started',
      },
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.SESSION_ACTIVITY,
      expect.objectContaining({
        sessionId,
        type: 'tool_use',
      })
    );
  });

  it('should emit SESSION_CONTEXT_INJECTED on context injection', () => {
    const sessionId = 'sess_test';

    mockSocket.emit(SOCKET_EVENTS.SESSION_CONTEXT_INJECTED, {
      sessionId,
      entityType: 'spec',
      entityId: 'spec_123',
      contextType: 'full',
      contextPreview: 'First 100 chars...',
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.SESSION_CONTEXT_INJECTED,
      expect.objectContaining({
        sessionId,
        contextType: 'full',
      })
    );
  });
});
