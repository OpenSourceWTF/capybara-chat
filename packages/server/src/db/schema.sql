-- Capybara Chat Server Schema (Stripped)
-- SQLite with JSON support

-- User accounts (local authentication)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',      -- 'admin' | 'member'
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

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

-- Chat sessions (assistant conversations)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_definition_id TEXT,

  session_type TEXT NOT NULL DEFAULT 'assistant:general', -- 'assistant:general' | 'assistant:prompt' | 'assistant:document' | 'assistant:agent'
  claude_session_id TEXT,               -- Maps to ~/.claude/sessions.db
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, PAUSED, WAITING_HUMAN, COMPLETE, FAILED
  forked_from_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  name TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  has_unread INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  last_reported_cost REAL NOT NULL DEFAULT 0,
  model TEXT,

  -- Entity-editing mode fields
  mode TEXT NOT NULL DEFAULT 'chat',
  editing_entity_type TEXT,
  editing_entity_id TEXT,
  form_context_injected INTEGER NOT NULL DEFAULT 0,

  -- Pipeline state (bridge message processing)
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
CREATE TABLE IF NOT EXISTS human_input_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_human_input_requests_session ON human_input_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_human_input_requests_status ON human_input_requests(status);

-- Documents and memories
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,                -- Markdown content
  type TEXT NOT NULL DEFAULT 'document', -- 'document' | 'memory'
  tags TEXT NOT NULL DEFAULT '[]',      -- JSON array of tags
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER                    -- Soft-delete timestamp
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);

-- Document version history
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,                -- Content at this version
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL              -- 'user' or 'agent'
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id, created_at);

-- Prompt segments (reusable prompt blocks)
CREATE TABLE IF NOT EXISTS prompt_segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,                -- Template with {{variables}}
  summary TEXT NOT NULL DEFAULT '',     -- AI-generated description
  tags TEXT NOT NULL DEFAULT '[]',      -- JSON array
  variables TEXT NOT NULL DEFAULT '[]', -- JSON array of variable names
  color TEXT NOT NULL DEFAULT '#E8D4B8', -- Visual color (default: Latte)
  status TEXT NOT NULL DEFAULT 'published',
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  output_type TEXT,                     -- spec, prompt, document, code, analysis
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER                    -- Soft-delete timestamp
);

CREATE INDEX IF NOT EXISTS idx_prompt_segments_status ON prompt_segments(status);

-- Agent definitions (agent templates and configurations)
CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  system_prompt_segment_id TEXT,
  model TEXT NOT NULL DEFAULT 'sonnet',
  role TEXT NOT NULL DEFAULT 'assistant',   -- assistant, subagent
  prefilled_conversation TEXT,
  subagent_links TEXT,
  mcp_servers TEXT,
  skills TEXT DEFAULT '[]',
  allowed_tools TEXT,
  tags TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  session_id TEXT,
  is_system INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (system_prompt_segment_id) REFERENCES prompt_segments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_definitions_slug ON agent_definitions(slug);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_role ON agent_definitions(role);

-- Session artifacts (files, diffs, logs)
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                   -- file, diff, log, screenshot, other
  content TEXT NOT NULL,
  mime_type TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id, created_at);
