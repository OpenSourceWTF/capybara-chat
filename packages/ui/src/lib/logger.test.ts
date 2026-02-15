/**
 * Tests for logger utility
 *
 * Tests the re-exported unified logger from @capybara-chat/types.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, logger } from './logger';

describe('createLogger', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with the given prefix', () => {
    const log = createLogger('TestModule');
    expect(log).toBeDefined();
    expect(log.debug).toBeInstanceOf(Function);
    expect(log.info).toBeInstanceOf(Function);
    expect(log.warn).toBeInstanceOf(Function);
    expect(log.error).toBeInstanceOf(Function);
  });

  it('should log info messages', () => {
    const log = createLogger('TestModule');
    log.info('Info message');

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const call = consoleInfoSpy.mock.calls[0];
    expect(call[0]).toContain('[TestModule]');
    expect(call[0]).toContain('Info message');
  });

  it('should log warn messages', () => {
    const log = createLogger('TestModule');
    log.warn('Warning message');

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const call = consoleWarnSpy.mock.calls[0];
    expect(call[0]).toContain('[TestModule]');
    expect(call[0]).toContain('Warning message');
  });

  it('should log error messages', () => {
    const log = createLogger('TestModule');
    log.error('Error message', { error: 'details' });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy.mock.calls[0];
    expect(call[0]).toContain('[TestModule]');
    expect(call[0]).toContain('Error message');
  });

  it('should include context in log output', () => {
    const log = createLogger('TestModule');
    const extraData = { key: 'value' };
    log.info('Message with data', extraData);

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const call = consoleInfoSpy.mock.calls[0];
    // Context is JSON-stringified in the unified logger
    expect(call[0]).toContain('{"key":"value"}');
  });
});

describe('default logger', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have Huddle prefix', () => {
    logger.info('Test message');

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const call = consoleInfoSpy.mock.calls[0];
    expect(call[0]).toContain('[Huddle]');
  });
});
