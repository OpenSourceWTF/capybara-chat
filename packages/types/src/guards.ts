/**
 * Type Guards
 *
 * Runtime type checking utilities.
 */

import type {
  Session,
  ChatMessage,
} from './index.js';

/**
 * Check if a value is a non-null object (Record-like)
 */
export function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Check if a value is an array
 */
export function isArray(obj: unknown): obj is unknown[] {
  return Array.isArray(obj);
}

/**
 * Check if a value is a string
 */
export function isString(obj: unknown): obj is string {
  return typeof obj === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(obj: unknown): obj is number {
  return typeof obj === 'number' && !isNaN(obj);
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(obj: unknown): obj is boolean {
  return typeof obj === 'boolean';
}

/**
 * Safely get a property from an unknown object
 */
export function getProperty<T>(obj: unknown, key: string): T | undefined {
  if (isRecord(obj) && key in obj) {
    return obj[key] as T;
  }
  return undefined;
}

/**
 * Safely get a string property from an unknown object
 */
export function getStringProperty(obj: unknown, key: string): string | undefined {
  const value = getProperty(obj, key);
  return isString(value) ? value : undefined;
}

/**
 * Safely get a number property from an unknown object
 */
export function getNumberProperty(obj: unknown, key: string): number | undefined {
  const value = getProperty(obj, key);
  return isNumber(value) ? value : undefined;
}

function hasStringProperty(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && typeof obj[key] === 'string';
}

function hasNumberProperty(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && typeof obj[key] === 'number';
}

/**
 * Type guard for Session
 */
export function isSession(obj: unknown): obj is Session {
  if (!isRecord(obj)) return false;
  return (
    hasStringProperty(obj, 'id') &&
    hasStringProperty(obj, 'sessionType') &&
    hasStringProperty(obj, 'status') &&
    hasNumberProperty(obj, 'startedAt') &&
    hasNumberProperty(obj, 'lastActivityAt')
  );
}

/**
 * Type guard for ChatMessage
 */
export function isChatMessage(obj: unknown): obj is ChatMessage {
  if (!isRecord(obj)) return false;
  return (
    hasStringProperty(obj, 'id') &&
    hasStringProperty(obj, 'sessionId') &&
    hasStringProperty(obj, 'role') &&
    hasStringProperty(obj, 'content') &&
    hasNumberProperty(obj, 'createdAt')
  );
}

/**
 * Assert a value is not null or undefined
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message ?? 'Value is null or undefined');
  }
}

/**
 * Assert a value is a record
 */
export function assertRecord(value: unknown, message?: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message ?? 'Value is not a record');
  }
}
