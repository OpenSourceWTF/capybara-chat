/**
 * Route Parser - Pure functions for URL ↔ navigation state conversion
 *
 * URL Schema:
 *   /                    → dashboard
 *   /:tab                → library view
 *   /:tab/:entityId      → entity view mode
 *   /:tab/:entityId/edit → entity edit mode
 *   /:tab/new            → entity create mode
 *
 * Query params:
 *   ?session=sess_xxx    → selected chat session
 */

type Tab = 'dashboard' | 'specs' | 'prompts' | 'documents' | 'agents' | 'tasks' | 'sessions' | 'workspaces' | 'new-task';

export interface NavigationState {
  tab: Tab;
  entityId?: string;
  entityMode?: 'view' | 'edit';
  sessionId?: string;
}

const TAB_PATHS: Record<Tab, string> = {
  dashboard: '',
  specs: 'specs',
  prompts: 'prompts',
  documents: 'documents',
  agents: 'agents',
  tasks: 'tasks',
  sessions: 'sessions',
  workspaces: 'workspaces',
  'new-task': 'new-task',
};

const PATH_TO_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab])
) as Record<string, Tab>;

/**
 * Parse a URL pathname + search into NavigationState
 */
export function parseRoute(pathname: string, search: string): NavigationState {
  const params = new URLSearchParams(search);
  const sessionId = params.get('session') || undefined;

  // Normalize: strip leading/trailing slashes, split segments
  const segments = pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

  // "/" → dashboard
  if (segments.length === 0) {
    return { tab: 'dashboard', sessionId };
  }

  // First segment is the tab
  const tabPath = segments[0];
  const tab = PATH_TO_TAB[tabPath];

  if (!tab) {
    // Unknown path — default to dashboard
    return { tab: 'dashboard', sessionId };
  }

  // "/:tab" → library
  if (segments.length === 1) {
    return { tab, sessionId };
  }

  // "/:tab/new" → create mode
  if (segments[1] === 'new') {
    return { tab, entityId: 'new', entityMode: 'edit', sessionId };
  }

  const entityId = segments[1];

  // "/:tab/:entityId/edit" → edit mode
  if (segments.length >= 3 && segments[2] === 'edit') {
    return { tab, entityId, entityMode: 'edit', sessionId };
  }

  // "/:tab/:entityId" → view mode
  return { tab, entityId, entityMode: 'view', sessionId };
}

/**
 * Build a URL path from NavigationState
 */
export function buildPath(state: Partial<NavigationState>): string {
  const tab = state.tab || 'dashboard';
  const tabPath = TAB_PATHS[tab];

  let path = tabPath ? `/${tabPath}` : '/';

  if (state.entityId) {
    path += `/${state.entityId}`;
    if (state.entityMode === 'edit') {
      path += '/edit';
    }
  }

  // Add session query param if present
  if (state.sessionId) {
    path += `?session=${encodeURIComponent(state.sessionId)}`;
  }

  return path;
}
