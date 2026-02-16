/**
 * Capybara Chat Server
 *
 * Main entry point for the standalone chat server.
 * Initializes database, middleware, routes, and socket.io.
 */

import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';


// Load environment variables early
import 'dotenv/config';

// 1. Core imports
import {
  CORS_DEFAULTS,
  SERVER_DEFAULTS,
  SOCKET_EVENTS,
  SessionHistoryEventType,
  MessageStatus
} from '@capybara-chat/types';

import { createExpressApp, getCorsConfig } from './app/express-app.js';
import { initializeDatabase } from './app/database-init.js';
import { eventBus } from './events/event-bus.js';
import { createSessionRoutes } from './routes/session-routes.js';
import { createAuthRoutes } from './routes/auth-routes.js';
import { createHealthRoutes } from './routes/health-routes.js';
import { createDocumentRoutes } from './routes/document-routes.js';
import { createPromptSegmentRoutes } from './routes/prompt-routes.js';
import { createAgentDefinitionRoutes } from './routes/agent-definition-routes.js';

// 2. Middleware & Utils
import {
  createLogger,
  requestLogger,
  errorMiddleware,
  dualAuth,
  socketDualAuth,
  setAuthUserRepo,
  rateLimit,
} from './middleware/index.js';
import {
  ScopedSocketEmitter,
  userRoom,
  ROOM_BRIDGE,
  ROOM_AUTHENTICATED,
} from './services/scoped-socket-emitter.js';
import { createBridgeConnectionService } from './services/bridge-connection-service.js';
import { MessageStatusService } from './services/message-status-service.js';
import { messageQueue } from './services/message-queue.js';
import { socketHandler } from './middleware/socket-handler.js';
import { ServiceRegistry } from './services/base-service.js';

const log = createLogger('Server');

async function startServer() {
  try {
    log.info('Starting Capybara Chat Server...');

    // --------------------------------------------------------
    // 1. Initialize Database & Repositories
    // --------------------------------------------------------
    const dbPath = process.env.DATABASE_PATH || 'capybara-chat.db';
    const { db, repos } = initializeDatabase(dbPath);

    // Initialize ServiceRegistry (loads persisted state)
    ServiceRegistry.initializeAll();

    // Inject user repo into auth middleware for X-User-Id lookups
    setAuthUserRepo(repos.userRepo);

    // --------------------------------------------------------
    // 2. Setup Express App
    // --------------------------------------------------------
    const corsConfig = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          ...CORS_DEFAULTS.DEVELOPMENT_ORIGINS,
          ...(process.env.CORS_ALLOWED_ORIGINS?.split(',') || []),
        ];

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      ...CORS_DEFAULTS,
      methods: [...CORS_DEFAULTS.methods],
      allowedHeaders: [...CORS_DEFAULTS.allowedHeaders],
      exposedHeaders: [...CORS_DEFAULTS.exposedHeaders],
    };

    const app = express();
    app.use(requestLogger);
    app.use(express.json());
    app.use(cors(corsConfig));

    const server = http.createServer(app);

    // --------------------------------------------------------
    // 3. Setup Socket.IO
    // --------------------------------------------------------
    const io = new SocketIOServer(server, {
      cors: corsConfig,
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    // --------------------------------------------------------
    // 4. Setup Services
    // --------------------------------------------------------
    const socketEmitter = new ScopedSocketEmitter(io, repos.sessionRepo);
    const bridgeConnection = createBridgeConnectionService();
    const messageStatusService = new MessageStatusService({
      messageRepo: repos.messageRepo,
      emitter: socketEmitter,
    });

    // Initialize Message Queue Deps
    if (repos.messageRepo) {
      messageQueue.initDeps(io, repos.messageRepo, messageStatusService, socketEmitter);
    }

    // Socket Middleware: Authentication
    io.use((socket, next) => socketDualAuth(socket as any, next as any));

    io.on('connection', (socket) => {
      const { userId, userRole } = socket.data as { userId: string; userRole: string };
      const isBridge = userId === 'system';

      log.info('Client connected', {
        socketId: socket.id,
        userId,
        userRole,
        isBridge,
      });

      // Join rooms
      if (isBridge) {
        socket.join(ROOM_BRIDGE);
      } else if (userId) {
        socket.join(userRoom(userId));
        socket.join(ROOM_AUTHENTICATED);
      }

      // Basic handlers
      socket.on('session:subscribe', (sessionId: string) => {
        // In a real app, verify access
        void socket.join(`session:${sessionId}`);
        log.debug('Socket joined session', { socketId: socket.id, sessionId });
      });

      socket.on('session:unsubscribe', (sessionId: string) => {
        void socket.leave(`session:${sessionId}`);
      });

      // ------------------------------------------------------
      // Bridge & Relay Handlers
      // ------------------------------------------------------

      // Bridge registration
      socket.on(SOCKET_EVENTS.BRIDGE_REGISTER, (data) => {
        if (userRole === 'admin') {
          log.info('Bridge registered', { socketId: socket.id, bridgeId: data.bridgeId });

          bridgeConnection.connect(socket, data.bridgeId, data.uid, data.gid);
          socketEmitter.toAuthenticated(SOCKET_EVENTS.AGENT_STATUS, { status: 'online', bridgeId: data.bridgeId });

          // Process queued messages
          if (messageQueue.size > 0) {
            log.info('Processing queued messages after bridge reconnect', { queueSize: messageQueue.size });
            messageQueue.processQueue(socket);
          }
        }
      });

      // Command Results (GAP-001)
      socket.on(SOCKET_EVENTS.COMMAND_RESULT, socketHandler(socket, { eventName: SOCKET_EVENTS.COMMAND_RESULT }, async (data: any) => {
        log.info('Command result', { sessionId: data.sessionId, command: data.command, success: data.success });

        // Persist as assistant message
        if (repos.messageRepo) {
          try {
            repos.messageRepo.create({
              sessionId: data.sessionId,
              role: 'assistant',
              content: data.result,
              status: MessageStatus.COMPLETED
            });
          } catch (err) {
            log.warn('Failed to persist command result', { sessionId: data.sessionId, error: String(err) });
          }
        }

        // Notify session owner
        socketEmitter.toSessionOwner(data.sessionId, SOCKET_EVENTS.SESSION_RESPONSE, {
          sessionId: data.sessionId,
          messageId: data.messageId,
          message: {
            id: `cmd-${Date.now()}`,
            content: data.result,
            role: 'assistant',
            streaming: false,
            createdAt: Date.now(),
          },
        });

        if (data.messageId) {
          messageStatusService.markCompleted(data.sessionId, data.messageId);
        }
      }));

      // Message Status (GAP-003)
      socket.on(SOCKET_EVENTS.MESSAGE_STATUS, (data: { sessionId: string; messageId: string; status: string }) => {
        log.debug('Forwarding message status', { sessionId: data.sessionId, messageId: data.messageId, status: data.status });
        messageStatusService.updateAndEmit(data.sessionId, data.messageId, data.status);
      });

      // Heartbeat (GAP-005)
      socket.on(SOCKET_EVENTS.BRIDGE_HEARTBEAT, (data) => {
        // Simplified implementation: log heartbeat
        log.debug('Bridge heartbeat received', { activeMessages: data.activeMessageIds?.length });
      });

      // Session Message Relay (GAP-002)
      socket.on(SOCKET_EVENTS.SESSION_MESSAGE, (data: { sessionId: string }) => {
        socketEmitter.toSessionOwner(data.sessionId, SOCKET_EVENTS.SESSION_MESSAGE, { sessionId: data.sessionId });
      });

      // Relay Events (Generic) - bridge → session owner
      const RELAY_EVENTS = [
        SOCKET_EVENTS.SESSION_THINKING,
        SOCKET_EVENTS.SESSION_PROGRESS,
        SOCKET_EVENTS.SESSION_ERROR,
        SOCKET_EVENTS.SESSION_RESPONSE,
        SOCKET_EVENTS.SESSION_ACTIVITY,
        SOCKET_EVENTS.SESSION_HALTED,
        SOCKET_EVENTS.SESSION_CONTEXT_USAGE,
        SOCKET_EVENTS.SESSION_COMPACTED,
        SOCKET_EVENTS.SESSION_COST,
      ];

      RELAY_EVENTS.forEach(event => {
        socket.on(event, (data: any) => {
          if (data.sessionId) {
            socketEmitter.toSessionOwner(data.sessionId, event, data);
          }
        });
      });

      // Persist-and-relay: SESSION_RESPONSE with message persistence
      socket.on(SOCKET_EVENTS.SESSION_RESPONSE, socketHandler(socket, { eventName: SOCKET_EVENTS.SESSION_RESPONSE }, async (data: any) => {
        if (data.message && !data.message.streaming && repos.messageRepo) {
          try {
            repos.messageRepo.create({
              sessionId: data.sessionId,
              role: 'assistant',
              content: data.message.content,
              status: MessageStatus.COMPLETED,
            });
          } catch (err) {
            log.warn('Failed to persist response', { sessionId: data.sessionId, error: String(err) });
          }
        }
      }));

      // Disconnect
      socket.on('disconnect', () => {
        log.info(`Socket disconnected: ${socket.id}`);
        if (bridgeConnection.getSocket() === socket) {
          log.info('Bridge disconnected');
          const bridgeId = bridgeConnection.disconnect();
          socketEmitter.toAuthenticated(SOCKET_EVENTS.AGENT_STATUS, { status: 'offline', bridgeId });
        }
      });
    });

    // --------------------------------------------------------
    // 5. Setup Routes
    // --------------------------------------------------------

    // Health
    app.use('/health', createHealthRoutes());

    // Auth
    app.use('/api/auth', createAuthRoutes({
      userRepo: repos.userRepo,
      authSessionRepo: repos.authSessionRepo
    }));

    // Sessions
    app.use('/api/sessions', dualAuth, createSessionRoutes(
      repos.sessionRepo,
      repos.messageRepo,
      repos.eventRepo,
      db
    ));

    // Documents
    app.use('/api/documents', dualAuth, createDocumentRoutes(
      repos.documentRepo,
      repos.userRepo
    ));

    // Prompts (segments only)
    app.use('/api/prompts', dualAuth, createPromptSegmentRoutes(
      repos.promptSegmentRepo
    ));

    // Agent Definitions
    app.use('/api/agent-definitions', dualAuth, createAgentDefinitionRoutes(
      repos.agentDefinitionRepo,
      repos.userRepo
    ));

    // Global Error Handler
    app.use(errorMiddleware);

    // --------------------------------------------------------
    // 6. Connect Event Bus to Socket.IO
    // --------------------------------------------------------
    // Listen for session events and broadcast to relevant rooms
    eventBus.onCategory('session', (event) => {
      const sessionId = event.metadata?.sessionId;
      if (sessionId) {
        socketEmitter.emitToSession(sessionId, event.type, event.payload);
      }
    });

    // Broadcast document/prompt/agent events to all authenticated users
    for (const category of ['document', 'memory', 'prompt', 'agentDefinition'] as const) {
      eventBus.onCategory(category, (event) => {
        socketEmitter.toAuthenticated(event.type, event.payload);
      });
    }

    // --------------------------------------------------------
    // 7. Start Listening
    // --------------------------------------------------------
    const port = process.env.PORT || SERVER_DEFAULTS.SERVER_PORT;
    const host = process.env.HOST || '0.0.0.0';

    server.listen(Number(port), host, () => {
      log.info(`Server listening on ${host}:${port}`);
      log.info(`Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      log.info('SIGTERM received. Shutting down...');
      await ServiceRegistry.shutdown();
      server.close(() => {
        db.close();
        process.exit(0);
      });
    });

  } catch (error) {
    log.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();
