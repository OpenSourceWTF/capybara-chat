/**
 * Capybara Huddle - Main Application
 *
 * 2-pane layout: [Content] | [Chat] (168-right-bar-elimination)
 *
 * Uses React.lazy() for code splitting on view components
 * to reduce initial bundle size.
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTheme } from './hooks/useTheme';
import { useEntityEvents } from './hooks/useEntityEvents';
import { notifyEntitySaved } from './lib/entity-events';
import { useNavigationState } from './hooks/useNavigationState';
import { SocketProvider } from './context/SocketContext';
import { useServer } from './context/ServerContext';
import { useSocket } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { NavigationGuardProvider, useNavigationGuard } from './context/NavigationGuardContext';
import { StatusIndicator } from './components/ui/StatusIndicator';
import { LayoutModeProvider, useLayoutMode } from './context/LayoutModeContext';
import {
  AdaptiveLayout,
  GeneralConversation,
  WorkspaceManager,
  SpecsLibrary,
  SessionsManager,
  PromptsLibrary,
  DocumentsLibrary,
  AgentDefinitionsLibrary,
  TasksLibrary,
  Dashboard,
  DevMenu,
  HelpModal,
  SpawnTaskPanel,
  ViewFallback,
  ErrorBoundary,
} from './components';

// Lazy-loaded view components (code splitting)
// These are only loaded when viewing a specific entity
const SpecView = lazy(() => import('./components/views/SpecView').then(m => ({ default: m.SpecView })));
const PromptView = lazy(() => import('./components/views/PromptView').then(m => ({ default: m.PromptView })));
const DocumentView = lazy(() => import('./components/views/DocumentView').then(m => ({ default: m.DocumentView })));
const AgentDefinitionView = lazy(() => import('./components/views/AgentDefinitionView').then(m => ({ default: m.AgentDefinitionView })));
const SessionDetailView = lazy(() => import('./components/views/SessionDetailView').then(m => ({ default: m.SessionDetailView })));
const TaskDetailView = lazy(() => import('./components/tasks/TaskDetailView').then(m => ({ default: m.TaskDetailView })));
import { api } from './lib/api';
import { createLogger } from './lib/logger';
import { STORAGE_KEYS } from './constants';
import { SessionType, API_PATHS, type FormEntityType } from '@capybara-chat/types';
import type { Spec, PromptSegment, Document, AgentDefinition } from '@capybara-chat/types';
import type { ParsedCommand } from './lib/slash-command-parser';
import type { EntityNewEvent, EntityEditEvent, EntityViewEvent } from './lib/entity-events';

const log = createLogger('App');

type Tab = 'dashboard' | 'specs' | 'prompts' | 'documents' | 'agents' | 'tasks' | 'sessions' | 'workspaces' | 'new-task';

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◉' },
  { id: 'specs', label: 'Specs', icon: '◈' },
  { id: 'prompts', label: 'Prompts', icon: '¶' },
  { id: 'documents', label: 'Docs', icon: '📄' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'tasks', label: 'Tasks', icon: '⚡' },
  { id: 'sessions', label: 'Sessions', icon: '◎' },
  { id: 'workspaces', label: 'Repos', icon: '⌂' },
];

/** Map FormEntityType to Tab for navigation */
const ENTITY_TYPE_TO_TAB: Record<FormEntityType, Tab> = {
  spec: 'specs',
  prompt: 'prompts',
  document: 'documents',
  agentDefinition: 'agents',
  pipeline: 'dashboard', // pipelines not routable yet
};

function AppContent() {
  const { theme, toggleTheme } = useTheme('midnight');
  const { serverUrl } = useServer();
  const { connected: serverConnected, agentStatus } = useSocket();
  const { setCurrentSessionId: setLayoutSessionId } = useLayoutMode();
  const { user, logout } = useAuth();

  // URL-driven navigation state
  const { state: navState, navigateToTab, navigateToEntity, setSessionId: setUrlSessionId } = useNavigationState();
  const activeTab = navState.tab;
  const { navigate: safeNavigate } = useNavigationGuard();

  // Session state: priority is URL query param > localStorage > auto-select
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return navState.sessionId || localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
  });

  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Pre-selected spec when navigating to new-task from SpecView
  const pendingSpecIdRef = useRef<string | null>(null);

  // Session handlers
  const handleNewChat = useCallback((agentDefinitionId?: string, workspaceId?: string) => {
    safeNavigate(async () => {
      log.info('handleNewChat called', { agentDefinitionId, workspaceId });
      try {
        const payload = {
          type: SessionType.ASSISTANT_GENERAL,
          ...(agentDefinitionId ? { agentDefinitionId } : {}),
          ...(workspaceId ? { workspaceId } : {}),
        };
        log.info('Creating session with payload', { payload });
        const res = await api.post(`${serverUrl}${API_PATHS.SESSIONS}`, payload);
        if (res.ok) {
          const data = await res.json();
          setCurrentSessionId(data.id);
        }
      } catch (err) {
        log.error('Failed to create new chat', { error: err });
      }
    });
  }, [serverUrl, safeNavigate]);

  // Listen for entity events via the event bus (slash commands, library buttons)
  useEntityEvents({
    onNew: useCallback((event: EntityNewEvent) => {
      safeNavigate(() => {
        const tab = ENTITY_TYPE_TO_TAB[event.entityType];
        navigateToEntity(tab, 'new', 'edit');
      });
    }, [navigateToEntity, safeNavigate]),
    onEdit: useCallback((event: EntityEditEvent) => {
      safeNavigate(() => {
        const tab = ENTITY_TYPE_TO_TAB[event.entityType];
        if (event.entityId) {
          navigateToEntity(tab, event.entityId, 'edit');
        }
      });
    }, [navigateToEntity, safeNavigate]),
    onView: useCallback((event: EntityViewEvent) => {
      safeNavigate(() => {
        const tab = ENTITY_TYPE_TO_TAB[event.entityType];
        if (event.entityId) {
          navigateToEntity(tab, event.entityId);
        }
      });
    }, [navigateToEntity, safeNavigate]),
    onClose: useCallback(() => {
      safeNavigate(() => {
        navigateToTab(activeTab);
      });
    }, [navigateToTab, activeTab, safeNavigate]),
    onSessionNew: handleNewChat,
  });

  // Persist current session and sync with layout context + URL
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, currentSessionId);
    }
    setLayoutSessionId(currentSessionId);
    setUrlSessionId(currentSessionId);
  }, [currentSessionId, setLayoutSessionId, setUrlSessionId]);

  // Auto-select most recent session if none saved
  useEffect(() => {
    if (currentSessionId) return;

    const fetchMostRecent = async () => {
      try {
        const res = await api.get(`${serverUrl}${API_PATHS.SESSIONS}?type=general&limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.sessions?.length > 0) {
            setCurrentSessionId(data.sessions[0].id);
          }
        }
      } catch (err) {
        log.error('Failed to fetch recent session', { error: err });
      }
    };

    fetchMostRecent();
  }, [serverUrl, currentSessionId]);

  const handleSessionSelect = useCallback((sessionId: string) => {
    safeNavigate(() => {
      setCurrentSessionId(sessionId);
    });
  }, [safeNavigate]);

  const handleSessionDelete = useCallback((sessionId: string) => {
    if (sessionId === currentSessionId) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  // Navigation handlers
  const handleTabChange = useCallback((tab: Tab) => {
    safeNavigate(() => {
      navigateToTab(tab);
    });
  }, [navigateToTab, safeNavigate]);

  const handleSpecSelect = useCallback((spec: Spec) => {
    safeNavigate(() => {
      navigateToEntity('specs', spec.id);
    });
  }, [navigateToEntity, safeNavigate]);

  const handlePromptSelect = useCallback((prompt: PromptSegment) => {
    safeNavigate(() => {
      navigateToEntity('prompts', prompt.id);
    });
  }, [navigateToEntity, safeNavigate]);

  const handleDocumentSelect = useCallback((document: Document) => {
    safeNavigate(() => {
      navigateToEntity('documents', document.id);
    });
  }, [navigateToEntity, safeNavigate]);

  const handleAgentSelect = useCallback((agent: AgentDefinition) => {
    safeNavigate(() => {
      navigateToEntity('agents', agent.id);
    });
  }, [navigateToEntity, safeNavigate]);

  // Navigate to an agent by slug (for subagent links)
  const handleNavigateToAgentBySlug = useCallback(async (slug: string) => {
    try {
      const res = await api.get(`${serverUrl}${API_PATHS.AGENT_DEFINITIONS}`);
      if (!res.ok) {
        log.warn(`Failed to fetch agents: ${res.statusText}`);
        return;
      }
      const data = await res.json();
      const agents: AgentDefinition[] = data.agentDefinitions || data.data || [];
      const agent = agents.find((a) => a.slug === slug);
      if (agent) {
        safeNavigate(() => {
          navigateToEntity('agents', agent.id);
        });
      } else {
        log.warn(`Agent with slug "${slug}" not found`);
      }
    } catch (err) {
      log.error('Failed to navigate to agent by slug:', err instanceof Error ? err : undefined);
    }
  }, [serverUrl, navigateToEntity, safeNavigate]);

  // Slash command handler
  const handleSlashCommand = useCallback((command: ParsedCommand) => {
    if (command.action === 'help') {
      setShowHelp(true);
      return;
    }

    if (command.action === 'spawn') {
      safeNavigate(() => {
        navigateToTab('new-task');
      });
      return;
    }

    if (!command.entityType) return;

    safeNavigate(() => {
      const tab = ENTITY_TYPE_TO_TAB[command.entityType!];
      if (command.action === 'new' || command.action === 'create') {
        navigateToEntity(tab, 'new', 'edit');
      } else if (command.action === 'edit' || command.action === 'open') {
        if (command.entityId) {
          navigateToEntity(tab, command.entityId, 'edit');
        }
      }
    });
  }, [navigateToEntity, navigateToTab, safeNavigate]);

  // Handle entity save — notify listeners (EntityView handles its own mode switch)
  const handleEntitySaved = useCallback((entityType: FormEntityType, entity: unknown) => {
    log.debug('Entity saved', { entity });
    const entityId = (entity as { id?: string })?.id;
    if (entityId) {
      notifyEntitySaved(entityType, entityId);
    }
  }, []);

  // Derive entity view props from navigation state
  const entityId = navState.entityId;
  const initialMode = navState.entityMode || 'view';
  const handleBack = useCallback(() => {
    safeNavigate(() => {
      window.history.back();
    });
  }, [safeNavigate]);

  // Skip link focus handler for accessibility navigation
  const handleSkipLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const targetId = e.currentTarget.getAttribute('href')?.slice(1);
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  // Render content pane based on active tab and entity state
  const renderContentPane = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onTaskSelect={(task) => {
              safeNavigate(() => {
                navigateToEntity('tasks', task.id);
              });
            }}
          />
        );

      case 'specs':
        return entityId ? (
          <Suspense fallback={<ViewFallback message="Loading spec..." />}>
            <SpecView
              specId={entityId === 'new' ? '' : entityId}
              serverUrl={serverUrl}
              sessionId={currentSessionId || undefined}
              initialMode={initialMode}
              onBack={handleBack}
              onSave={(entity) => handleEntitySaved('spec', entity)}
              onTaskSelect={(task) => {
                safeNavigate(() => {
                  navigateToEntity('tasks', task.id);
                });
              }}
              onSessionSelect={(session) => {
                safeNavigate(() => {
                  navigateToEntity('sessions', session.id);
                });
              }}
              onCreateTask={() => {
                safeNavigate(() => {
                  pendingSpecIdRef.current = entityId === 'new' ? null : entityId;
                  navigateToTab('new-task');
                });
              }}
            />
          </Suspense>
        ) : (
          <SpecsLibrary onSpecSelect={handleSpecSelect} />
        );

      case 'prompts':
        return entityId ? (
          <Suspense fallback={<ViewFallback message="Loading prompt..." />}>
            <PromptView
              promptId={entityId === 'new' ? '' : entityId}
              serverUrl={serverUrl}
              sessionId={currentSessionId || undefined}
              initialMode={initialMode}
              onBack={handleBack}
              onSave={(entity) => handleEntitySaved('prompt', entity)}
            />
          </Suspense>
        ) : (
          <PromptsLibrary onPromptSelect={handlePromptSelect} />
        );

      case 'documents':
        return entityId ? (
          <Suspense fallback={<ViewFallback message="Loading document..." />}>
            <DocumentView
              documentId={entityId === 'new' ? '' : entityId}
              serverUrl={serverUrl}
              sessionId={currentSessionId || undefined}
              initialMode={initialMode}
              onBack={handleBack}
              onSave={(entity) => handleEntitySaved('document', entity)}
            />
          </Suspense>
        ) : (
          <DocumentsLibrary onDocumentSelect={handleDocumentSelect} />
        );

      case 'agents':
        return entityId ? (
          <Suspense fallback={<ViewFallback message="Loading agent..." />}>
            <AgentDefinitionView
              entityId={entityId === 'new' ? '' : entityId}
              serverUrl={serverUrl}
              sessionId={currentSessionId || undefined}
              initialMode={initialMode}
              onBack={handleBack}
              onSave={(entity) => handleEntitySaved('agentDefinition', entity)}
              onNavigateToAgent={handleNavigateToAgentBySlug}
            />
          </Suspense>
        ) : (
          <AgentDefinitionsLibrary onAgentSelect={handleAgentSelect} />
        );

      case 'tasks':
        return entityId ? (
          <Suspense fallback={<ViewFallback message="Loading task..." />}>
            <TaskDetailView
              taskId={entityId}
              serverUrl={serverUrl}
              onBack={handleBack}
              onViewSession={(sessionId) => {
                safeNavigate(() => {
                  navigateToEntity('sessions', sessionId);
                });
              }}
              onOpenSessionInPane={(sessionId) => {
                handleSessionSelect(sessionId);
              }}
              onViewSpec={(specId) => {
                safeNavigate(() => {
                  navigateToEntity('specs', specId);
                });
              }}
            />
          </Suspense>
        ) : (
          <TasksLibrary
            onNewTask={() => navigateToTab('new-task')}
            onSelectTask={(task) => {
              safeNavigate(() => {
                navigateToEntity('tasks', task.id);
              });
            }}
          />
        );

      case 'sessions':
        return entityId ? (
          <Suspense fallback={<ViewFallback message="Loading session..." />}>
            <SessionDetailView
              sessionId={entityId}
              serverUrl={serverUrl}
              onBack={handleBack}
              onEntityNavigate={(entityType, id) => {
                // Map session entity types to tabs
                const tabMap: Record<string, Tab> = {
                  spec: 'specs',
                  document: 'documents',
                  prompt: 'prompts',
                  pipeline: 'dashboard',
                  agent_definition: 'agents',
                };
                const tab = tabMap[entityType];
                if (tab) {
                  safeNavigate(() => {
                    navigateToEntity(tab, id);
                  });
                }
              }}
            />
          </Suspense>
        ) : (
          <SessionsManager
            onSessionSelect={(session) => {
              safeNavigate(() => {
                navigateToEntity('sessions', session.id);
              });
            }}
          />
        );

      case 'workspaces':
        return <WorkspaceManager />;

      case 'new-task': {
        const specId = pendingSpecIdRef.current;
        pendingSpecIdRef.current = null;
        return (
          <SpawnTaskPanel
            initialSpecId={specId || undefined}
            onBack={() => navigateToTab('tasks')}
            onTaskCreated={(task) => {
              log.info('Task created, navigating to tasks', { taskId: task.id });
              navigateToTab('tasks');
            }}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={`app-container ${theme}`}>
      {/* Skip Links for Accessibility */}
      <a href="#main-content" className="skip-link" onClick={handleSkipLinkClick}>
        Skip to main content
      </a>
      <a href="#chat-input" className="skip-link" onClick={handleSkipLinkClick}>
        Skip to chat
      </a>
      <a href="#main-navigation" className="skip-link" onClick={handleSkipLinkClick}>
        Skip to navigation
      </a>

      {/* Compact Header */}
      <header className="app-header">
        <div className="app-header-brand">
          <img src="/capybara.png" alt="" className="app-logo" />
          <span className="app-title">Capybara</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* System Status Indicators */}
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/20 border border-border/40">
            <StatusIndicator status={serverConnected ? 'online' : 'offline'} label="NET" size="xs" />
            <div className="w-px h-3 bg-border/50" />
            <StatusIndicator status={agentStatus} label="CPU" size="xs" />
          </div>

          <div className="w-px h-4 bg-border/50 mx-1" />

          {/* Actions */}
          <DevMenu serverUrl={serverUrl} />

          {/* User identity (032-multitenancy) */}
          {user && (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.githubLogin}
                  className="w-5 h-5 border border-border/40"
                  style={{ borderRadius: 0 }}
                />
              ) : (
                <span className="text-xs text-muted-foreground font-mono">@{user.githubLogin}</span>
              )}
              <button
                onClick={logout}
                className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
                title="Sign out"
              >
                [out]
              </button>
            </div>
          )}

          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {theme === 'cozy' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main 2-Pane Layout (168-right-bar-elimination: sessions moved to chat dropdown) */}
      <AdaptiveLayout
        chatPane={
          <GeneralConversation
            sessionId={currentSessionId}
            onSlashCommand={handleSlashCommand}
            onViewSession={(sid) => {
              safeNavigate(() => {
                navigateToEntity('sessions', sid);
              });
            }}
            onNewChat={(agentDefinitionId, workspaceId) => handleNewChat(agentDefinitionId, workspaceId)}
            onNewTask={() => navigateToTab('new-task')}
            onSessionSelect={handleSessionSelect}
            onSessionDelete={handleSessionDelete}
          />
        }
        contentHeader={
          <nav id="main-navigation" tabIndex={-1} className="tab-nav">
            <span className="text-muted-foreground/40 select-none mr-2">{'>'}</span>
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`tab-nav-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="tab-content">
                    {isActive ? `[ ${tab.label.toUpperCase()} ]` : tab.label.toLowerCase()}
                  </span>
                </button>
              );
            })}
          </nav>
        }
        contentPane={
          <div id="main-content" tabIndex={-1} className="content-pane-body" role="main">{renderContentPane()}</div>
        }
      />

      {/* Help Modal */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

/**
 * AuthGate — renders login page or authenticated app.
 * Must be inside AuthProvider to access useAuth().
 *
 * 032-multitenancy: SocketProvider receives the JWT token so socket.io
 * can authenticate with the server's room-based routing.
 */
function AuthGate() {
  const { user, loading, token } = useAuth();

  // Show a minimal loading state while checking auth
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <span className="text-sm font-mono" style={{ color: 'var(--muted-foreground)' }}>
          authenticating...
        </span>
      </div>
    );
  }

  // Not authenticated → login page
  if (!user) {
    return <LoginPage />;
  }

  // Authenticated → full app with socket connected using JWT
  return (
    <SocketProvider authToken={token}>
      <NavigationGuardProvider>
        <AppContent />
      </NavigationGuardProvider>
    </SocketProvider>
  );
}

// Main App with ErrorBoundary, LayoutModeProvider, AuthProvider wrappers
export function App() {
  return (
    <ErrorBoundary>
      <LayoutModeProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </LayoutModeProvider>
    </ErrorBoundary>
  );
}
