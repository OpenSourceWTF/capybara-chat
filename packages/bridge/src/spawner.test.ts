/**
 * Session Spawner Tests
 *
 * Demonstrates testability with dependency injection:
 * - Mock Docker client injected via constructor
 * - Mock config injected via constructor
 * - No real Docker operations in tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionSpawner, loadSpawnerConfig, type SpawnerConfig } from './spawner.js';
import type { IDocker, IContainer } from './interfaces.js';
import { ProcessStatus } from '@capybara-chat/types';

// Mock container
function createMockContainer(id: string = 'container-123'): IContainer {
  return {
    id,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    unpause: vi.fn().mockResolvedValue(undefined),
    logs: vi.fn().mockResolvedValue(Buffer.from('mock logs')),
  };
}

// Mock Docker client
function createMockDocker(): IDocker {
  const mockContainer = createMockContainer();
  return {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
  };
}

// Test config
const testConfig: SpawnerConfig = {
  claudeImage: 'test/agent:latest',
  bridgeUrl: 'http://test-bridge:8080',
  serverUrl: 'http://test-server:3000',
  proxySocketPath: '/tmp/test-proxy.sock',
};

describe('loadSpawnerConfig', () => {
  it('should load from provided env object', () => {
    const env = {
      CLAUDE_AGENT_IMAGE: 'custom/image:v1',
      BRIDGE_PORT: '9999',
      CAPYBARA_SERVER_URL: 'http://custom:5000',
      PROXY_SOCKET_PATH: '/custom/proxy.sock',
    };

    const config = loadSpawnerConfig(env);

    expect(config.claudeImage).toBe('custom/image:v1');
    expect(config.bridgeUrl).toBe('http://host.docker.internal:9999');
    expect(config.serverUrl).toBe('http://custom:5000');
    expect(config.proxySocketPath).toBe('/custom/proxy.sock');
  });

  it('should use defaults for missing values', () => {
    const config = loadSpawnerConfig({});

    expect(config.claudeImage).toBe('capybara/agent:latest');
    expect(config.bridgeUrl).toBe('http://host.docker.internal:2280');
    expect(config.proxySocketPath).toBe('/tmp/capybara-proxy.sock');
  });
});

describe('SessionSpawner', () => {
  let spawner: SessionSpawner;
  let mockDocker: IDocker;

  beforeEach(() => {
    mockDocker = createMockDocker();
    spawner = new SessionSpawner(mockDocker, testConfig);
  });

  describe('spawnSession', () => {
    it('should create container with correct configuration', async () => {
      const sessionConfig = {
        sessionId: 'session-123',
        specId: 'spec-456',
        initialPrompt: 'Hello',
      };

      await spawner.spawnSession(sessionConfig);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'test/agent:latest',
          Env: expect.arrayContaining([
            'CAPYBARA_SESSION_ID=session-123',
            'CAPYBARA_SPEC_ID=spec-456',
            'CAPYBARA_BRIDGE_URL=http://test-bridge:8080',
            'CAPYBARA_SERVER_URL=http://test-server:3000',
            'INITIAL_PROMPT=Hello',
          ]),
        })
      );
    });

    it('should return session handle on success', async () => {
      const sessionConfig = {
        sessionId: 'session-123',
        specId: 'spec-456',
      };

      const result = await spawner.spawnSession(sessionConfig);

      expect(result.id).toBe('session-123');
      expect(result.status).toBe('running');
      expect(result.providerId).toBe('claude-v2');
    });

    it('should track active session', async () => {
      const sessionConfig = {
        sessionId: 'session-123',
        specId: 'spec-456',
      };

      await spawner.spawnSession(sessionConfig);

      const session = spawner.getSession('session-123');
      expect(session).toBeDefined();
      expect(session?.status).toBe(ProcessStatus.RUNNING);
      expect(session?.specId).toBe('spec-456');
    });

    it('should mark session as failed on error', async () => {
      const error = new Error('Docker connection failed');
      mockDocker.createContainer = vi.fn().mockRejectedValue(error);

      const sessionConfig = {
        sessionId: 'session-123',
        specId: 'spec-456',
      };

      await expect(spawner.spawnSession(sessionConfig)).rejects.toThrow('Docker connection failed');

      const session = spawner.getSession('session-123');
      expect(session?.status).toBe(ProcessStatus.FAILED);
    });
  });

  describe('stopSession', () => {
    it('should stop and remove container', async () => {
      // First spawn a session
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      await spawner.stopSession('session-123');

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should handle already stopped container gracefully', async () => {
      const mockContainer = createMockContainer();
      mockContainer.stop = vi.fn().mockRejectedValue(new Error('container is not running'));
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      // Should not throw
      await expect(spawner.stopSession('session-123')).resolves.toBeUndefined();
    });

    it('should update session status to stopped', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      await spawner.stopSession('session-123');

      const session = spawner.getSession('session-123');
      expect(session?.status).toBe(ProcessStatus.STOPPED);
    });
  });

  describe('pauseSession', () => {
    it('should pause container and update status', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      await spawner.pauseSession('session-123');

      expect(mockContainer.pause).toHaveBeenCalled();
      expect(spawner.getSession('session-123')?.status).toBe(ProcessStatus.PAUSED);
    });
  });

  describe('resumeSession', () => {
    it('should unpause container and update status', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });
      await spawner.pauseSession('session-123');

      await spawner.resumeSession('session-123');

      expect(mockContainer.unpause).toHaveBeenCalled();
      expect(spawner.getSession('session-123')?.status).toBe(ProcessStatus.RUNNING);
    });
  });

  describe('getSessionLogs', () => {
    it('should return container logs', async () => {
      const mockContainer = createMockContainer();
      mockContainer.logs = vi.fn().mockResolvedValue(Buffer.from('test logs'));
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      const logs = await spawner.getSessionLogs('session-123');

      expect(logs).toBe('test logs');
      expect(mockContainer.logs).toHaveBeenCalledWith({ stdout: true, stderr: true, tail: 500 });
    });

    it('should return empty string for unknown session', async () => {
      const logs = await spawner.getSessionLogs('unknown');

      expect(logs).toBe('');
    });
  });

  describe('getActiveSessions', () => {
    it('should return only running and paused sessions', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);

      await spawner.spawnSession({ sessionId: 'running-1', specId: 'spec' });
      await spawner.spawnSession({ sessionId: 'running-2', specId: 'spec' });
      await spawner.spawnSession({ sessionId: 'paused-1', specId: 'spec' });
      await spawner.pauseSession('paused-1');
      await spawner.spawnSession({ sessionId: 'stopped-1', specId: 'spec' });
      await spawner.stopSession('stopped-1');

      const active = spawner.getActiveSessions();

      expect(active).toHaveLength(3);
      expect(active.map(s => s.id)).toContain('running-1');
      expect(active.map(s => s.id)).toContain('running-2');
      expect(active.map(s => s.id)).toContain('paused-1');
      expect(active.map(s => s.id)).not.toContain('stopped-1');
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivityAt timestamp', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      const before = spawner.getSession('session-123')?.lastActivityAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise(r => setTimeout(r, 10));
      spawner.updateActivity('session-123');

      const after = spawner.getSession('session-123')?.lastActivityAt;
      expect(after).toBeGreaterThanOrEqual(before!);
    });
  });

  describe('setClaudeSessionId', () => {
    it('should store Claude session ID', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-123', specId: 'spec-456' });

      spawner.setClaudeSessionId('session-123', 'claude-session-abc');

      expect(spawner.getSession('session-123')?.claudeSessionId).toBe('claude-session-abc');
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      const mockContainer = createMockContainer();
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      await spawner.spawnSession({ sessionId: 'session-1', specId: 'spec' });
      await spawner.spawnSession({ sessionId: 'session-2', specId: 'spec' });

      spawner.reset();

      expect(spawner.getSession('session-1')).toBeUndefined();
      expect(spawner.getSession('session-2')).toBeUndefined();
      expect(spawner.getActiveSessions()).toHaveLength(0);
    });
  });
});
