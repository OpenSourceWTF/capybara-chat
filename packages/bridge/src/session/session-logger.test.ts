/**
 * Session Logger and Log Buffer Tests
 *
 * Tests for SessionLogBuffer and createSessionLogger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionLogBuffer, createSessionLogger } from './session-logger.js';

describe('SessionLogBuffer', () => {
  let buffer: SessionLogBuffer;

  beforeEach(() => {
    buffer = new SessionLogBuffer();
  });

  describe('addLog and getLogs', () => {
    it('should add log entries', () => {
      buffer.addLog('sess-1', {
        level: 'info',
        message: 'test message',
        timestamp: Date.now(),
      });

      const logs = buffer.getLogs('sess-1');
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('test message');
    });

    it('should handle multiple sessions', () => {
      buffer.addLog('sess-1', { level: 'info', message: 'msg1', timestamp: Date.now() });
      buffer.addLog('sess-2', { level: 'info', message: 'msg2', timestamp: Date.now() });

      const logs1 = buffer.getLogs('sess-1');
      const logs2 = buffer.getLogs('sess-2');

      expect(logs1.length).toBe(1);
      expect(logs2.length).toBe(1);
      expect(logs1[0].message).toBe('msg1');
      expect(logs2[0].message).toBe('msg2');
    });

    it('should return empty array for non-existent session', () => {
      const logs = buffer.getLogs('sess-nonexistent');
      expect(logs).toEqual([]);
    });

    it('should trim logs to maxLogsPerSession (500)', () => {
      // Add 600 logs
      for (let i = 0; i < 600; i++) {
        buffer.addLog('sess-1', {
          level: 'info',
          message: `log-${i}`,
          timestamp: Date.now(),
        });
      }

      const logs = buffer.getLogs('sess-1');
      expect(logs.length).toBe(500); // Trimmed to max
      expect(logs[0].message).toBe('log-100'); // First 100 trimmed
      expect(logs[499].message).toBe('log-599');
    });

    it('should limit returned logs with limit parameter', () => {
      for (let i = 0; i < 100; i++) {
        buffer.addLog('sess-1', {
          level: 'info',
          message: `log-${i}`,
          timestamp: Date.now(),
        });
      }

      const logs = buffer.getLogs('sess-1', 20);
      expect(logs.length).toBe(20);
      expect(logs[0].message).toBe('log-80'); // Last 20
      expect(logs[19].message).toBe('log-99');
    });
  });

  describe('clearLogs', () => {
    it('should clear logs for session', () => {
      buffer.addLog('sess-1', { level: 'info', message: 'msg', timestamp: Date.now() });
      expect(buffer.getLogs('sess-1').length).toBe(1);

      buffer.clearLogs('sess-1');
      expect(buffer.getLogs('sess-1').length).toBe(0);
    });

    it('should not affect other sessions', () => {
      buffer.addLog('sess-1', { level: 'info', message: 'msg1', timestamp: Date.now() });
      buffer.addLog('sess-2', { level: 'info', message: 'msg2', timestamp: Date.now() });

      buffer.clearLogs('sess-1');

      expect(buffer.getLogs('sess-1').length).toBe(0);
      expect(buffer.getLogs('sess-2').length).toBe(1);
    });
  });

  describe('getAllSessionIds', () => {
    it('should return all session IDs with logs', () => {
      buffer.addLog('sess-1', { level: 'info', message: 'msg', timestamp: Date.now() });
      buffer.addLog('sess-2', { level: 'info', message: 'msg', timestamp: Date.now() });
      buffer.addLog('sess-3', { level: 'info', message: 'msg', timestamp: Date.now() });

      const ids = buffer.getAllSessionIds();
      expect(ids).toContain('sess-1');
      expect(ids).toContain('sess-2');
      expect(ids).toContain('sess-3');
      expect(ids.length).toBe(3);
    });

    it('should return empty array if no logs', () => {
      const ids = buffer.getAllSessionIds();
      expect(ids).toEqual([]);
    });
  });
});

describe('createSessionLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should prefix logs with session ID', () => {
    const logger = createSessionLogger('sess-12345678');

    logger.info('test message');

    expect(logSpy).toHaveBeenCalledWith('[Session:sess-123] test message', '');
  });

  it('should log to console without buffer', () => {
    const logger = createSessionLogger('sess-1');

    logger.info('info message');
    logger.debug('debug message');
    logger.error('error message', new Error('test error'));

    expect(logSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should log to console and buffer when buffer provided', () => {
    const buffer = new SessionLogBuffer();
    const logger = createSessionLogger('sess-1', buffer);

    logger.info('test message', { foo: 'bar' });

    // Console
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('test message'),
      { foo: 'bar' }
    );

    // Buffer
    const logs = buffer.getLogs('sess-1');
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('test message');
    expect(logs[0].data).toEqual({ foo: 'bar' });
  });

  it('should capture error details in buffer', () => {
    const buffer = new SessionLogBuffer();
    const logger = createSessionLogger('sess-1', buffer);

    const error = new Error('test error');
    logger.error('Something failed', error);

    const logs = buffer.getLogs('sess-1');
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].message).toBe('Something failed');
    expect(logs[0].data).toEqual({
      message: 'test error',
      stack: expect.any(String),
    });
  });
});
