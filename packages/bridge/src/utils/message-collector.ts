/**
 * Message Collector Utility
 *
 * Helper to collect text content from AssistantPool message streams.
 * Eliminates duplicate streaming iteration patterns across the codebase.
 */

import type { AssistantPool } from '../pool/assistant-pool.js';

export interface StreamMessage {
  type: string;
  content?: string;
  data?: unknown;
}

/**
 * Collect all text content from a message stream into a single string.
 *
 * @param generator - Async generator from assistantPool.sendMessage()
 * @returns Concatenated message content
 *
 * @example
 * const response = await collectMessages(
 *   assistantPool.sendMessage(sessionId, '/compact')
 * );
 */
export async function collectMessages(
  generator: AsyncIterable<StreamMessage>
): Promise<string> {
  let content = '';

  for await (const msg of generator) {
    if (msg.type === 'message' && msg.content) {
      content += msg.content;
    } else if (msg.type === 'result' && msg.data) {
      // Capture result text (contains subagent output and final summary)
      const resultData = msg.data as { result?: string };
      if (resultData.result && typeof resultData.result === 'string' && resultData.result.trim()) {
        if (!content) {
          content = resultData.result;
        } else if (!content.includes(resultData.result)) {
          content += '\n\n' + resultData.result;
        }
      }
    }
  }

  return content;
}

/**
 * Send a command to Claude and collect the response.
 * Convenience wrapper for simple command execution.
 *
 * @param assistantPool - The assistant pool instance
 * @param poolSessionId - The pool session ID
 * @param command - The command to send (e.g., '/compact', '/context')
 * @returns The collected response content
 */
export async function sendAndCollect(
  assistantPool: AssistantPool,
  poolSessionId: string,
  command: string
): Promise<string> {
  // @ts-ignore - structural compatibility handling
  return collectMessages(assistantPool.sendMessage(poolSessionId, command));
}
