/**
 * Bridge Connection Service
 *
 * Manages the connection state to the agent bridge.
 */

import type { Socket } from 'socket.io';
import { now } from '@capybara-chat/types';
import { createServerSocketConnectionManager } from '../utils/socket-connection-manager.js';

/**
 * Bridge connection metadata
 */
interface BridgeMetadata {
  bridgeId: string;
  uid: number | null;
  gid: number | null;
}

/**
 * Bridge connection status
 */
export interface BridgeStatus {
  status: 'online' | 'offline';
  bridgeId: string | null;
  connectedAt: number | null;
  uid?: number | null;
  gid?: number | null;
}

/**
 * Service for tracking bridge connection state
 */
export interface BridgeConnectionService {
  getSocket(): Socket | null;
  getBridgeId(): string | null;
  isConnected(): boolean;
  getStatus(): BridgeStatus;
  getUidGid(): { uid: number; gid: number } | null;
  connect(socket: Socket, bridgeId: string, uid?: number | null, gid?: number | null): void;
  disconnect(): string | null;
}

/**
 * Create a bridge connection service
 */
export function createBridgeConnectionService(): BridgeConnectionService {
  // Use idempotent socket connection manager
  const socketManager = createServerSocketConnectionManager<BridgeMetadata>('BridgeConnection');

  return {
    getSocket(): Socket | null {
      return socketManager.getSocket();
    },

    getBridgeId(): string | null {
      return socketManager.getMetadata()?.bridgeId ?? null;
    },

    isConnected(): boolean {
      return socketManager.isConnected();
    },

    getStatus(): BridgeStatus {
      const status = socketManager.getStatus();
      const metadata = status.metadata;

      return {
        status: status.connected ? 'online' : 'offline',
        bridgeId: metadata?.bridgeId ?? null,
        connectedAt: status.connectedAt,
        uid: metadata?.uid ?? null,
        gid: metadata?.gid ?? null,
      };
    },

    /**
     * Get bridge UID/GID for chown operations.
     * Returns null if bridge not connected or UID/GID not reported.
     */
    getUidGid(): { uid: number; gid: number } | null {
      const metadata = socketManager.getMetadata();
      if (metadata && metadata.uid !== null && metadata.gid !== null) {
        return { uid: metadata.uid, gid: metadata.gid };
      }
      return null;
    },

    connect(socket: Socket, bridgeId: string, uid?: number | null, gid?: number | null): void {
      // Socket manager automatically handles disconnection of old sockets
      socketManager.connect(socket, bridgeId, {
        bridgeId,
        uid: uid ?? null,
        gid: gid ?? null,
      });
    },

    disconnect(): string | null {
      const metadata = socketManager.disconnect();
      return metadata?.bridgeId ?? null;
    },
  };
}
