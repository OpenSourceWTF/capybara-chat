/**
 * Session Resume Plugin
 *
 * Adds session resumption capability for backends that support it.
 * Currently supports: Claude CLI, Gemini CLI
 */

import type { Plugin, SessionConfig, BackendConfig, AgentClient } from '../types.js';

export interface SessionResumeOptions {
  /** Session ID to resume */
  resumeSessionId?: string;
}

export function createSessionResumePlugin(options: SessionResumeOptions = {}): Plugin {
  let client: AgentClient | null = null;

  // Suppress unused variable warning if client is not used
  void client;

  return {
    name: 'session-resume',
    version: '1.0.0',

    onRegister: (agentClient: AgentClient) => {
      client = agentClient;
    },

    beforeCreateSession: (config: SessionConfig, backend: BackendConfig): SessionConfig => {
      if (!backend.capabilities.sessionResume) {
        return config;
      }

      if (!options.resumeSessionId) {
        return config;
      }

      // Add resume flag to extra args
      const extraArgs = [...(config.extraArgs || [])];

      // Claude uses --resume, Gemini uses -r/--resume
      if (backend.command === 'claude') {
        extraArgs.push('--resume', options.resumeSessionId);
      } else if (backend.command === 'gemini') {
        extraArgs.push('--resume', options.resumeSessionId);
      }

      return {
        ...config,
        extraArgs,
      };
    },
  };
}

/**
 * Create a plugin that resumes a specific session
 */
export function resumeSession(sessionId: string): Plugin {
  return createSessionResumePlugin({ resumeSessionId: sessionId });
}
