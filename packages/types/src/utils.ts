/**
 * Capybara Shared Utilities
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
 * Generate a unique task ID
 * Format: task_<uuid>
 */
export function generateTaskId(): string {
  return `task_${getRandomUUID()}`;
}

/**
 * Generate a unique agent ID
 * Format: agent_<uuid>
 */
export function generateAgentId(): string {
  return `agent_${getRandomUUID()}`;
}

/**
 * Generate a unique worktree ID
 * Format: wt_<taskId>_<timestamp>
 */
export function generateWorktreeId(taskId: string): string {
  return `wt_${taskId}_${Date.now()}`;
}

/**
 * Generate a unique spec ID
 * Format: spec_<uuid>
 */
export function generateSpecId(): string {
  return `spec_${getRandomUUID()}`;
}

/**
 * Generate a unique workspace ID
 * Format: ws_<uuid>
 */
export function generateWorkspaceId(): string {
  return `ws_${getRandomUUID()}`;
}

/**
 * Generate a unique pipeline ID
 * Format: pipe_<uuid>
 */
export function generatePipelineId(): string {
  return `pipe_${getRandomUUID()}`;
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
 * @param prefix - The prefix to prepend (e.g., 'spec', 'task')
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
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 *
 * @example
 * await sleep(1000); // Wait 1 second
 * await sleep(50);   // Wait 50ms
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
 * Returns the fallback if parsing fails or input is null/undefined.
 *
 * @example
 * safeJsonParse('{"foo": 1}', {}) // { foo: 1 }
 * safeJsonParse('invalid', {}) // {}
 * safeJsonParse(null, []) // []
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
 * Maps DTO property names to SQL column names with optional transform.
 */
export interface FieldMapping {
  /** SQL column name (snake_case) */
  column: string;
  /** Optional transform function for the value (e.g., JSON.stringify for arrays) */
  transform?: (value: unknown) => unknown;
}

/**
 * Result of building a dynamic UPDATE query
 */
export interface DynamicUpdateResult {
  /** SQL SET clause parts (e.g., ['name = ?', 'status = ?']) */
  setClauses: string[];
  /** Parameter values for the SET clause */
  params: unknown[];
  /** Whether any fields were included */
  hasChanges: boolean;
}

/**
 * Build dynamic UPDATE query parts from a DTO.
 * Only includes fields that are explicitly defined (not undefined).
 *
 * @param data - The DTO with optional fields
 * @param fieldMappings - Map of DTO property names to SQL columns
 * @returns Object with SET clauses and params
 *
 * @example
 * const result = buildDynamicUpdate(
 *   { name: 'New Name', status: undefined },
 *   {
 *     name: { column: 'name' },
 *     status: { column: 'status' },
 *     tags: { column: 'tags', transform: JSON.stringify },
 *   }
 * );
 * // result.setClauses = ['name = ?']
 * // result.params = ['New Name']
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

/**
 * Configuration for a single field mapping (database column → entity property)
 */
export interface RowFieldConfig {
  /** Source column name (snake_case) */
  column: string;
  /** Target property name (camelCase) - defaults to column if not specified */
  property?: string;
  /** Transform function applied when reading from database */
  fromDb?: (value: unknown) => unknown;
}

/**
 * Pre-built field transforms for common database patterns
 */
export const FieldTransforms = {
  /** Parse JSON array, defaulting to empty array */
  jsonArray: (v: unknown) => safeJsonParse(v as string, []),
  /** Parse JSON object, defaulting to empty object */
  jsonObject: (v: unknown) => safeJsonParse(v as string, {}),
  /** Parse JSON or return undefined if null/empty */
  jsonOptional: (v: unknown) => (v ? JSON.parse(v as string) : undefined),
  /** Convert SQLite integer (0/1) to boolean */
  boolean: (v: unknown) => Boolean(v),
  /** Pass through as string */
  string: (v: unknown) => v as string,
  /** Pass through as number */
  number: (v: unknown) => v as number,
  /** Pass through or undefined */
  optional: (v: unknown) => v ?? undefined,
};

/**
 * Create a row mapper function from field configurations.
 * Automatically converts snake_case columns to camelCase properties.
 *
 * @example
 * const mapRow = createRowMapper<Agent>({
 *   id: { column: 'id' },
 *   workspaceIds: { column: 'workspace_ids', fromDb: FieldTransforms.jsonArray },
 *   createdAt: { column: 'created_at' },
 * });
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

/**
 * Options for building SELECT queries
 */
export interface SelectQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

/**
 * Result of building a SELECT query
 */
export interface SelectQueryResult {
  sql: string;
  params: unknown[];
}

/**
 * Build a SELECT query with standard ordering and pagination.
 *
 * @param table - Table name
 * @param options - Query options (limit, offset, orderBy, orderDir)
 * @param defaultOrderBy - Default ORDER BY column (defaults to 'created_at')
 * @param defaultOrderDir - Default order direction (defaults to 'DESC')
 * @param whereClause - Optional WHERE clause (without 'WHERE' keyword)
 * @param whereParams - Parameters for WHERE clause
 *
 * @example
 * const { sql, params } = buildSelectQuery('agents', { limit: 10 });
 * // sql = 'SELECT * FROM agents ORDER BY created_at DESC LIMIT ?'
 * // params = [10]
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

// ===== GitHub URL Utilities =====

/**
 * Parse a GitHub URL into owner and repo components
 * Handles both HTTPS and SSH formats
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo(.git)
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // Handle: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^.]+)/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}
