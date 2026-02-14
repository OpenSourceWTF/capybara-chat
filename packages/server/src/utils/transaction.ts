/**
 * Transaction Utility
 */

import type Database from 'better-sqlite3';

export function withTransaction<T>(
  db: Database.Database,
  fn: () => T
): T {
  const runInTransaction = db.transaction(fn);
  return runInTransaction();
}

export async function withTransactionAsync<T>(
  db: Database.Database,
  fn: () => Promise<T>
): Promise<T> {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = await fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
