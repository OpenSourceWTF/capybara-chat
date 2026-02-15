
import { GenericCLIProvider, createClaudeCLIProvider, type CLIBackendConfig } from '@capybara-chat/cli-provider';
import { ProviderType, createLogger } from '@capybara-chat/types';

const log = createLogger('AssistantPool');

export interface AssistantPoolOptions {
  minAgents?: number; // Ignored in simple pool
  maxAgents?: number; // Ignored in simple pool
  model?: string;
  bypassPermissions?: boolean;
  providerType?: ProviderType;
  cliBackend?: string;
}

export type AssistantContextType = 'general' | 'task' | 'editing';

/**
 * StreamMessage compatible with bridge/src/streaming/stream-processor.ts
 */
export interface StreamMessage {
  type: string;
  content?: string;
  data?: unknown;
  total_cost_usd?: number;
}

export interface AssistantPool {
  start(): Promise<void>;
  stop(): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  sendMessage(sessionId: string, content: string): AsyncGenerator<StreamMessage>;
}

export class SimpleAssistantPool implements AssistantPool {
  private sessions = new Map<string, GenericCLIProvider>();

  constructor(private options: AssistantPoolOptions) { }

  async start(): Promise<void> {
    log.info('AssistantPool started (simple mode)');
  }

  async stop(): Promise<void> {
    for (const [sessionId, provider] of this.sessions) {
      await this.closeSession(sessionId);
    }
    this.sessions.clear();
  }

  async closeSession(sessionId: string): Promise<void> {
    const provider = this.sessions.get(sessionId);
    if (provider) {
      try {
        await provider.stopSession(sessionId);
      } catch (e) {
        log.warn('Failed to stop session', { sessionId, error: e });
      }
      this.sessions.delete(sessionId);
    }
  }

  async *sendMessage(sessionId: string, content: string): AsyncGenerator<StreamMessage> {
    let provider = this.sessions.get(sessionId);
    if (!provider) {
      if (this.options.providerType === ProviderType.CLI) {
        if (this.options.cliBackend === 'claude' || !this.options.cliBackend) {
          provider = createClaudeCLIProvider({
            model: this.options.model,
          });
        } else {
          throw new Error(`Unsupported CLI backend: ${this.options.cliBackend}`);
        }
      } else {
        // Default to CLI/Claude if not specified
        provider = createClaudeCLIProvider({
          model: this.options.model,
        });
      }
      this.sessions.set(sessionId, provider!);
    }

    if (provider) {
      const diagnostics = provider.getSessionDiagnostics(sessionId);
      if (!diagnostics.exists) {
        await provider.createSession({ sessionId });
      }

      // Delegate to provider.streamMessages which returns compatible structure
      yield* provider.streamMessages(sessionId, content);
    }
  }
}

export function createAssistantPool(options: AssistantPoolOptions): AssistantPool {
  return new SimpleAssistantPool(options);
}
