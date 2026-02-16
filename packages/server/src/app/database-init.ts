/**
 * Database Initialization Module
 *
 * Handles database setup and repository creation.
 */

import type Database from 'better-sqlite3';
import { initDatabase } from '../db/index.js';
import { SQLiteSessionRepository } from '../repositories/session-repository.js';
import { SQLiteMessageRepository } from '../repositories/message-repository.js';
import { SQLiteSessionEventRepository } from '../repositories/session-event-repository.js';
import { SQLiteHumanInputRequestRepository } from '../repositories/human-input-request-repository.js';
import { SQLiteUserRepository } from '../repositories/user-repository.js';
import { SQLiteAuthSessionRepository } from '../repositories/auth-session-repository.js';
import { SQLiteDocumentRepository } from '../repositories/document-repository.js';
import { SQLitePromptSegmentRepository } from '../repositories/prompt-segment-repository.js';
import { SQLiteAgentDefinitionRepository } from '../repositories/agent-definition-repository.js';
import { createLogger, now, generateId } from '@capybara-chat/types';

const log = createLogger('Database');

/** Well-known ID for the standalone default user */
export const DEFAULT_USER_ID = 'user';

/** Well-known ID for the default chat agent */
const DEFAULT_AGENT_ID = 'default-chat-agent';

/**
 * All repositories created during database initialization
 */
export interface Repositories {
  sessionRepo: SQLiteSessionRepository;
  messageRepo: SQLiteMessageRepository;
  eventRepo: SQLiteSessionEventRepository;
  humanInputRequestRepo: SQLiteHumanInputRequestRepository;
  userRepo: SQLiteUserRepository;
  authSessionRepo: SQLiteAuthSessionRepository;
  documentRepo: SQLiteDocumentRepository;
  promptSegmentRepo: SQLitePromptSegmentRepository;
  agentDefinitionRepo: SQLiteAgentDefinitionRepository;
}

/**
 * Result of database initialization
 */
export interface DatabaseInitResult {
  db: Database.Database;
  repos: Repositories;
}

/**
 * Initialize the database and create all repositories
 */
export function initializeDatabase(dbPath?: string): DatabaseInitResult {
  const db = initDatabase(dbPath);
  log.info('Database initialized');

  const repos: Repositories = {
    sessionRepo: new SQLiteSessionRepository(db),
    messageRepo: new SQLiteMessageRepository(db),
    eventRepo: new SQLiteSessionEventRepository(db),
    humanInputRequestRepo: new SQLiteHumanInputRequestRepository(db),
    userRepo: new SQLiteUserRepository(db),
    authSessionRepo: new SQLiteAuthSessionRepository(db),
    documentRepo: new SQLiteDocumentRepository(db),
    promptSegmentRepo: new SQLitePromptSegmentRepository(db),
    agentDefinitionRepo: new SQLiteAgentDefinitionRepository(db),
  };

  // Seed default data on first startup
  seedDefaults(db, repos);

  return { db, repos };
}

/**
 * Seed default user and agent definition if they don't exist.
 * Runs on every startup but only inserts if missing (idempotent).
 */
function seedDefaults(db: Database.Database, repos: Repositories): void {
  // --- Default User (standalone mode) ---
  // The standalone mock-token maps to user ID 'user'.
  // Create an actual DB record so /api/auth/me and ownership queries work.
  const existingUser = repos.userRepo.findById(DEFAULT_USER_ID);
  if (!existingUser) {
    const timestamp = now();
    db.prepare(`
      INSERT INTO users (id, username, name, role, created_at, updated_at)
      VALUES (?, ?, ?, 'admin', ?, ?)
    `).run(DEFAULT_USER_ID, 'user', 'User', timestamp, timestamp);
    log.info('Created default standalone user', { id: DEFAULT_USER_ID });
  }

  // --- Default Chat Agent ---
  const existingAgent = repos.agentDefinitionRepo.findById(DEFAULT_AGENT_ID);
  if (!existingAgent) {
    const timestamp = now();
    db.prepare(`
      INSERT INTO agent_definitions (id, name, slug, description, system_prompt, model, role, status, is_system, is_default, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, 1, ?, ?, ?)
    `).run(
      DEFAULT_AGENT_ID,
      'Chat',
      'chat',
      'General-purpose chat assistant',
      'You are a helpful, friendly assistant. Be concise and direct.',
      'sonnet',
      'assistant',
      DEFAULT_USER_ID,
      timestamp,
      timestamp
    );
    log.info('Created default chat agent definition', { id: DEFAULT_AGENT_ID });
  }
}
