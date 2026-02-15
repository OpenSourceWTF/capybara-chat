/**
 * Docker Session Spawner
 * 
 * Manages containers for Claude sessions using prebuilt agent images.
 * Integrates with the SDK provider for session lifecycle.
 */

import Docker from 'dockerode';
import type { SessionConfig, SessionHandle } from '@capybara-chat/types';
import { now, createLogger, ProcessStatus, SERVER_DEFAULTS } from '@capybara-chat/types';
import type { IDocker, IContainer } from './interfaces.js';

const log = createLogger('Spawner');

/**
 * Spawner configuration - injectable for testing
 */
export interface SpawnerConfig {
  claudeImage: string;
  bridgeUrl: string;
  serverUrl: string;
  proxySocketPath: string;
}

/**
 * Load spawner configuration from environment or provided values.
 * @param env - Environment object (defaults to process.env)
 */
export function loadSpawnerConfig(env: NodeJS.ProcessEnv = process.env): SpawnerConfig {
  return {
    claudeImage: env.CLAUDE_AGENT_IMAGE || 'capybara/agent:latest',
    bridgeUrl: `http://host.docker.internal:${env.BRIDGE_PORT || SERVER_DEFAULTS.BRIDGE_PORT}`,
    serverUrl: env.CAPYBARA_SERVER_URL || `http://host.docker.internal:${SERVER_DEFAULTS.SERVER_PORT}`,
    proxySocketPath: env.PROXY_SOCKET_PATH || '/tmp/capybara-proxy.sock',
  };
}

export interface ActiveSession {
  id: string;
  specId: string;
  containerId?: string;
  claudeSessionId?: string;
  status: ProcessStatus;
  startedAt: number;
  lastActivityAt: number;
}

/**
 * Docker Session Spawner with dependency injection.
 *
 * Production usage:
 *   const spawner = new SessionSpawner();  // Uses real Docker
 *
 * Test usage:
 *   const mockDocker = { createContainer: vi.fn() };
 *   const spawner = new SessionSpawner(mockDocker, testConfig);
 */
export class SessionSpawner {
  private sessions: Map<string, ActiveSession> = new Map();
  private containers: Map<string, IContainer> = new Map();
  private config: SpawnerConfig;

  /**
   * @param docker - Docker client (defaults to real Docker)
   * @param config - Spawner configuration (defaults to loading from env)
   */
  constructor(
    private docker: IDocker = new Docker() as unknown as IDocker,
    config?: SpawnerConfig
  ) {
    this.config = config || loadSpawnerConfig();
  }

  /**
   * Spawn a new container for a session
   */
  async spawnSession(config: SessionConfig): Promise<SessionHandle> {
    const { sessionId } = config;  // Server owns identity!

    log.info('Creating container for session', { sessionId, specId: config.specId });

    const activeSession: ActiveSession = {
      id: sessionId,
      specId: config.specId || '',
      status: ProcessStatus.STARTING,
      startedAt: now(),
      lastActivityAt: now(),
    };

    this.sessions.set(sessionId, activeSession);

    try {
      // Create container with security hardening
      const container = await this.docker.createContainer({
        Image: this.config.claudeImage,
        Env: [
          `CAPYBARA_SESSION_ID=${sessionId}`,
          `CAPYBARA_SPEC_ID=${config.specId}`,
          `CAPYBARA_BRIDGE_URL=${this.config.bridgeUrl}`,
          `CAPYBARA_SERVER_URL=${this.config.serverUrl}`,
          `INITIAL_PROMPT=${config.initialPrompt ?? ''}`,
          // API keys injected by proxy, not directly
          'HTTP_PROXY=unix:///run/proxy.sock',
          'HTTPS_PROXY=unix:///run/proxy.sock',
        ],
        HostConfig: {
          // Security: no network - use proxy socket only
          NetworkMode: 'none',
          // Mount proxy socket only - no secrets in container
          Binds: [
            `${this.config.proxySocketPath}:/run/proxy.sock:rw`,
            // No ~/.claude or ~/.ssh - secrets stay outside container
          ],
          // Drop all capabilities
          CapDrop: ['ALL'],
          // Read-only filesystem with tmpfs for work
          ReadonlyRootfs: true,
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=500m',
            '/home/agent/work': 'rw,size=2g',
          },
          // Resource limits
          Memory: 2 * 1024 * 1024 * 1024, // 2GB
          NanoCpus: 2 * 1e9, // 2 CPUs
          PidsLimit: 100,
          // Security options
          SecurityOpt: ['no-new-privileges'],
        },
        User: '1500:1500',  // capybara user in agent containers
      });

      await container.start();

      activeSession.containerId = container.id;
      activeSession.status = ProcessStatus.RUNNING;
      this.containers.set(sessionId, container);

      log.info('Container started', { containerId: container.id.slice(0, 12), sessionId });

      return {
        id: sessionId,
        providerId: 'claude-v2',
        status: 'running',
        startedAt: activeSession.startedAt,
      };
    } catch (error) {
      activeSession.status = ProcessStatus.FAILED;
      log.error('Failed to create container', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Stop and remove a session container
   */
  async stopSession(sessionId: string): Promise<void> {
    log.info('Stopping session', { sessionId });

    const session = this.sessions.get(sessionId);
    const container = this.containers.get(sessionId);

    if (container) {
      try {
        await container.stop({ t: 10 });
      } catch (err) {
        // Only log unexpected errors (not "already stopped" errors)
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('is not running') && !message.includes('already stopped')) {
          log.warn('Error stopping container', { sessionId, error: message });
        }
      }
      try {
        await container.remove();
      } catch (err) {
        // Only log unexpected errors (not "no such container" errors)
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('no such container') && !message.includes('is already in progress')) {
          log.warn('Error removing container', { sessionId, error: message });
        }
      }
      this.containers.delete(sessionId);
    }

    if (session) {
      session.status = ProcessStatus.STOPPED;
    }
  }

  /**
   * Pause a running session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const container = this.containers.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (container && session) {
      await container.pause();
      session.status = ProcessStatus.PAUSED;
      log.info('Paused session', { sessionId });
    }
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const container = this.containers.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (container && session) {
      await container.unpause();
      session.status = ProcessStatus.RUNNING;
      session.lastActivityAt = now();
      log.info('Resumed session', { sessionId });
    }
  }

  /**
   * Get logs from a session container
   */
  async getSessionLogs(sessionId: string): Promise<string> {
    const container = this.containers.get(sessionId);
    if (!container) {
      return '';
    }

    const logs = await container.logs({ stdout: true, stderr: true, tail: 500 });
    return logs.toString();
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ActiveSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === ProcessStatus.RUNNING || s.status === ProcessStatus.PAUSED
    );
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = now();
    }
  }

  /**
   * Store Claude session ID when container reports it
   */
  setClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.claudeSessionId = claudeSessionId;
    }
  }

  /**
   * Reset all state - for tests only!
   */
  reset(): void {
    this.sessions.clear();
    this.containers.clear();
  }
}
