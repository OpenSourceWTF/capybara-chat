/**
 * Session Routes
 *
 * All messages and events stored in DB, no localStorage.
 * Uses Zod schemas for request validation.
 */

import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { SQLiteSessionRepository } from '../repositories/session-repository.js';
import type { SQLiteMessageRepository } from '../repositories/message-repository.js';
import { SessionHistoryEventType, type SQLiteSessionEventRepository } from '../repositories/session-event-repository.js';
import { eventBus } from '../events/event-bus.js';
import { asyncHandler, Errors, requireFound, getPaginationParams, parseQueryBool, validateBody } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { generateMessageId, now, CONTENT_LENGTHS, PAGINATION, SessionType } from '@capybara-chat/types';
import {
  CreateSessionSchema,
  UpdateSessionSchema,
  CreateChatMessageSchema,
  UpdateMessageStatusSchema,
  CreateSessionEventSchema,
  ForkSessionSchema,
} from '@capybara-chat/types';
import { withTransaction } from '../utils/index.js';

export interface SessionRoutesOptions {
  sessionRepo: SQLiteSessionRepository;
  messageRepo?: SQLiteMessageRepository;
  eventRepo?: SQLiteSessionEventRepository;
  db?: Database.Database;
}

export function createSessionRoutes(
  sessionRepo: SQLiteSessionRepository,
  messageRepo?: SQLiteMessageRepository,
  eventRepo?: SQLiteSessionEventRepository,
  db?: Database.Database
): Router {
  const router = Router();

  /** Helper: scope-check a session by ID (private-only: only owner or admin) */
  function requireOwnSession(req: import('express').Request, sessionId: string) {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    return requireFound(sessionRepo.forUser(userId, role, false).findById(sessionId), 'Session');
  }

  // GET /api/sessions - List sessions
  router.get('/', asyncHandler(async (req, res) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const scoped = sessionRepo.forUser(userId, role, false);
    const { status, type, editingEntityType, editingEntityId } = req.query;
    const { limit, offset } = getPaginationParams(req, { defaultLimit: PAGINATION.SESSION_LIST_LIMIT });

    let sessions;
    if (parseQueryBool(req.query.pipelineActive)) {
      // Find sessions with active pipeline states for crash recovery
      sessions = scoped.filterVisible(sessionRepo.findStalePipelines(0, { limit, offset }));
    } else if (parseQueryBool(req.query.active)) {
      sessions = scoped.filterVisible(sessionRepo.findActive({ limit, offset }));
    } else if (editingEntityType && editingEntityId) {
      sessions = scoped.filterVisible(sessionRepo.findAllByEditingEntity(
        editingEntityType as string,
        editingEntityId as string,
        { limit, offset }
      ));
    } else if (status) {
      sessions = scoped.filterVisible(sessionRepo.findByStatus(status as import('@capybara-chat/types').SessionStatus, { limit, offset }));
    } else if (type) {
      sessions = scoped.filterVisible(sessionRepo.findByType(type as import('@capybara-chat/types').SessionType, false, { limit, offset }));
    } else {
      sessions = scoped.findAll({ limit, offset });
    }

    // No enrichment service in stripped version
    const enrichedSessions = sessions;

    res.json({ sessions: enrichedSessions, total: sessions.length });
  }));

  // GET /api/sessions/:id - Get session by ID
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const session = requireFound(sessionRepo.forUser(userId, role, false).findById(req.params.id), 'Session');
    res.json(session);
  }));

  // POST /api/sessions - Create new session
  router.post('/', validateBody(CreateSessionSchema), asyncHandler(async (req, res) => {
    const { id: userId } = (req as AuthenticatedRequest).user;
    const { specId, workspaceId, worktreePath, agentId, agentDefinitionId, claudeSessionId, forkedFromId, type, sessionType: bodySessionType } = req.body;

    // No spec/agentRepo checks in stripped version

    const effectiveType = type ?? bodySessionType;
    const sessionType = effectiveType || SessionType.AGENT;

    const createSessionWithEvent = () => {
      const session = sessionRepo.create({
        specId,
        workspaceId,
        worktreePath,
        sessionType: sessionType as import('@capybara-chat/types').SessionType,
        agentId,
        agentDefinitionId,
        claudeSessionId,
        forkedFromId,
        createdBy: userId,
      });

      if (eventRepo) {
        eventRepo.create({
          sessionId: session.id,
          type: SessionHistoryEventType.OPENED,
        });
      }

      return session;
    };

    const session = db
      ? withTransaction(db, createSessionWithEvent)
      : createSessionWithEvent();

    res.status(201).json(session);
  }));

  // PATCH /api/sessions/:id
  router.patch('/:id', validateBody(UpdateSessionSchema), asyncHandler(async (req, res) => {
    const { id: userId, role } = (req as AuthenticatedRequest).user;
    const {
      name, status, agentId, containerId, hidden, claudeSessionId, workspaceId, worktreePath,
      mode: model, editingEntityType, editingEntityId, formContextInjected,
    } = req.body;
    const session = requireFound(
      sessionRepo.forUser(userId, role, false).update(req.params.id, {
        name, status, agentId, containerId, hidden, claudeSessionId, workspaceId, worktreePath,
        model, editingEntityType, editingEntityId, formContextInjected,
      }),
      'Session'
    );
    res.json(session);
  }));

  // DELETE /api/sessions/:id
  router.delete('/:id', asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    requireOwnSession(req, sessionId);

    const hideSessionWithEvent = () => {
      const hidden = sessionRepo.hideSession(sessionId);
      if (!hidden) {
        throw Errors.notFound('Session');
      }

      if (eventRepo) {
        eventRepo.create({
          sessionId,
          type: SessionHistoryEventType.CLOSED,
        });
      }

      return hidden;
    };

    if (db) {
      withTransaction(db, hideSessionWithEvent);
    } else {
      hideSessionWithEvent();
    }

    eventBus.emit({
      type: 'session:hidden',
      category: 'session',
      source: 'server',
      payload: { sessionId },
      metadata: { sessionId },
    });

    res.status(204).send();
  }));

  // POST /api/sessions/:id/read
  router.post('/:id/read', asyncHandler(async (req, res) => {
    const session = requireOwnSession(req, req.params.id);

    sessionRepo.update(session.id, { hasUnread: false });

    eventBus.emit({
      type: 'session:updated',
      category: 'session',
      source: 'server',
      payload: {
        session: { ...session, hasUnread: false },
      },
      metadata: { sessionId: session.id },
    });

    res.json({ success: true, sessionId: session.id, hasUnread: false });
  }));

  // POST /api/sessions/:id/fork
  router.post('/:id/fork', validateBody(ForkSessionSchema), asyncHandler(async (req, res) => {
    const { id: userId } = (req as AuthenticatedRequest).user;
    const parent = requireOwnSession(req, req.params.id);
    const forked = sessionRepo.create({
      specId: parent.specId,
      sessionType: parent.sessionType,
      agentId: req.body.agentId ?? parent.agentId,
      agentDefinitionId: parent.agentDefinitionId,
      claudeSessionId: parent.claudeSessionId,
      forkedFromId: parent.id,
      createdBy: userId,
    });

    res.status(201).json(forked);
  }));

  // POST /api/sessions/:id/messages
  router.post('/:id/messages', validateBody(CreateChatMessageSchema), asyncHandler(async (req, res) => {
    const session = requireOwnSession(req, req.params.id);
    const { content, role, toolUse, status } = req.body;

    // No slash command service in stripped version

    const message = messageRepo
      ? messageRepo.create({
        sessionId: session.id,
        role,
        content,
        toolUse,
        status,
      })
      : {
        id: generateMessageId(),
        sessionId: session.id,
        role,
        content,
        toolUse,
        createdAt: now(),
      };

    let updatedSession = session;
    if (role === 'user' && !session.name && messageRepo) {
      const messageCount = messageRepo.count(session.id);
      if (messageCount === 1) {
        const displayName = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        updatedSession = sessionRepo.update(session.id, { name: displayName }) || session;
      }
    }

    sessionRepo.update(session.id, {});

    const messageCount = messageRepo ? messageRepo.count(session.id) : 0;
    eventBus.emit({
      type: 'session:updated',
      category: 'session',
      source: 'server',
      payload: {
        session: {
          ...updatedSession,
          messageCount,
          lastMessage: {
            content: content.slice(0, 50),
            role,
            createdAt: message.createdAt,
          },
        },
      },
      metadata: { sessionId: session.id },
    });

    res.status(201).json({ message, status: 'saved' });
  }));

  // GET /api/sessions/:id/messages
  router.get('/:id/messages', asyncHandler(async (req, res) => {
    const session = requireOwnSession(req, req.params.id);
    const { limit, offset } = getPaginationParams(req);

    const messages = messageRepo
      ? messageRepo.findBySessionId(session.id, { limit, offset })
      : [];

    const total = messageRepo ? messageRepo.count(session.id) : 0;

    res.json({
      messages,
      sessionId: session.id,
      total,
    });
  }));

  // GET /api/sessions/:id/messages/status
  router.get('/:id/messages/status', asyncHandler(async (req, res) => {
    const session = requireOwnSession(req, req.params.id);
    if (!messageRepo) {
      res.json({ status: 'unknown', message: null });
      return;
    }

    const lastUserMessage = messageRepo.findLastUserMessage(session.id);

    if (!lastUserMessage) {
      res.json({ status: 'none', message: null, needsResend: false });
      return;
    }

    const messages = messageRepo.findBySessionId(session.id, { limit: 20 });
    const lastUserIdx = messages.findIndex(m => m.id === lastUserMessage.id);
    const hasAssistantResponse = lastUserIdx >= 0 &&
      messages.slice(lastUserIdx + 1).some(m => m.role === 'assistant');

    const needsResend = !hasAssistantResponse &&
      (lastUserMessage.status === 'sent' || lastUserMessage.status === 'failed');

    res.json({
      status: lastUserMessage.status,
      messageId: lastUserMessage.id,
      content: lastUserMessage.content.slice(0, 30),
      createdAt: lastUserMessage.createdAt,
      hasAssistantResponse,
      needsResend,
    });
  }));

  // PATCH /api/sessions/:id/messages/:messageId/status
  router.patch('/:id/messages/:messageId/status', validateBody(UpdateMessageStatusSchema), asyncHandler(async (req, res) => {
    requireOwnSession(req, req.params.id);
    const { status } = req.body;

    if (!messageRepo) {
      throw Errors.internal('Message repository not available');
    }

    const updated = messageRepo.updateStatus(req.params.messageId, status);
    if (!updated) {
      throw Errors.notFound('Message');
    }

    res.json({ status });
  }));

  // GET /api/sessions/:id/timeline (simplified)
  router.get('/:id/timeline', asyncHandler(async (req, res) => {
    const session = requireOwnSession(req, req.params.id);
    const { limit } = getPaginationParams(req, { defaultLimit: 40 });
    const beforeTimestamp = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

    const paginatedResult = messageRepo
      ? messageRepo.findPaginated(session.id, { limit, beforeTimestamp })
      : { messages: [], nextCursor: null, hasMore: false };

    const { messages, nextCursor, hasMore } = paginatedResult;

    // Fetch tool events if available
    const messageIds = messages.map(m => m.id);
    const toolEventsByMessageId = eventRepo && messageIds.length > 0
      ? eventRepo.findToolsByMessageIds(session.id, messageIds)
      : [];

    const minTime = messages.length > 0 ? messages[0].createdAt : 0;
    const maxTime = messages.length > 0 ? messages[messages.length - 1].createdAt : Date.now();

    const allEventsInRange = eventRepo
      ? eventRepo.findBySessionId(session.id, { limit: limit * 10 })
      : [];

    const hasTimeRange = messages.length > 0;
    const isLifecycleEvent = (type: string) =>
      type === SessionHistoryEventType.OPENED || type === SessionHistoryEventType.CLOSED;

    // Filter events
    const filteredEvents = hasTimeRange
      ? allEventsInRange.filter(e =>
        (e.createdAt >= minTime && e.createdAt <= maxTime) || isLifecycleEvent(e.type)
      )
      : allEventsInRange;

    const nonToolEvents = filteredEvents.filter(e =>
      e.type !== SessionHistoryEventType.TOOL_USE
    );

    const legacyToolEvents = filteredEvents.filter(e =>
      e.type === SessionHistoryEventType.TOOL_USE &&
      (!e.metadata || !(e.metadata as Record<string, unknown>).messageId)
    );

    const toolEvents = [...toolEventsByMessageId, ...legacyToolEvents];

    // Deduplicate tool uses (same logic as before)
    const toolUseMap = new Map<string, any>();

    for (const e of toolEvents) {
      if (!e.metadata) continue;
      const meta = e.metadata as Record<string, unknown>;
      const toolUseId = meta.toolUseId as string;
      if (!toolUseId) continue;

      const existing = toolUseMap.get(toolUseId);
      if (existing) {
        // Merge
        existing.output = existing.output ?? meta.output;
        existing.error = existing.error ?? meta.error as string | undefined;
        existing.status = existing.error ? 'error' : existing.output !== undefined ? 'complete' : 'running';
      } else {
        const hasOutput = meta.output !== undefined;
        const hasError = meta.error !== undefined;
        toolUseMap.set(toolUseId, {
          itemType: 'tool_use',
          id: toolUseId,
          sessionId: e.sessionId,
          toolName: meta.toolName as string,
          input: meta.input,
          output: meta.output,
          error: meta.error as string | undefined,
          parentToolUseId: meta.parentToolUseId as string | null | undefined,
          elapsedMs: meta.elapsedMs as number | undefined,
          status: (hasError ? 'error' : hasOutput ? 'complete' : 'running'),
          timestamp: meta.timestamp as number || e.createdAt,
          createdAt: e.createdAt,
          messageId: meta.messageId as string | undefined,
        });
      }
    }

    const timeline = [
      ...messages.map(m => ({ ...m, itemType: 'message' as const })),
      ...Array.from(toolUseMap.values()),
      ...nonToolEvents.map(e => ({ ...e, itemType: 'event' as const })),
    ].sort((a: any, b: any) => a.createdAt - b.createdAt);

    res.json({
      timeline,
      sessionId: session.id,
      total: timeline.length,
      pagination: {
        nextCursor,
        hasMore,
      },
    });
  }));

  // POST /api/sessions/:id/events
  router.post('/:id/events', validateBody(CreateSessionEventSchema), asyncHandler(async (req, res) => {
    const session = requireOwnSession(req, req.params.id);
    const { type, metadata } = req.body;

    if (!eventRepo) {
      throw Errors.internal('Event repository not available');
    }

    const event = eventRepo.create({
      sessionId: session.id,
      type,
      metadata,
    });

    res.status(201).json(event);
  }));

  return router;
}
