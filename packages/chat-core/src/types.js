import { SOCKET_EVENTS, SessionType, SessionHistoryEventType, FormEntityType, SessionMode, } from '@capybara-chat/types';
export { SOCKET_EVENTS, SessionType, SessionHistoryEventType, FormEntityType, SessionMode, };
// API Error
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}
//# sourceMappingURL=types.js.map