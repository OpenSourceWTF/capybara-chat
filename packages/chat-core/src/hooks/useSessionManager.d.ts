import { SessionListResponse, SessionDetailResponse } from '../types';
interface UseSessionManagerResult {
    sessions: SessionListResponse['sessions'];
    loading: boolean;
    error: string | null;
    fetchSessions: () => Promise<void>;
    createSession: (options?: {
        agentDefinitionId?: string;
    }) => Promise<{
        id: string;
    } | null>;
    deleteSession: (sessionId: string) => Promise<boolean>;
    fetchSession: (sessionId: string) => Promise<SessionDetailResponse | null>;
}
export declare function useSessionManager(): UseSessionManagerResult;
export {};
//# sourceMappingURL=useSessionManager.d.ts.map