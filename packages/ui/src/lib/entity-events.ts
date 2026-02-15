/**
 * Entity Event Bus - Unified event system for entity and session operations
 *
 * This provides a decoupled way to trigger entity editors and sessions from anywhere
 * in the application without prop drilling.
 *
 * Events:
 * - entity:new - Open editor for creating a new entity
 * - entity:edit - Open editor for editing an existing entity
 * - entity:view - Open entity in view mode (read-only)
 * - entity:close - Close the entity editor
 * - session:new - Create a new chat session
 *
 * Usage:
 * ```tsx
 * // Emit an event
 * import { entityEvents } from '../lib/entity-events';
 * entityEvents.emit('entity:new', { entityType: 'spec' });
 * entityEvents.emit('entity:view', { entityType: 'document', entityId: 'doc_123' });
 * entityEvents.emit('session:new', {});
 *
 * // Listen for events (in App.tsx)
 * entityEvents.on('entity:new', (payload) => { ... });
 * entityEvents.on('session:new', () => { ... });
 * ```
 */

import type { FormEntityType } from '@capybara-chat/types';

// Event payload types
export interface EntityNewEvent {
  entityType: FormEntityType;
  sessionId?: string;
}

export interface EntityEditEvent {
  entityType: FormEntityType;
  entityId: string;
  sessionId?: string;
}

export interface EntityViewEvent {
  entityType: FormEntityType;
  entityId: string;
  sessionId?: string;
}

export interface EntityCloseEvent {
  // No additional payload needed
}

export interface EntitySavedEvent {
  entityType: FormEntityType;
  entityId: string;
}

export interface SessionNewEvent {
  agentDefinitionId?: string;
}

// Event map for type safety
export interface EntityEventMap {
  'entity:new': EntityNewEvent;
  'entity:edit': EntityEditEvent;
  'entity:view': EntityViewEvent;
  'entity:close': EntityCloseEvent;
  'entity:saved': EntitySavedEvent;
  'session:new': SessionNewEvent;
}

// Type-safe event emitter
class EntityEventBus {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  on<K extends keyof EntityEventMap>(
    event: K,
    callback: (payload: EntityEventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (payload: unknown) => void);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as (payload: unknown) => void);
    };
  }

  emit<K extends keyof EntityEventMap>(event: K, payload: EntityEventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(payload));
    }
  }

  off<K extends keyof EntityEventMap>(
    event: K,
    callback: (payload: EntityEventMap[K]) => void
  ): void {
    this.listeners.get(event)?.delete(callback as (payload: unknown) => void);
  }

  // Clear all listeners (useful for testing)
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const entityEvents = new EntityEventBus();

// Convenience functions for common operations
export function openNewEntity(entityType: FormEntityType, sessionId?: string): void {
  entityEvents.emit('entity:new', { entityType, sessionId });
}

export function openEditEntity(entityType: FormEntityType, entityId: string, sessionId?: string): void {
  entityEvents.emit('entity:edit', { entityType, entityId, sessionId });
}

export function openViewEntity(entityType: FormEntityType, entityId: string, sessionId?: string): void {
  entityEvents.emit('entity:view', { entityType, entityId, sessionId });
}

export function closeEntityEditor(): void {
  entityEvents.emit('entity:close', {});
}

export function createNewSession(agentDefinitionId?: string): void {
  entityEvents.emit('session:new', { agentDefinitionId });
}

export function notifyEntitySaved(entityType: FormEntityType, entityId: string): void {
  entityEvents.emit('entity:saved', { entityType, entityId });
}
