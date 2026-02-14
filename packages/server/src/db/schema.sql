-- Capybara Chat Server Schema (Stripped)
-- SQLite with JSON support

-- User accounts (GitHub-authenticated)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  github_token TEXT,
  role TEXT NOT NULL DEFAULT 'member',      -- 'admin' | 'member'
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_github_login ON users(github_login);

-- Refresh token store
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Execution sessions
-- Note: FKs to workspaces, agents, specs removed for standalone chat server
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  -- References (decoupled)
  spec_id TEXT,
  workspace_id TEXT,
  agent_id TEXT,
  agent_definition_id TEXT,
  
  worktree_path TEXT,
  session_type TEXT NOT NULL DEFAULT 'agent', -- 'agent' | 'assistant:spec' | 'assistant:prompt' | 'assistant:general'
  claude_session_id TEXT,               -- Maps to ~/.claude/sessions.db
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, PAUSED, WAITING_HUMAN, COMPLETE, FAILED
  forked_from_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  container_id TEXT,
  name TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  has_unread INTEGER NOT NULL DEFAULT 0,
  pr_url TEXT,
  pr_number INTEGER,
  total_cost REAL NOT NULL DEFAULT 0,
  last_reported_cost REAL NOT NULL DEFAULT 0,
  model TEXT,
  
  -- Entity-editing mode fields
  mode TEXT NOT NULL DEFAULT 'chat',
  editing_entity_type TEXT,
  editing_entity_id TEXT,
  form_context_injected INTEGER NOT NULL DEFAULT 0,
  
  -- Pipeline / Workflow State (from migration 199)
  pipeline_status TEXT DEFAULT 'idle',
  pipeline_message_id TEXT,
  pipeline_message_content TEXT,
  pipeline_context_injected INTEGER DEFAULT 0,
  pipeline_context_usage TEXT,
  pipeline_last_activity INTEGER,

  created_by TEXT REFERENCES users(id),
  started_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                    -- user, assistant, system
  content TEXT NOT NULL,
  tool_use TEXT,                         -- JSON
  status TEXT NOT NULL DEFAULT 'sent',   -- sent, queued, processing, completed, failed
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

-- Session timeline events
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- 'opened' | 'closed' | 'resumed' | 'agent_assigned' | 'error'
  metadata TEXT,                         -- JSON
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, created_at);

-- Human input requests
-- Note: task_id is now just a string, as worker_tasks table is excluded
CREATE TABLE IF NOT EXISTS human_input_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  question TEXT NOT NULL,
  context TEXT,
  options TEXT,                              -- JSON array
  timeout INTEGER NOT NULL DEFAULT 1800000,
  created_at INTEGER NOT NULL,
  responded_at INTEGER,
  response TEXT,
  responded_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending'     -- pending, responded, timeout, cancelled
);

CREATE INDEX IF NOT EXISTS idx_human_input_requests_task ON human_input_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_human_input_requests_status ON human_input_requests(status);
