/**
 * Bridge Configuration
 *
 * Centralized, injectable configuration for the agent bridge.
 * Enables testing without manipulating process.env.
 *
 * Usage in production:
 *   const config = loadConfig();  // Uses process.env
 *
 * Usage in tests:
 *   const config = loadConfig({ CAPYBARA_SERVER_URL: 'http://test' });
 */

import { SERVER_DEFAULTS, MODEL_DEFAULTS } from '@capybara-chat/types';
import type { BridgeConfig } from './interfaces.js';

// ============================================================================
// Centralized timing constants
// All magic numbers in one place for easy tuning and testing
// ============================================================================

/** Stream timeout for interactive sessions (10 minutes) */
export const STREAM_TIMEOUT_MS_SESSION = 10 * 60 * 1000;

/** Interval for heartbeat (30 seconds) */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Human input request timeout (30 minutes - humans need time) */
export const HUMAN_INPUT_TIMEOUT_MS = 30 * 60 * 1000;

/** Context percentage threshold to trigger auto-compaction (80%) */
export const COMPACTION_THRESHOLD = 0.8;

/** Message interval between compaction checks */
export const COMPACTION_CHECK_INTERVAL = 5;

/** Character threshold to consider auto-documenting a response */
export const AUTO_DOCUMENT_THRESHOLD = 3000;

// ============================================
// SUBAGENT HANG PREVENTION CONFIGURATION
// ============================================

/**
 * Timeout for individual subagent execution (per Task tool invocation).
 * If a subagent runs longer than this, a warning is logged.
 * The subagent continues running until the absolute deadline.
 *
 * Default: 20 minutes (1/3 of absolute deadline)
 */
export const SUBAGENT_TIMEOUT_MS =
  parseInt(process.env.SUBAGENT_TIMEOUT_MS ?? '', 10) || 20 * 60 * 1000;

/**
 * Maximum number of subagent metrics entries to keep in memory.
 * Prevents unbounded growth. Oldest entries are evicted when limit reached.
 *
 * Default: 1000
 */
export const MAX_METRICS_SIZE =
  parseInt(process.env.MAX_METRICS_SIZE ?? '', 10) || 1000;

/**
 * Duration of no progress before logging stall warning.
 *
 * Default: 5 minutes
 */
export const STALL_DETECTION_MS =
  parseInt(process.env.STALL_DETECTION_MS ?? '', 10) || 5 * 60 * 1000;

/**
 * Number of failures before circuit breaker trips.
 *
 * Default: 3 failures
 */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD =
  parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? '', 10) || 3;

/**
 * Time window for counting failures (sliding window).
 * Failures older than this are ignored.
 *
 * Default: 10 minutes
 */
export const CIRCUIT_BREAKER_WINDOW_MS =
  parseInt(process.env.CIRCUIT_BREAKER_WINDOW_MS ?? '', 10) || 10 * 60 * 1000;

/**
 * How long to keep circuit breaker open before allowing retry.
 * After this duration, one attempt is allowed (half-open state).
 *
 * Default: 5 minutes
 */
export const CIRCUIT_BREAKER_COOLDOWN_MS =
  parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_MS ?? '', 10) || 5 * 60 * 1000;

/**
 * Feature flag: Enable subagent timeout mechanism.
 * Set to false to disable if issues arise in production.
 */
export const ENABLE_SUBAGENT_TIMEOUT =
  process.env.ENABLE_SUBAGENT_TIMEOUT !== 'false';  // Enabled by default

/**
 * Feature flag: Enable circuit breaker.
 * Set to false to disable if issues arise in production.
 */
export const ENABLE_CIRCUIT_BREAKER =
  process.env.ENABLE_CIRCUIT_BREAKER !== 'false';  // Enabled by default

/**
 * Load configuration from environment variables.
 *
 * @param env - Environment object (defaults to process.env)
 * @returns Parsed configuration
 */

/**
 * Valid CLI backend values for CLI provider mode.
 */
const VALID_CLI_BACKENDS = ['claude', 'gemini', 'ollama', 'codex', 'openai'] as const;
type CLIBackendType = (typeof VALID_CLI_BACKENDS)[number];

function parseCliBackend(value: string | undefined): CLIBackendType | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (VALID_CLI_BACKENDS.includes(lower as CLIBackendType)) {
    return lower as CLIBackendType;
  }
  return undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  return {
    serverUrl: env.CAPYBARA_SERVER_URL || SERVER_DEFAULTS.SERVER_URL,
    bridgePort: Number(env.BRIDGE_PORT) || SERVER_DEFAULTS.BRIDGE_PORT,
    apiKey: env.CAPYBARA_API_KEY || (env.ALLOW_DEV_KEY === 'true' ? 'dev-key' : undefined),
    model: env.MODEL || MODEL_DEFAULTS.CLAUDE_SONNET,
    allowDevKey: env.ALLOW_DEV_KEY === 'true',
    useCliProvider: env.USE_CLI_PROVIDER !== 'false', // CLI provider is default
    cliBackend: parseCliBackend(env.CLI_BACKEND),
  };
}

/**
 * Create a test configuration with sensible defaults.
 * Override specific values as needed.
 */
export function createTestConfig(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    serverUrl: 'http://localhost:3279',
    bridgePort: 3280,
    apiKey: 'test-api-key',
    model: MODEL_DEFAULTS.CLAUDE_SONNET,
    allowDevKey: true,
    useCliProvider: true, // CLI provider is default
    cliBackend: undefined,
    ...overrides,
  };
}

/**
 * Validate configuration and log warnings for missing optional values.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Credential requirements for each CLI backend.
 * Credentials can be provided via env vars OR OAuth credentials on disk.
 */
interface CredentialRequirement {
  /** Environment variables that can provide the API key */
  envVars: string[];
  /** OAuth credentials file path (relative to home) */
  oauthPath?: string;
  /** Whether credentials are optional (e.g., Ollama runs locally) */
  optional: boolean;
}

const CLI_BACKEND_CREDENTIALS: Record<string, CredentialRequirement> = {
  claude: {
    // OAuth only - no API key fallback for Claude CLI
    envVars: [],
    oauthPath: '.claude/.credentials.json',
    optional: false,
  },
  gemini: {
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    oauthPath: '.gemini/settings.json',
    optional: false,
  },
  ollama: {
    envVars: [],
    optional: true,  // Local execution, no keys needed
  },
  codex: {
    envVars: ['OPENAI_API_KEY'],
    optional: false,
  },
  openai: {
    envVars: ['OPENAI_API_KEY'],
    optional: false,
  },
};

/**
 * Check if OAuth credentials exist on disk.
 * @param oauthPath - Path relative to home directory
 * @param checkFile - Optional override for testing (defaults to existsSync)
 */
function hasOAuthCredentials(
  oauthPath: string | undefined,
  checkFile: (path: string) => boolean = existsSync
): boolean {
  if (!oauthPath) return false;
  try {
    const fullPath = join(homedir(), oauthPath);
    return checkFile(fullPath);
  } catch {
    return false;
  }
}

export interface ValidateConfigOptions {
  env?: NodeJS.ProcessEnv;
  /** Override file existence check for testing */
  checkOAuthFile?: (path: string) => boolean;
}

/**
 * Check if the argument is ValidateConfigOptions (has env or checkOAuthFile property)
 */
function isValidateConfigOptions(
  arg: NodeJS.ProcessEnv | ValidateConfigOptions
): arg is ValidateConfigOptions {
  return arg !== null &&
    typeof arg === 'object' &&
    ('env' in arg || 'checkOAuthFile' in arg);
}

export function validateConfig(
  config: BridgeConfig,
  envOrOptions: NodeJS.ProcessEnv | ValidateConfigOptions = process.env
): { valid: boolean; warnings: string[]; errors: string[] } {
  // Handle both old signature (just env) and new options object
  const options = isValidateConfigOptions(envOrOptions)
    ? envOrOptions
    : { env: envOrOptions };
  const env = options.env ?? process.env;
  const checkOAuthFile = options.checkOAuthFile ?? existsSync;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.apiKey && !config.useCliProvider) {
    warnings.push('No API key configured - requests may fail authentication');
  }

  if (config.useCliProvider) {
    const backend = config.cliBackend || 'claude';
    warnings.push(`CLI provider mode enabled using ${backend} CLI`);

    // Validate credentials for CLI backends
    const requirements = CLI_BACKEND_CREDENTIALS[backend];
    if (requirements && !requirements.optional) {
      const hasEnvVar = requirements.envVars.some(varName => !!env[varName]);
      const hasOAuth = hasOAuthCredentials(requirements.oauthPath, checkOAuthFile);

      if (!hasEnvVar && !hasOAuth) {
        const envVarList = requirements.envVars.join(', ');
        const hasEnvVarOption = envVarList.length > 0;
        const oauthPath = requirements.oauthPath;

        // Build appropriate error message based on available auth options
        let hint: string;
        if (hasEnvVarOption && oauthPath) {
          hint = `Set ${envVarList} or mount OAuth credentials at ~/${oauthPath}`;
        } else if (oauthPath) {
          // OAuth only (e.g., Claude CLI)
          hint = `Mount OAuth credentials at ~/${oauthPath}`;
        } else {
          hint = `Set ${envVarList}`;
        }

        const loginHint = oauthPath ? 'Run CLI login' : `Set ${envVarList}`;
        warnings.push(`No credentials found for ${backend} CLI. ${loginHint}.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
