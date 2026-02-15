/**
 * Huddle UI Constants
 *
 * Centralized constants for localStorage keys, dimensions, and other magic values.
 */

// ===== Local Storage Keys =====
export const STORAGE_KEYS = {
  THEME: 'capybara-theme',
  SIDEBAR_WIDTH: 'capybara-sidebar-width',
  CURRENT_SESSION: 'capybara-current-session',
  SIDEBAR_COLLAPSED: 'capybara-sidebar-collapsed',
  // Layout panes: [Content | Chat || Sessions]
  SESSIONS_PANE_WIDTH: 'capybara-sessions-pane-width',
  CHAT_PANE_WIDTH: 'capybara-chat-pane-width',
  SESSIONS_PANE_COLLAPSED: 'capybara-sessions-pane-collapsed',
  SESSIONS_PANE_PINNED: 'capybara-sessions-pane-pinned',
  CHAT_COLORS: 'capybara-chat-colors',
  TAG_MATRIX_PINNED: 'capybara-tag-matrix-pinned',
} as const;

// ===== UI Dimensions =====
export const SIDEBAR = {
  MIN_WIDTH: 240,
  MAX_WIDTH: 400,
  DEFAULT_WIDTH: 300,
} as const;

// ===== Layout Modes =====
export const LAYOUT_MODES = {
  NORMAL: 'normal',
  FOCUS: 'focus',
  IMMERSIVE: 'immersive',
} as const;

export type LayoutMode = typeof LAYOUT_MODES[keyof typeof LAYOUT_MODES];

export const PANES = {
  // Content pane (visual left, takes remaining space)
  CONTENT: {
    MIN_WIDTH: 400,
  },
  // Chat pane (visual middle)
  CHAT: {
    MIN_WIDTH: 280,
    MAX_WIDTH: 2400,
    DEFAULT_WIDTH: 320,
  },
  // Sessions sidebar (visual right)
  SESSIONS: {
    MIN_WIDTH: 200,
    MAX_WIDTH: 400,
    DEFAULT_WIDTH: 280,
    COLLAPSED_WIDTH: 56,
  },
} as const;

// ===== API Configuration =====
export const API = {
  HEADERS: {
    CONTENT_TYPE: 'application/json',
    API_KEY_HEADER: 'X-Api-Key',
    AUTHORIZATION: 'Authorization',
  },
  DEFAULT_API_KEY: 'dev-key',
} as const;

// ===== Auth Configuration =====
export const AUTH = {
  /** Where the server redirects after GitHub OAuth */
  CALLBACK_PATH: '/auth/callback',
  /** REST endpoints */
  ENDPOINTS: {
    LOGIN: '/api/auth/github',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
  },
  /** localStorage key for remembering auth state (not the token itself) */
  STORAGE_KEY: 'capybara-auth-known',
} as const;

// ===== Display Constants =====
export const DISPLAY = {
  ID_PREVIEW_LENGTH: 8,        // Truncated ID display length
  CONTENT_PREVIEW_SHORT: 100,  // Short content preview
  CONTENT_PREVIEW_LONG: 200,   // Long content preview
  MAX_VISIBLE_TAGS: 3,         // Tags to show before "+N more"
} as const;
