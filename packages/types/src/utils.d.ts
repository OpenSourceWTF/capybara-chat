/**
 * Capybara Shared Utilities
 *
 * Centralized utilities for consistent behavior across packages.
 */
/**
 * Generate a unique session ID
 * Format: sess_<uuid>
 */
export declare function generateSessionId(): string;
/**
 * Generate a unique message ID
 * Format: msg_<uuid>
 */
export declare function generateMessageId(): string;
/**
 * Generate a unique event ID
 * Format: evt_<uuid>
 */
export declare function generateEventId(): string;
/**
 * Generate a unique task ID
 * Format: task_<uuid>
 */
export declare function generateTaskId(): string;
/**
 * Generate a unique agent ID
 * Format: agent_<uuid>
 */
export declare function generateAgentId(): string;
/**
 * Generate a unique worktree ID
 * Format: wt_<taskId>_<timestamp>
 */
export declare function generateWorktreeId(taskId: string): string;
/**
 * Generate a unique spec ID
 * Format: spec_<uuid>
 */
export declare function generateSpecId(): string;
/**
 * Generate a unique workspace ID
 * Format: ws_<uuid>
 */
export declare function generateWorkspaceId(): string;
/**
 * Generate a unique pipeline ID
 * Format: pipe_<uuid>
 */
export declare function generatePipelineId(): string;
/**
 * Generate a unique segment ID
 * Format: seg_<uuid>
 */
export declare function generateSegmentId(): string;
/**
 * Generate a unique document ID
 * Format: doc_<uuid>
 */
export declare function generateDocumentId(): string;
/**
 * Generate a unique document version ID
 * Format: dv_<uuid>
 */
export declare function generateDocumentVersionId(): string;
/**
 * Generate a unique request ID
 * Format: req_<uuid>
 */
export declare function generateRequestId(): string;
/**
 * Generate a generic unique ID (UUID v4)
 */
export declare function generateId(): string;
/**
 * Generate a prefixed unique ID
 * @param prefix - The prefix to prepend (e.g., 'spec', 'task')
 */
export declare function generatePrefixedId(prefix: string): string;
/**
 * Get current timestamp in milliseconds
 */
export declare function now(): number;
/**
 * Sleep for a specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 *
 * @example
 * await sleep(1000); // Wait 1 second
 * await sleep(50);   // Wait 50ms
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Check if a string is a valid UUID
 */
export declare function isValidUUID(str: string): boolean;
/**
 * Check if a string is a valid prefixed ID (e.g., sess_<uuid>, msg_<uuid>)
 */
export declare function isValidPrefixedId(str: string, prefix?: string): boolean;
/**
 * Assert that a fetch response is OK, throwing a descriptive error if not
 */
export declare function assertFetchOk(response: Response, operation: string): Promise<void>;
/**
 * Safely parse JSON with a fallback value.
 * Returns the fallback if parsing fails or input is null/undefined.
 *
 * @example
 * safeJsonParse('{"foo": 1}', {}) // { foo: 1 }
 * safeJsonParse('invalid', {}) // {}
 * safeJsonParse(null, []) // []
 */
export declare function safeJsonParse<T>(value: string | null | undefined, fallback: T): T;
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
export declare function buildDynamicUpdate<T>(data: T, fieldMappings: {
    [K in keyof T]?: FieldMapping;
}): DynamicUpdateResult;
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
export declare const FieldTransforms: {
    /** Parse JSON array, defaulting to empty array */
    jsonArray: (v: unknown) => never[];
    /** Parse JSON object, defaulting to empty object */
    jsonObject: (v: unknown) => {};
    /** Parse JSON or return undefined if null/empty */
    jsonOptional: (v: unknown) => any;
    /** Convert SQLite integer (0/1) to boolean */
    boolean: (v: unknown) => boolean;
    /** Pass through as string */
    string: (v: unknown) => string;
    /** Pass through as number */
    number: (v: unknown) => number;
    /** Pass through or undefined */
    optional: (v: unknown) => {} | undefined;
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
export declare function createRowMapper<T>(fields: {
    [K in keyof T]: RowFieldConfig;
}): (row: unknown) => T;
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
export declare function buildSelectQuery(table: string, options?: SelectQueryOptions, defaultOrderBy?: string, defaultOrderDir?: 'asc' | 'desc', whereClause?: string, whereParams?: unknown[]): SelectQueryResult;
/**
 * Parse a GitHub URL into owner and repo components
 * Handles both HTTPS and SSH formats
 */
export declare function parseGitHubUrl(url: string): {
    owner: string;
    repo: string;
} | null;
//# sourceMappingURL=utils.d.ts.map