/**
 * useEntityEvents - Hook for listening to entity and session events
 *
 * Subscribes to the entity event bus and automatically cleans up on unmount.
 */

import { useEffect, useCallback } from 'react';
import { entityEvents, openNewEntity, openEditEntity, openViewEntity, closeEntityEditor, createNewSession } from '../lib/entity-events';
import type { EntityNewEvent, EntityEditEvent, EntityViewEvent, SessionNewEvent } from '../lib/entity-events';

interface UseEntityEventsOptions {
  onNew?: (event: EntityNewEvent) => void;
  onEdit?: (event: EntityEditEvent) => void;
  onView?: (event: EntityViewEvent) => void;
  onClose?: () => void;
  onSessionNew?: (agentDefinitionId?: string) => void;
}

/**
 * Hook to listen for entity and session events
 *
 * @example
 * ```tsx
 * useEntityEvents({
 *   onNew: (e) => setActiveEditor({ entityType: e.entityType, sessionId: e.sessionId }),
 *   onEdit: (e) => setActiveEditor({ entityType: e.entityType, entityId: e.entityId }),
 *   onClose: () => setActiveEditor(null),
 *   onSessionNew: () => handleNewChat(),
 * });
 * ```
 */
export function useEntityEvents(options: UseEntityEventsOptions): void {
  const { onNew, onEdit, onView, onClose, onSessionNew } = options;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onNew) {
      unsubscribers.push(entityEvents.on('entity:new', onNew));
    }
    if (onEdit) {
      unsubscribers.push(entityEvents.on('entity:edit', onEdit));
    }
    if (onView) {
      unsubscribers.push(entityEvents.on('entity:view', onView));
    }
    if (onClose) {
      unsubscribers.push(entityEvents.on('entity:close', onClose));
    }
    if (onSessionNew) {
      unsubscribers.push(entityEvents.on('session:new', (event: SessionNewEvent) => {
        onSessionNew(event.agentDefinitionId);
      }));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [onNew, onEdit, onView, onClose, onSessionNew]);
}

/**
 * Hook that returns entity and session event emitters
 *
 * @example
 * ```tsx
 * const { emitNew, emitEdit, emitClose, emitNewSession } = useEntityEventEmitters();
 *
 * // In a button click handler
 * emitNew('spec');
 * emitNewSession();
 * ```
 */
export function useEntityEventEmitters() {
  const emitNew = useCallback((entityType: Parameters<typeof openNewEntity>[0], sessionId?: string) => {
    openNewEntity(entityType, sessionId);
  }, []);

  const emitEdit = useCallback((entityType: Parameters<typeof openEditEntity>[0], entityId: string, sessionId?: string) => {
    openEditEntity(entityType, entityId, sessionId);
  }, []);

  const emitView = useCallback((entityType: Parameters<typeof openViewEntity>[0], entityId: string, sessionId?: string) => {
    openViewEntity(entityType, entityId, sessionId);
  }, []);

  const emitClose = useCallback(() => {
    closeEntityEditor();
  }, []);

  const emitNewSession = useCallback((agentDefinitionId?: string) => {
    createNewSession(agentDefinitionId);
  }, []);

  return { emitNew, emitEdit, emitView, emitClose, emitNewSession };
}
