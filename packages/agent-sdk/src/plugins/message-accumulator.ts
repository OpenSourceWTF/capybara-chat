/**
 * Message Accumulator Plugin
 *
 * Accumulates streaming delta messages into complete messages.
 * Useful for backends that send multiple delta chunks for a single response.
 */

import type { Plugin, AgentMessage } from '../types.js';

export interface MessageAccumulatorOptions {
  /** Emit accumulated messages immediately or only on completion */
  emitPartials?: boolean;
}

export function createMessageAccumulatorPlugin(options: MessageAccumulatorOptions = {}): Plugin {
  const { emitPartials = true } = options;
  const accumulators = new Map<string, string>();

  return {
    name: 'message-accumulator',
    version: '1.0.0',

    afterReceiveMessage: (sessionId: string, message: AgentMessage): AgentMessage => {
      // Only process assistant message deltas
      if (message.type !== 'message' || message.role !== 'assistant') {
        return message;
      }

      // If not a delta, return as-is and clear accumulator
      if (!message.delta) {
        accumulators.delete(sessionId);
        return message;
      }

      // Accumulate delta content
      const existing = accumulators.get(sessionId) || '';
      const accumulated = existing + (message.content || '');
      accumulators.set(sessionId, accumulated);

      if (emitPartials) {
        // Return message with accumulated content
        return {
          ...message,
          content: accumulated,
        };
      } else {
        // Return delta as-is, let consumer handle accumulation
        return message;
      }
    },

    onSessionStop: async (sessionId: string) => {
      accumulators.delete(sessionId);
    },
  };
}
