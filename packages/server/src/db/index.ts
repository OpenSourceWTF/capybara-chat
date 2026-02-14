/**
 * SQLite Database Initialization
 * (Stripped for @capybara-chat/server)
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { createLogger, generateUserId, now } from '@capybara-chat/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('DB');

/**
 * Run database migrations for schema changes
 * (Simplified to include only relevant migrations)
 */
function runMigrations(db: Database.Database): void {
  // Migration: Add status column to chat_messages if it doesn't exist
  const hasStatusColumn = db.prepare(`
    SELECT COUNT(*) as count FROM pragma_table_info('chat_messages') WHERE name = 'status'
  `).get() as { count: number };

  if (hasStatusColumn.count === 0) {
    log.info('Running migration: adding status column to chat_messages');
    db.exec(`ALTER TABLE chat_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'sent'`);
  }

  // Pre-seed admin user from env vars
  const adminGithubLogin = process.env.ADMIN_GITHUB_LOGIN;
  const adminGithubId = process.env.ADMIN_GITHUB_ID;
  if (adminGithubLogin && adminGithubId) {
    const existingAdmin = db.prepare(
      'SELECT id, role FROM users WHERE github_id = ?'
    ).get(parseInt(adminGithubId, 10)) as { id: string; role: string } | undefined;

    if (!existingAdmin) {
      const timestamp = now();
      const adminId = generateUserId();
      db.prepare(`
        INSERT INTO users (id, github_id, github_login, role, created_at, updated_at)
        VALUES (?, ?, ?, 'admin', ?, ?)
      `).run(adminId, parseInt(adminGithubId, 10), adminGithubLogin, timestamp, timestamp);
      log.info('Pre-seeded admin user from env', { login: adminGithubLogin, id: adminId });
    } else if (existingAdmin.role !== 'admin') {
      db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(existingAdmin.id);
      log.info('Promoted existing user to admin based on env', { login: adminGithubLogin, id: existingAdmin.id });
    }
  }
}

export function initDatabase(dbPath?: string): Database.Database {
  // Default to project root /data directory or ../data relative to dist
  const defaultDataDir = join(__dirname, '../../data'); // assuming src/db -> ../../data
  // Better handling for monorepo dev vs prod needed, but let's stick to explicit path or default

  const finalDbPath = dbPath || (process.env.DATABASE_PATH) || join(process.cwd(), 'data', 'capybara.db');
  const dataDir = dirname(finalDbPath);

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  log.info(`Initializing database at ${finalDbPath}`);
  const db = new Database(finalDbPath);

  // Enable WAL mode
  db.pragma('journal_mode = WAL');
  // Enable FKs
  db.pragma('foreign_keys = ON');
  // Production hardening
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // Run schema
  const schemaPath = join(__dirname, 'schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  } else {
    // If running from dist, might need to adjust path or embed schema
    // For now assume schema.sql is copied to dist/db/schema.sql
    log.warn('schema.sql not found at', { path: schemaPath });
  }

  // Run migrations
  const runMigrationsInTransaction = db.transaction(() => {
    runMigrations(db);
  });
  runMigrationsInTransaction();

  return db;
}
