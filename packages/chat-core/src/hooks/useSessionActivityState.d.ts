import { SessionActivityData, SessionProgressData, SessionBlockedData, SessionHaltedData, SessionHumanInputData, SessionContextResetData, SessionCostData } from '../types';
interface State {
    activity: SessionActivityData | null;
    progress: SessionProgressData | null;
    blocked: SessionBlockedData | null;
    halted: SessionHaltedData | null;
    humanRequest: SessionHumanInputData | null;
    contextReset: SessionContextResetData | null;
    cost: SessionCostData | null;
}
export declare function useSessionActivityState(sessionId: string | null): {
    state: State;
    actions: {
        sendHumanInputResponse: (response: string) => void;
        clearHumanRequest: () => void;
        clearBlocked: () => void;
        clearHalted: () => void;
        clearContextReset: () => void;
    };
};
export {};
//# sourceMappingURL=useSessionActivityState.d.ts.map