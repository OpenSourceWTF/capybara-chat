/**
 * Capybara Event Bus Implementation
 * 
 * In-memory event bus with Socket.io bridge for real-time sync.
 * All state changes flow through this bus.
 */

import type {
  EventBus,
  CapybaraEvent,
  AllEventTypes,
  EventCategory,
  EventHandler,
  Unsubscribe
} from '@capybara-chat/types';
import { generateEventId, now, createLogger, TIMEOUTS } from '@capybara-chat/types';

const log = createLogger('EventBus');

export class CapybaraEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private categoryHandlers = new Map<EventCategory, Set<EventHandler>>();
  private anyHandlers = new Set<EventHandler>();
  private waitingPromises = new Map<string, { resolve: (event: CapybaraEvent) => void; reject: (err: Error) => void }[]>();

  emit<T>(partial: Omit<CapybaraEvent<T>, 'id' | 'timestamp'>): void {
    const event: CapybaraEvent<T> = {
      ...partial,
      id: generateEventId(),
      timestamp: now(),
    };

    // Log for debugging
    log.debug(`Event: ${event.type}`, { sessionId: event.metadata?.sessionId });

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        this.safeCall(handler, event);
      }
    }

    // Notify category handlers
    const catHandlers = this.categoryHandlers.get(event.category);
    if (catHandlers) {
      for (const handler of catHandlers) {
        this.safeCall(handler, event);
      }
    }

    // Notify any handlers
    for (const handler of this.anyHandlers) {
      this.safeCall(handler, event);
    }

    // Resolve waiting promises
    const waiting = this.waitingPromises.get(event.type);
    if (waiting) {
      for (const { resolve } of waiting) {
        resolve(event as CapybaraEvent);
      }
      this.waitingPromises.delete(event.type);
    }
  }

  on<T>(type: AllEventTypes, handler: EventHandler<T>): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  onCategory(category: EventCategory, handler: EventHandler): Unsubscribe {
    if (!this.categoryHandlers.has(category)) {
      this.categoryHandlers.set(category, new Set());
    }
    this.categoryHandlers.get(category)!.add(handler);

    return () => {
      this.categoryHandlers.get(category)?.delete(handler);
    };
  }

  onAny(handler: EventHandler): Unsubscribe {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  once<T>(type: AllEventTypes, handler: EventHandler<T>): Unsubscribe {
    const wrappedHandler: EventHandler<T> = (event) => {
      unsubscribe();
      handler(event);
    };
    const unsubscribe = this.on(type, wrappedHandler);
    return unsubscribe;
  }

  waitFor<T>(type: AllEventTypes, timeout: number = TIMEOUTS.EVENT_BUS): Promise<CapybaraEvent<T>> {
    return new Promise((resolve, reject) => {
      if (!this.waitingPromises.has(type)) {
        this.waitingPromises.set(type, []);
      }

      const entry = { resolve: resolve as (e: CapybaraEvent) => void, reject };
      this.waitingPromises.get(type)!.push(entry);

      // Timeout
      setTimeout(() => {
        const waiting = this.waitingPromises.get(type);
        if (waiting) {
          const idx = waiting.indexOf(entry);
          if (idx !== -1) {
            waiting.splice(idx, 1);
            reject(new Error(`Timeout waiting for event: ${type}`));
          }
        }
      }, timeout);
    });
  }

  private safeCall(handler: EventHandler, event: CapybaraEvent): void {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch((err) => {
          log.error('Handler error', err as Error, { eventType: event.type });
        });
      }
    } catch (err) {
      log.error('Handler error', err as Error, { eventType: event.type });
    }
  }
}

// Singleton instance
export const eventBus = new CapybaraEventBus();
