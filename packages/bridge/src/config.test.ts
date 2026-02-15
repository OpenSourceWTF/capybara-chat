/**
 * Config Tests
 *
 * Demonstrates how injectable configuration enables testing
 * without manipulating process.env.
 */

import { describe, it, expect } from 'vitest';
import { loadConfig, createTestConfig, validateConfig } from './config.js';

describe('loadConfig', () => {
  it('should load from provided env object', () => {
    const env = {
      CAPYBARA_SERVER_URL: 'http://custom:3000',
      BRIDGE_PORT: '8080',
      CAPYBARA_API_KEY: 'my-api-key',
      USE_DOCKER: 'true',
      ENABLE_TASK_EXECUTOR: 'true',
      MODEL: 'claude-opus',
    };

    const config = loadConfig(env);

    expect(config.serverUrl).toBe('http://custom:3000');
    expect(config.bridgePort).toBe(8080);
    expect(config.apiKey).toBe('my-api-key');
    expect(config.useDocker).toBe(true);
    expect(config.enableTaskExecutor).toBe(true);
    expect(config.model).toBe('claude-opus');
  });

  it('should use defaults for missing values', () => {
    const config = loadConfig({});

    expect(config.serverUrl).toBe('http://localhost:2279');
    expect(config.bridgePort).toBe(2280);
    expect(config.apiKey).toBeUndefined();
    expect(config.useDocker).toBe(false);
    expect(config.enableTaskExecutor).toBe(true); // Default is true (not 'false')
  });

  it('should use dev-key when ALLOW_DEV_KEY is true and no API key', () => {
    const env = {
      ALLOW_DEV_KEY: 'true',
    };

    const config = loadConfig(env);

    expect(config.apiKey).toBe('dev-key');
    expect(config.allowDevKey).toBe(true);
  });

  it('should prefer explicit API key over dev-key', () => {
    const env = {
      CAPYBARA_API_KEY: 'explicit-key',
      ALLOW_DEV_KEY: 'true',
    };

    const config = loadConfig(env);

    expect(config.apiKey).toBe('explicit-key');
  });

  it('should parse ENABLE_TASK_EXECUTOR=false correctly', () => {
    const env = {
      ENABLE_TASK_EXECUTOR: 'false',
    };

    const config = loadConfig(env);

    expect(config.enableTaskExecutor).toBe(false);
  });

  it('should handle invalid port number', () => {
    const env = {
      BRIDGE_PORT: 'invalid',
    };

    const config = loadConfig(env);

    // NaN falls back to default
    expect(config.bridgePort).toBe(2280);
  });

  it('should parse USE_CLI_PROVIDER=true', () => {
    const env = {
      USE_CLI_PROVIDER: 'true',
    };

    const config = loadConfig(env);

    expect(config.useCliProvider).toBe(true);
  });

  it('should parse CLI_BACKEND with valid values', () => {
    // Test each valid backend
    const validBackends = ['claude', 'gemini', 'ollama', 'codex', 'openai'];
    for (const backend of validBackends) {
      const config = loadConfig({ CLI_BACKEND: backend });
      expect(config.cliBackend).toBe(backend);
    }

    // Test case-insensitivity
    const configUpper = loadConfig({ CLI_BACKEND: 'CLAUDE' });
    expect(configUpper.cliBackend).toBe('claude');
  });

  it('should return undefined for invalid CLI_BACKEND', () => {
    const config = loadConfig({ CLI_BACKEND: 'invalid-backend' });
    expect(config.cliBackend).toBeUndefined();
  });

  it('should default useCliProvider to true (CLI provider is default)', () => {
    const config = loadConfig({});
    expect(config.useCliProvider).toBe(true);
  });

  it('should disable CLI provider when USE_CLI_PROVIDER=false', () => {
    const config = loadConfig({ USE_CLI_PROVIDER: 'false' });
    expect(config.useCliProvider).toBe(false);
  });
});

describe('createTestConfig', () => {
  it('should provide sensible test defaults', () => {
    const config = createTestConfig();

    expect(config.serverUrl).toBe('http://localhost:2279');
    expect(config.bridgePort).toBe(2280);
    expect(config.apiKey).toBe('test-api-key');
    expect(config.useDocker).toBe(false);
    expect(config.enableTaskExecutor).toBe(false);
  });

  it('should allow overriding specific values', () => {
    const config = createTestConfig({
      serverUrl: 'http://test-server:9999',
      useDocker: true,
    });

    expect(config.serverUrl).toBe('http://test-server:9999');
    expect(config.useDocker).toBe(true);
    // Other values unchanged
    expect(config.bridgePort).toBe(2280);
    expect(config.apiKey).toBe('test-api-key');
  });
});

describe('validateConfig', () => {
  it('should return valid for complete config (SDK mode)', () => {
    // Use SDK mode (useCliProvider: false) for a "complete config with no warnings" test
    const config = createTestConfig({ useCliProvider: false });

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn about missing API key when not using CLI provider', () => {
    const config = createTestConfig({ apiKey: undefined, useCliProvider: false });

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('No API key configured - requests may fail authentication');
  });

  it('should warn about Docker mode with task executor', () => {
    const config = createTestConfig({
      useDocker: true,
      enableTaskExecutor: true,
    });

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Task executor may not work correctly in Docker mode');
  });

  it('should warn about CLI provider mode', () => {
    const config = createTestConfig({
      useCliProvider: true,
      apiKey: 'test-key',
    });

    // Claude CLI uses OAuth only - mock OAuth file exists
    const result = validateConfig(config, { checkOAuthFile: () => true });

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('CLI provider mode enabled'))).toBe(true);
  });

  it('should include CLI backend name in CLI provider mode warning', () => {
    const config = createTestConfig({
      useCliProvider: true,
      cliBackend: 'gemini',
      apiKey: 'test-key',
    });

    const result = validateConfig(config, { env: { GEMINI_API_KEY: 'test-key' } });

    expect(result.warnings.some(w => w.includes('gemini CLI'))).toBe(true);
  });

  it('should not warn about missing API key in CLI provider mode', () => {
    const config = createTestConfig({
      useCliProvider: true,
      apiKey: undefined,
    });

    // Claude CLI uses OAuth only - mock OAuth file exists
    const result = validateConfig(config, { checkOAuthFile: () => true });

    expect(result.warnings).not.toContain('No API key configured - requests may fail authentication');
  });

  it('should error when Docker + CLI provider mode without OAuth credentials', () => {
    const config = createTestConfig({
      useDocker: true,
      useCliProvider: true,
      cliBackend: 'claude',
    });

    // No OAuth credentials - Claude CLI is OAuth only
    const result = validateConfig(config, {
      env: {},
      checkOAuthFile: () => false,
    });

    expect(result.valid).toBe(false);
    // Error should mention OAuth path since Claude CLI is OAuth only (no env vars)
    expect(result.errors.some(e => e.includes('.claude/.credentials.json'))).toBe(true);
  });

  it('should be valid when Docker + CLI provider mode with OAuth credentials', () => {
    const config = createTestConfig({
      useDocker: true,
      useCliProvider: true,
      cliBackend: 'claude',
    });

    // Claude CLI uses OAuth only - mock OAuth file exists
    const result = validateConfig(config, { checkOAuthFile: () => true });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate Gemini credentials for gemini backend in Docker', () => {
    const config = createTestConfig({
      useDocker: true,
      useCliProvider: true,
      cliBackend: 'gemini',
    });

    // No credentials (mock OAuth check to return false)
    const noOAuthCheck = { checkOAuthFile: () => false };
    const resultMissing = validateConfig(config, { env: {}, ...noOAuthCheck });
    expect(resultMissing.valid).toBe(false);
    expect(resultMissing.errors.some(e => e.includes('GEMINI_API_KEY'))).toBe(true);

    // With GEMINI_API_KEY
    const resultWithKey = validateConfig(config, { env: { GEMINI_API_KEY: 'test-key' }, ...noOAuthCheck });
    expect(resultWithKey.valid).toBe(true);

    // With GOOGLE_API_KEY (alternative)
    const resultWithGoogle = validateConfig(config, { env: { GOOGLE_API_KEY: 'test-key' }, ...noOAuthCheck });
    expect(resultWithGoogle.valid).toBe(true);
  });

  it('should validate OpenAI credentials for codex backend in Docker', () => {
    const config = createTestConfig({
      useDocker: true,
      useCliProvider: true,
      cliBackend: 'codex',
    });

    const noOAuthCheck = { checkOAuthFile: () => false };
    const resultMissing = validateConfig(config, { env: {}, ...noOAuthCheck });
    expect(resultMissing.valid).toBe(false);
    expect(resultMissing.errors.some(e => e.includes('OPENAI_API_KEY'))).toBe(true);

    const resultWithKey = validateConfig(config, { env: { OPENAI_API_KEY: 'test-key' }, ...noOAuthCheck });
    expect(resultWithKey.valid).toBe(true);
  });

  it('should not require credentials for ollama backend (local execution)', () => {
    const config = createTestConfig({
      useDocker: true,
      useCliProvider: true,
      cliBackend: 'ollama',
    });

    // No API key needed for Ollama
    const result = validateConfig(config, { env: {}, checkOAuthFile: () => false });
    expect(result.valid).toBe(true);
  });

  it('should only warn (not error) about missing credentials outside Docker', () => {
    const config = createTestConfig({
      useDocker: false,
      useCliProvider: true,
      cliBackend: 'claude',
    });

    // No credentials, but not in Docker (mock OAuth check to return false)
    const result = validateConfig(config, { env: {}, checkOAuthFile: () => false });
    expect(result.valid).toBe(true); // Still valid - user can use OAuth interactively
    expect(result.warnings.some(w => w.includes('credentials'))).toBe(true);
  });
});
