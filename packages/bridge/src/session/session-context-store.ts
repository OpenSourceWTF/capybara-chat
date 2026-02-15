/**
 * Session Context Store
 *
 * In-memory storage for session contexts.
 * Provides CRUD operations with validation.
 *
 * FIX (GAP-021): Validates on update to catch bugs early
 * FIX (GAP-022): Improved dumpSession() formatting for debugging
 */

import type { SessionContext, SessionStatus } from './session-context.js';

/**
 * Session Context Store
 *
 * Manages in-memory session contexts with validation.
 */
export class SessionContextStore {
  private contexts = new Map<string, SessionContext>();

  /**
   * Get existing context or create new one
   *
   * @param sessionId - Session ID
   * @returns Session context
   */
  getOrCreate(sessionId: string): SessionContext {
    let ctx = this.contexts.get(sessionId);
    if (!ctx) {
      ctx = {
        sessionId,
        status: 'idle',
        currentMessage: {
          id: '',
          content: '',
          createdAt: 0,
        },
        queue: { inbound: [], outbound: [] },
        events: [],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };
      this.contexts.set(sessionId, ctx);
    }
    return ctx;
  }

  /**
   * Get existing context (returns undefined if not found)
   *
   * @param sessionId - Session ID
   * @returns Session context or undefined
   */
  get(sessionId: string): SessionContext | undefined {
    return this.contexts.get(sessionId);
  }

  /**
   * Update session context
   *
   * FIX (GAP-021): Validates sessionId matches and session exists
   *
   * @param ctx - Session context to update
   * @throws Error if session doesn't exist
   */
  update(ctx: SessionContext): void {
    // Validate that we're updating the right session
    const existing = this.contexts.get(ctx.sessionId);
    if (!existing) {
      throw new Error(
        `Cannot update non-existent session ${ctx.sessionId}. ` +
        `Use getOrCreate() first.`
      );
    }

    // Additional safety: Ensure we're not accidentally updating wrong session
    if (existing !== ctx) {
      // Different object reference - might be corruption
      console.warn(
        `Warning: Updating session ${ctx.sessionId} with different object reference. ` +
        `This might indicate a bug.`
      );
    }

    this.contexts.set(ctx.sessionId, ctx);
  }

  /**
   * Delete session context
   *
   * @param sessionId - Session ID
   */
  delete(sessionId: string): void {
    this.contexts.delete(sessionId);
  }

  /**
   * Get all session IDs
   *
   * @returns Array of session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Clear all sessions
   *
   * 199-Task-1.3: For singleton reset and tests
   */
  clear(): void {
    this.contexts.clear();
  }

  /**
   * Get sessions in bad states (for monitoring)
   *
   * @returns Array of session contexts that appear stuck or errored
   */
  getBadSessions(): SessionContext[] {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    return Array.from(this.contexts.values()).filter(ctx => {
      // Error status
      if (ctx.status === 'error') return true;

      // Stuck in non-idle status for too long
      const age = now - ctx.lastActivityAt;
      if (age > STALE_THRESHOLD && ctx.status !== 'idle' && ctx.status !== 'complete') {
        return true;
      }

      return false;
    });
  }

  /**
   * Dump session state to logs (for debugging)
   *
   * FIX (GAP-022): Better formatting, summary stats, pretty output
   *
   * @param sessionId - Session ID
   */
  dumpSession(sessionId: string): void {
    const ctx = this.contexts.get(sessionId);
    if (!ctx) {
      console.log(`Session ${sessionId} not found`);
      return;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SESSION STATE DUMP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`  Session ID:     ${ctx.sessionId}`);
    console.log(`  Status:         ${ctx.status}`);
    console.log(`  Claude Session: ${ctx.claudeSessionId || 'none'}`);
    console.log(`  Age:            ${formatDuration(Date.now() - ctx.createdAt)}`);
    console.log(`  Last Activity:  ${formatDuration(Date.now() - ctx.lastActivityAt)} ago`);
    console.log(`  Queue Size:     ${ctx.queue.inbound.length} inbound, ${ctx.queue.outbound.length} outbound`);

    // Context usage
    if (ctx.contextUsage) {
      const pct = ctx.contextUsage.percent;
      const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      console.log(`  Context Usage:  [${bar}] ${pct}% (${ctx.contextUsage.used}/${ctx.contextUsage.total})`);
    }
    console.log('');

    // Event statistics
    console.log('📈 EVENT STATISTICS:');
    console.log(`  Total Events:   ${ctx.events.length}`);

    const eventTypes = ctx.events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEvents = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topEvents.forEach(([type, count]) => {
      console.log(`    ${count}x ${type}`);
    });
    console.log('');

    // Recent events (last 20)
    console.log('📜 RECENT EVENTS (last 20):');
    console.log('┌──────────────────────────┬────────────────────────────────────┬────────────────┐');
    console.log('│ Timestamp                │ Event Type                         │ Status         │');
    console.log('├──────────────────────────┼────────────────────────────────────┼────────────────┤');

    const recentEvents = ctx.events.slice(-20);
    recentEvents.forEach(event => {
      const time = new Date(event.timestamp).toISOString().slice(11, 23);
      const type = event.type.padEnd(34).slice(0, 34);
      const status = event.status.padEnd(14).slice(0, 14);
      console.log(`│ ${time} │ ${type} │ ${status} │`);

      // Show data if present and small enough
      if (event.data && Object.keys(event.data).length > 0) {
        const dataStr = JSON.stringify(event.data);
        if (dataStr.length < 60) {
          console.log(`│                          │   └─ ${dataStr.padEnd(32).slice(0, 32)} │                │`);
        }
      }
    });

    console.log('└──────────────────────────┴────────────────────────────────────┴────────────────┘\n');

    // Current message
    if (ctx.currentMessage && ctx.currentMessage.id) {
      console.log('💬 CURRENT MESSAGE:');
      console.log(`  ID:       ${ctx.currentMessage.id}`);
      console.log(`  Length:   ${ctx.currentMessage.content.length} characters`);
      console.log(`  Preview:  ${ctx.currentMessage.content.slice(0, 100)}${ctx.currentMessage.content.length > 100 ? '...' : ''}`);
      console.log('');
    }

    // Full state (compact JSON)
    console.log('🔍 FULL STATE:');
    console.log(JSON.stringify({
      sessionId: ctx.sessionId,
      status: ctx.status,
      claudeSessionId: ctx.claudeSessionId,
      queueSize: {
        inbound: ctx.queue.inbound.length,
        outbound: ctx.queue.outbound.length,
      },
      contextUsage: ctx.contextUsage,
      ages: {
        created: Date.now() - ctx.createdAt,
        lastActivity: Date.now() - ctx.lastActivityAt,
      },
      eventCount: ctx.events.length,
    }, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

/**
 * Format duration in human-readable form
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// === SINGLETON SUPPORT (199-Task-1.3) ===
// Production singleton to allow shared access across services.
// Follows same pattern as other state managers.

let defaultStore: SessionContextStore | null = null;

/**
 * Get the production singleton instance.
 * Creates instance on first call.
 */
export function getSessionContextStore(): SessionContextStore {
  if (!defaultStore) {
    defaultStore = new SessionContextStore();
  }
  return defaultStore;
}

/**
 * Reset the singleton - for tests only!
 */
export function resetSessionContextStore(): void {
  if (defaultStore) {
    defaultStore.clear();
  }
  defaultStore = null;
}

/**
 * Create a new independent instance - for tests only!
 */
export function createSessionContextStore(): SessionContextStore {
  return new SessionContextStore();
}
