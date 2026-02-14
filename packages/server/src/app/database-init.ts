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
import { createLogger } from '@capybara-chat/types';

const log = createLogger('Database');

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
  };

  return { db, repos };
}
