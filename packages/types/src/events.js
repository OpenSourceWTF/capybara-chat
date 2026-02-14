/**
 * Capybara Event Bus Types
 *
 * Event-driven architecture from day 1 - no retrofitting.
 * All state changes emit events; UI and services subscribe.
 */
// ===== Event Source =====
export const EventSource = {
    SERVER: 'server',
    AGENT_BRIDGE: 'agent-bridge',
    AGENT: 'agent',
    UI: 'ui',
    WORKSPACE_CLONE_SERVICE: 'workspace-clone-service',
    WORKSPACE_LIFECYCLE_MANAGER: 'workspace-lifecycle-manager',
    WORKSPACE_SERVICE: 'workspace-service',
    WORKTREE_SERVICE: 'worktree-service',
    GIT_SERVICE: 'git-service',
    WORKSPACE_SYNC_JOB: 'workspace-sync-job',
    WORKTREE_CLEANUP_JOB: 'worktree-cleanup-job',
    TASK_PR_SYNC_JOB: 'task-pr-sync-job',
};
//# sourceMappingURL=events.js.map