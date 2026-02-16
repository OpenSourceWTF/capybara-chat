/**
 * Capybara Chat Shared Utilities
 *
 * Centralized utilities for consistent behavior across packages.
 */

// Use crypto.randomUUID for Node.js environments
// This is available in Node 16+ and modern browsers
const getRandomUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ===== ID Generation =====

/**
 * Generate a unique session ID
 * Format: sess_<uuid>
 */
export function generateSessionId(): string {
  return `sess_${getRandomUUID()}`;
}

/**
 * Generate a unique message ID
 * Format: msg_<uuid>
 */
export function generateMessageId(): string {
  return `msg_${getRandomUUID()}`;
}

/**
 * Generate a unique event ID
 * Format: evt_<uuid>
 */
export function generateEventId(): string {
  return `evt_${getRandomUUID()}`;
}

/**
 * Generate a unique agent ID
 * Format: agent_<uuid>
 */
export function generateAgentId(): string {
  return `agent_${getRandomUUID()}`;
}

/**
 * Generate a unique segment ID
 * Format: seg_<uuid>
 */
export function generateSegmentId(): string {
  return `seg_${getRandomUUID()}`;
}

/**
 * Generate a unique document ID
 * Format: doc_<uuid>
 */
export function generateDocumentId(): string {
  return `doc_${getRandomUUID()}`;
}

/**
 * Generate a unique document version ID
 * Format: dv_<uuid>
 */
export function generateDocumentVersionId(): string {
  return `dv_${getRandomUUID()}`;
}

/**
 * Generate a unique request ID
 * Format: req_<uuid>
 */
export function generateRequestId(): string {
  return `req_${getRandomUUID()}`;
}

/**
 * Generate a generic unique ID (UUID v4)
 */
export function generateId(): string {
  return getRandomUUID();
}

/**
 * Generate a prefixed unique ID
 * @param prefix - The prefix to prepend (e.g., 'prompt', 'doc')
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${getRandomUUID()}`;
}

// ===== Timestamp Utilities =====

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Validation Utilities =====

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if a string is a valid prefixed ID (e.g., sess_<uuid>, msg_<uuid>)
 */
export function isValidPrefixedId(str: string, prefix?: string): boolean {
  if (prefix) {
    if (!str.startsWith(`${prefix}_`)) return false;
    return isValidUUID(str.slice(prefix.length + 1));
  }
  const parts = str.split('_');
  if (parts.length !== 2) return false;
  return isValidUUID(parts[1]);
}

// ===== Fetch Utilities =====

/**
 * Assert that a fetch response is OK, throwing a descriptive error if not
 */
export async function assertFetchOk(
  response: Response,
  operation: string
): Promise<void> {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to ${operation}: ${error}`);
  }
}

// ===== JSON Utilities =====

/**
 * Safely parse JSON with a fallback value.
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ===== SQL Utilities =====

/**
 * Field mapping for dynamic update queries.
 */
export interface FieldMapping {
  column: string;
  transform?: (value: unknown) => unknown;
}

export interface DynamicUpdateResult {
  setClauses: string[];
  params: unknown[];
  hasChanges: boolean;
}

/**
 * Build dynamic UPDATE query parts from a DTO.
 */
export function buildDynamicUpdate<T>(
  data: T,
  fieldMappings: { [K in keyof T]?: FieldMapping }
): DynamicUpdateResult {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [key, mapping] of Object.entries(fieldMappings) as Array<[keyof T & string, FieldMapping | undefined]>) {
    if (!mapping) continue;
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined) {
      setClauses.push(`${mapping.column} = ?`);
      params.push(mapping.transform ? mapping.transform(value) : value);
    }
  }

  return {
    setClauses,
    params,
    hasChanges: setClauses.length > 0,
  };
}

// ===== Row Mapping Utilities =====

export interface RowFieldConfig {
  column: string;
  property?: string;
  fromDb?: (value: unknown) => unknown;
}

/**
 * Pre-built field transforms for common database patterns
 */
export const FieldTransforms = {
  jsonArray: (v: unknown) => safeJsonParse(v as string, []),
  jsonObject: (v: unknown) => safeJsonParse(v as string, {}),
  jsonOptional: (v: unknown) => (v ? JSON.parse(v as string) : undefined),
  boolean: (v: unknown) => Boolean(v),
  string: (v: unknown) => v as string,
  number: (v: unknown) => v as number,
  optional: (v: unknown) => v ?? undefined,
};

/**
 * Create a row mapper function from field configurations.
 */
export function createRowMapper<T>(
  fields: { [K in keyof T]: RowFieldConfig }
): (row: unknown) => T {
  return (row: unknown): T => {
    const r = row as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [prop, config] of Object.entries(fields) as Array<[string, RowFieldConfig]>) {
      const rawValue = r[config.column];
      result[prop] = config.fromDb ? config.fromDb(rawValue) : rawValue;
    }

    return result as T;
  };
}

// ===== Query Building Utilities =====

export interface SelectQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface SelectQueryResult {
  sql: string;
  params: unknown[];
}

/**
 * Build a SELECT query with standard ordering and pagination.
 */
export function buildSelectQuery(
  table: string,
  options?: SelectQueryOptions,
  defaultOrderBy = 'created_at',
  defaultOrderDir: 'asc' | 'desc' = 'desc',
  whereClause?: string,
  whereParams: unknown[] = []
): SelectQueryResult {
  let sql = `SELECT * FROM ${table}`;
  const params: unknown[] = [...whereParams];

  if (whereClause) {
    sql += ` WHERE ${whereClause}`;
  }

  const orderBy = options?.orderBy ?? defaultOrderBy;
  const orderDir = (options?.orderDir ?? defaultOrderDir).toUpperCase();
  sql += ` ORDER BY ${orderBy} ${orderDir}`;

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  return { sql, params };
}

