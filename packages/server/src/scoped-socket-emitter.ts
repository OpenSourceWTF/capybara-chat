export interface ScopedSocketEmitter {
  emitToSession(sessionId: string, event: string, payload: any): void;
  emitToUser(userId: string, event: string, payload: any): void;
  emitProgress(sessionId: string, progress: any): void;
}
