/**
 * EntityView - Generic View/Edit Component for All Entity Types
 *
 * Schema-driven component that combines viewing and editing into a single
 * interface with seamless mode switching. Works for any entity type.
 *
 * Features:
 * - View mode: Read-only display with entity-specific sections
 * - Edit mode: Editable fields with save/cancel
 * - Smooth CSS transitions between modes
 * - Consistent styling per STYLE_GUIDE.md
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EntityStatus, SessionMode, API_PATHS, SOCKET_EVENTS } from '@capybara-chat/types';
import type { FormEntityType } from '@capybara-chat/types';
import { useSocket } from '../../context/SocketContext';
import {
  Button,
  Badge,
  LoadingSpinner,
  EmptyState,
  TagList,
  ContentPreview,
  Switch,
  Input,
  Select,
  MarkdownTextarea,
  UnsavedChangesDialog,
  FormField,
  Markdown,
} from '../ui';
import { TagInput } from '../ui/TagInput';
import { SchemaField, getFieldSection } from '../ui/SchemaFieldRenderer';
import { ArrowLeft, Undo2, Redo2 } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { useEntityForm } from '../../hooks/useEntityForm';
import { useLayoutMode } from '../../context/LayoutModeContext';
import type { EditingContext } from '../../context/LayoutModeContext';
import { useNavigationGuard } from '../../context/NavigationGuardContext';
import { api } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { cn } from '../../lib/utils';
import { formatLibraryTimestamp, formatFullTimestamp } from '../../lib/date-formatting';
import { Check } from 'lucide-react';
import type { EntitySchemaDefinition, FieldDefinition } from '../../schemas/define-schema';

const log = createLogger('EntityView');

/**
 * Helper to check if a field definition has the 'hidden' class
 */
function isFieldHidden(fieldDef: FieldDefinition | undefined): boolean {
  const className = fieldDef?.props?.className;
  return typeof className === 'string' && className.includes('hidden');
}

/**
 * Safely cast an unknown field definition to FieldDefinition
 * Used when iterating over schema.fields with Object.entries
 */
function asFieldDefinition(fieldDefUnknown: unknown): FieldDefinition {
  return fieldDefUnknown as FieldDefinition;
}

/**
 * Get segmentId from an entity (some entity types have this optional field)
 */
function getSegmentId(entity: unknown): string | undefined {
  return (entity as { segmentId?: string })?.segmentId;
}

/**
 * Type for prompt segment API response
 */
interface PromptSegmentResponse {
  id: string;
  content: string;
}

/**
 * Base entity interface - entities must have at least these fields
 */
interface BaseEntity {
  id: string;
  status?: EntityStatus;
  createdAt?: number | string;
  updatedAt?: number | string;
  tags?: string[];
  /** 032-multitenancy: Server-computed ownership flag */
  isOwner?: boolean;
  /** 032-multitenancy: GitHub login of creator (for display) */
  createdBy?: string | null;
}

/**
 * Tab definition for EntityView tabs feature
 */
export interface EntityViewTab {
  /** Unique tab identifier */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Whether the tab is disabled */
  disabled?: boolean;
}

/**
 * Props for EntityView
 */
export interface EntityViewProps<TEntity extends BaseEntity, TForm extends object> {
  /** Entity schema definition */
  schema: EntitySchemaDefinition<TEntity, TForm>;
  /** Entity ID to view/edit */
  entityId: string;
  /** Server URL */
  serverUrl?: string;
  /** API path (e.g., '/api/prompts') */
  apiPath: string;
  /** Session ID for context injection and MCP Forms sync */
  sessionId?: string;
  /** Initial mode */
  initialMode?: 'view' | 'edit';
  /** Called when navigating back */
  onBack?: () => void;
  /** Label for back button */
  backLabel?: string;
  /** Called when saving completes */
  onSave?: (entity: TEntity) => void;
  /** Called when closing */
  onClose?: () => void;
  /** Field that contains the title/name */
  titleField?: keyof TForm;
  /** Field that contains the main content */
  contentField?: keyof TForm;
  /** Whether to hide the default content field renderer (e.g. if custom editor provided) */
  hideContentField?: boolean;
  /** Render content field as markdown in view mode instead of raw text */
  renderContentAsMarkdown?: boolean;
  /** Render content before the main content field (view mode only) */
  renderViewPreamble?: (entity: TEntity) => React.ReactNode;
  /** Render additional view-mode sections (after content) */
  renderViewSections?: (entity: TEntity) => React.ReactNode;
  /** Render inline metadata (for view mode) */
  renderMetadata?: (entity: TEntity) => React.ReactNode;
  /** Render inline edit fields (for edit mode, besides title/content) */
  renderEditFields?: (
    formData: TForm,
    setField: <K extends keyof TForm>(field: K, value: TForm[K]) => void,
    disabled: boolean,
    aiFilledFields?: Map<string, number>
  ) => React.ReactNode;
  /** Render full-width sections in edit mode (below fields) */
  renderEditSections?: (
    formData: TForm,
    setField: <K extends keyof TForm>(field: K, value: TForm[K]) => void,
    disabled: boolean
  ) => React.ReactNode;
  /** Additional actions for header */
  renderActions?: (entity: TEntity, mode: 'view' | 'edit') => React.ReactNode;
  /** Field order for edit mode */
  fieldOrder?: (keyof TForm)[];
  /** Layout configuration for edit mode */
  layout?: { rows?: (keyof TForm)[][] };
  /** Hide the Additional Fields section entirely */
  hideAdditionalFields?: boolean;
  /** Tab definitions for tabbed interface */
  tabs?: EntityViewTab[];
  /** Render custom tab panel content */
  renderTabContent?: (tabId: string, entity: TEntity | null) => React.ReactNode;
}

/**
 * Generic EntityView component
 */
export function EntityView<TEntity extends BaseEntity, TForm extends object>({
  schema,
  entityId,
  serverUrl = '',
  apiPath,
  sessionId,
  initialMode = 'view',
  onBack,
  backLabel: _backLabel = 'Back',
  onSave,
  onClose,
  titleField = 'title' as keyof TForm,
  contentField = 'content' as keyof TForm,
  hideContentField = false,
  renderContentAsMarkdown = false,
  renderViewPreamble,
  renderViewSections,
  renderMetadata,
  renderEditFields,
  renderEditSections,
  renderActions,
  fieldOrder: _fieldOrder,
  layout: _layout,
  hideAdditionalFields = false,
  tabs,
  renderTabContent,
}: EntityViewProps<TEntity, TForm>) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [isPublished, setIsPublished] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [publishAction, setPublishAction] = useState<string | null>(null); // 032-multitenancy
  const { setDirty, pendingNavigation, confirmNavigation, cancelNavigation } = useNavigationGuard();
  const isNewEntity = !entityId;

  // Tab state (only used when tabs prop is provided)
  const [activeTabId, setActiveTabId] = useState<string>(tabs?.[0]?.id ?? '');
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Update active tab when tabs prop changes (e.g., first render)
  useEffect(() => {
    if (tabs && tabs.length > 0 && !tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  // Get next/previous enabled tab index with wrapping
  const getNextEnabledTabIndex = useCallback((currentIndex: number, direction: 1 | -1): number => {
    if (!tabs || tabs.length === 0) return -1;
    const enabledTabs = tabs.filter(t => !t.disabled);
    if (enabledTabs.length === 0) return -1;

    const currentTabId = tabs[currentIndex]?.id;
    const currentEnabledIndex = enabledTabs.findIndex(t => t.id === currentTabId);

    if (currentEnabledIndex === -1) {
      // Current tab is disabled, find first enabled
      return tabs.findIndex(t => t.id === enabledTabs[0].id);
    }

    let nextEnabledIndex = currentEnabledIndex + direction;
    if (nextEnabledIndex < 0) nextEnabledIndex = enabledTabs.length - 1;
    if (nextEnabledIndex >= enabledTabs.length) nextEnabledIndex = 0;

    return tabs.findIndex(t => t.id === enabledTabs[nextEnabledIndex].id);
  }, [tabs]);

  // Handle tab keyboard navigation
  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) => {
    if (!tabs) return;

    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        nextIndex = getNextEnabledTabIndex(tabIndex, 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        nextIndex = getNextEnabledTabIndex(tabIndex, -1);
        break;
      case 'Home':
        event.preventDefault();
        // Find first enabled tab
        nextIndex = tabs.findIndex(t => !t.disabled);
        break;
      case 'End':
        event.preventDefault();
        // Find last enabled tab
        for (let i = tabs.length - 1; i >= 0; i--) {
          if (!tabs[i].disabled) {
            nextIndex = i;
            break;
          }
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!tabs[tabIndex].disabled) {
          setActiveTabId(tabs[tabIndex].id);
        }
        return;
      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < tabs.length) {
      const nextTab = tabs[nextIndex];
      setActiveTabId(nextTab.id);
      tabRefs.current.get(nextTab.id)?.focus();
    }
  }, [tabs, getNextEnabledTabIndex]);

  // Handle tab click
  const handleTabClick = useCallback((tab: EntityViewTab) => {
    if (!tab.disabled) {
      setActiveTabId(tab.id);
    }
  }, []);

  // Fetch entity data (skip for new entities)
  const { data: entity, loading, refetch } = useFetch<TEntity>(
    `${serverUrl}${apiPath}/${entityId}`,
    { skip: isNewEntity }
  );

  // Socket connection for real-time updates
  const { socket } = useSocket();

  // Map entity type to socket events for real-time refresh
  const entityUpdateEvents = useMemo(() => {
    switch (schema.entityType) {
      case 'document':
        return [SOCKET_EVENTS.DOCUMENT_UPDATED, SOCKET_EVENTS.DOCUMENT_DELETED];
      case 'prompt':
        return [SOCKET_EVENTS.PROMPT_UPDATED, SOCKET_EVENTS.PROMPT_DELETED];
      case 'agentDefinition':
        return [SOCKET_EVENTS.AGENT_DEFINITION_UPDATED, SOCKET_EVENTS.AGENT_DEFINITION_DELETED];
      default:
        return [];
    }
  }, [schema.entityType]);

  // Listen for entity updates from socket (e.g., when agent uses huddle-mcp tools)
  useEffect(() => {
    if (!socket || isNewEntity) return;

    const handleEntityUpdate = (data: unknown) => {
      // Check if this update is for our entity
      const payload = data as Record<string, unknown>;
      const updatedId =
        payload.documentId ||
        payload.segmentId ||
        payload.id ||
        (payload.document as { id?: string })?.id ||
        (payload.segment as { id?: string })?.id;

      if (updatedId === entityId) {
        log.debug('Entity updated via socket, refetching', { entityId, entityType: schema.entityType });
        refetch();
      }
    };

    entityUpdateEvents.forEach(event => {
      socket.on(event, handleEntityUpdate);
    });

    return () => {
      entityUpdateEvents.forEach(event => {
        socket.off(event, handleEntityUpdate);
      });
    };
  }, [socket, entityId, entityUpdateEvents, isNewEntity, refetch, schema.entityType]);

  // Save mutation (POST for new, PUT for existing)
  const saveEntity = useCallback(async (data: Partial<TEntity>): Promise<TEntity> => {
    const url = isNewEntity
      ? `${serverUrl}${apiPath}`
      : `${serverUrl}${apiPath}/${entityId}`;

    // Use unified API client to ensure headers (API key) are included
    const res = isNewEntity
      ? await api.post(url, data)
      : await api.put(url, data);

    if (!res.ok) throw new Error('Failed to save');
    const saved = await res.json();
    if (!isNewEntity) refetch();
    onSave?.(saved);
    return saved;
  }, [serverUrl, apiPath, entityId, isNewEntity, refetch, onSave]);

  // 032-multitenancy: Publish/Unpublish/Fork actions
  const handlePublish = useCallback(async () => {
    if (!entityId) return;
    setPublishAction('publishing');
    try {
      const res = await api.post(`${serverUrl}${apiPath}/${entityId}/publish`);
      if (!res.ok) throw new Error('Failed to publish');
      refetch();
    } catch (err) {
      log.error('Publish failed', { error: err });
    } finally {
      setPublishAction(null);
    }
  }, [serverUrl, apiPath, entityId, refetch]);

  const handleUnpublish = useCallback(async () => {
    if (!entityId) return;
    setPublishAction('unpublishing');
    try {
      const res = await api.post(`${serverUrl}${apiPath}/${entityId}/unpublish`);
      if (!res.ok) throw new Error('Failed to unpublish');
      refetch();
    } catch (err) {
      log.error('Unpublish failed', { error: err });
    } finally {
      setPublishAction(null);
    }
  }, [serverUrl, apiPath, entityId, refetch]);

  const handleFork = useCallback(async () => {
    if (!entityId) return;
    setPublishAction('forking');
    try {
      const res = await api.post(`${serverUrl}${apiPath}/${entityId}/fork`);
      if (!res.ok) throw new Error('Failed to fork');
      const forked = await res.json();
      onSave?.(forked);
    } catch (err) {
      log.error('Fork failed', { error: err });
    } finally {
      setPublishAction(null);
    }
  }, [serverUrl, apiPath, entityId, onSave]);

  // Form hook for edit mode (enables sync when sessionId is provided)
  const form = useEntityForm<TEntity, TForm>({
    schema,
    entityId,
    sessionId,
    initialData: entity,
    onSave: saveEntity,
  });

  // Navigation Guard: Register dirty state
  useEffect(() => {
    setDirty(form.hasChanges);
    // Cleanup dirty state on unmount to prevent blocking valid navigation from other views
    return () => setDirty(false);
  }, [form.hasChanges, setDirty]);

  // Navigation Guard: Handle browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.hasChanges]);

  // === Context injection: notify system when entering/leaving edit mode ===
  const { setEditingContext, currentSessionId } = useLayoutMode();
  const effectiveSessionId = sessionId || currentSessionId || undefined;

  // Set editing context when in edit mode (fires on mount if initialMode='edit', and on mode changes)
  // Only inject context for EXISTING entities (with IDs) - new entities shouldn't inject context until saved
  useEffect(() => {
    if (mode !== 'edit') return;
    if (!effectiveSessionId) return;
    if (!entityId) return; // Skip context injection for new/unsaved entities

    const editingCtx: EditingContext = {
      mode: SessionMode.ENTITY_EDITING,
      entityType: schema.entityType as FormEntityType,
      entityId: entityId,
      formContextInjected: false,
    };
    setEditingContext(editingCtx);

    api.patch(`${API_PATHS.SESSIONS}/${effectiveSessionId}`, {
      mode: SessionMode.ENTITY_EDITING,
      editingEntityType: schema.entityType,
      editingEntityId: entityId,
      formContextInjected: false,
    }).catch(() => { });

    // Cleanup when leaving edit mode or unmounting
    return () => {
      setEditingContext(null);
      api.patch(`${API_PATHS.SESSIONS}/${effectiveSessionId}`, {
        mode: SessionMode.CHAT,
        editingEntityType: null,
        editingEntityId: null,
      }).catch(() => { });
    };
  }, [mode, effectiveSessionId, entityId, schema.entityType, setEditingContext]);

  // Sync published state from entity
  useEffect(() => {
    if (entity) {
      setIsPublished(entity.status === EntityStatus.PUBLISHED);
    }
  }, [entity]);

  // 032-multitenancy: Force view mode for non-owned entities (URL safety guard)
  useEffect(() => {
    if (entity && entity.isOwner === false && mode === 'edit') {
      handleModeChange('view');
    }
  }, [entity?.isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load prompt content from Prompt Library (segmentId)
  // We use a ref to track the previous ID to avoid overwriting content on initial load of an existing entity
  const prevSegmentIdRef = useRef(getSegmentId(entity));

  useEffect(() => {
    const currentSegmentId = form.formData['segmentId' as keyof TForm] as string | undefined;

    // If we have a segment ID and it changed (different from prev/initial), fetch content
    if (mode === 'edit' && currentSegmentId && currentSegmentId !== prevSegmentIdRef.current) {
      api.get(`/segments/${currentSegmentId}`)
        .then(res => res.json() as Promise<PromptSegmentResponse>)
        .then((segment) => {
          if (segment && segment.content) {
            form.setField('content' as keyof TForm, segment.content as TForm[keyof TForm]);
          }
        })
        .catch(err => log.error("Failed to load prompt segment", { error: err }));

      // Update ref to current
      prevSegmentIdRef.current = currentSegmentId;
    }
  }, [mode, form.formData['segmentId' as keyof TForm]]);

  // Reset form when entering edit mode
  useEffect(() => {
    if (mode === 'edit' && entity) {
      form.reset();
      // Reset ref when form resets (e.g. cancelling edits)
      prevSegmentIdRef.current = getSegmentId(entity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, entity?.id]);

  // Unsaved changes confirmation
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'back' | 'reset' | null>(null);

  // Navigation Guard: Handle in-app navigation attempts
  useEffect(() => {
    if (pendingNavigation && form.hasChanges) {
      setPendingAction('back'); // Or 'reset', treated similarly by dialog
      setShowUnsavedDialog(true);
    } else if (pendingNavigation && !form.hasChanges) {
      // Logic safety: if pending nav but no changes, just go (e.g. after save)
      confirmNavigation();
    }
  }, [pendingNavigation, form.hasChanges, confirmNavigation]);

  const performNavigation = (action: 'back' | 'reset') => {
    if (action === 'back') {
      confirmNavigation(); // Proceed with pending navigation
      onBack?.();          // Or fallback to onBack if no pending nav
    } else {
      form.reset();
      if (isNewEntity) {
        (onClose ?? onBack)?.();
      } else {
        handleModeChange('view');
        onClose?.();
      }
    }
  };

  const handleSave = async () => {
    await form.saveWithStatus(isPublished ? EntityStatus.PUBLISHED : EntityStatus.DRAFT);

    // Show success feedback
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);

    // Provide immediate visual feedback but DO NOT close or switch mode
    // Unless it's a new entity, where we might want to redirect to the filtered view or stay
    // User requested "Save should not close the editor", so we stay in edit mode.
  };

  const handleBackClick = () => {
    if (isEditMode && form.hasChanges) {
      setPendingAction('back');
      setShowUnsavedDialog(true);
    } else {
      onBack?.();
    }
  };

  const handleCancelClick = () => {
    if (form.hasChanges) {
      setPendingAction('reset');
      setShowUnsavedDialog(true);
    } else {
      performNavigation('reset');
    }
  };

  const handleDiscard = () => {
    // Reset the form FIRST - this clears form.hasChanges which the useEffect syncs to isDirty
    form.reset();
    // Also explicitly clear dirty state to ensure NavigationGuard doesn't block
    setDirty(false);

    if (pendingAction === 'back' && pendingNavigation) {
      confirmNavigation();
    } else if (pendingAction) {
      performNavigation(pendingAction);
    }
    setShowUnsavedDialog(false);
    setPendingAction(null);
  };

  const handleDialogSave = async () => {
    try {
      await form.saveWithStatus(isPublished ? EntityStatus.PUBLISHED : EntityStatus.DRAFT);
      setShowUnsavedDialog(false);

      // If we have a blocked navigation waiting, execute it!
      if (pendingNavigation) {
        confirmNavigation();
        setPendingAction(null);
        return;
      }

      if (pendingAction === 'back') {
        onBack?.();
      } else {
        if (isNewEntity) {
          (onClose ?? onBack)?.();
        } else {
          // Stay in edit mode unless explicitly resetting?
          // Dialog usually implies "Save and Go", so we should probably navigate
          // Local save (not blocking navigation) - stay in edit mode
        }
      }
      setPendingAction(null);
    } catch (err) {
      log.error('Failed to save from dialog', { error: err });
    }
  };

  // Smooth mode transitions (replaceState keeps URL in sync without pushing history)
  const handleModeChange = (newMode: 'view' | 'edit') => {
    if (newMode === mode) return;

    // Update URL without pushing history — mode changes are not "navigation"
    const currentPath = window.location.pathname;
    const newPath = newMode === 'edit'
      ? currentPath.replace(/\/edit$/, '') + '/edit'
      : currentPath.replace(/\/edit$/, '');
    if (newPath !== currentPath) {
      const search = window.location.search;
      window.history.replaceState(null, '', newPath + search);
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 100);
  };

  const handleEditClick = () => {
    handleModeChange('edit');
  };

  // Get display values
  const getTitle = (): string => {
    if (mode === 'view' && entity) {
      return String((entity as unknown as Record<string, unknown>)[titleField as string] || 'Untitled');
    }
    return String(form.formData[titleField] || '');
  };

  const getContent = (): string => {
    if (mode === 'view' && entity) {
      return String((entity as unknown as Record<string, unknown>)[contentField as string] || '');
    }
    return String(form.formData[contentField] || '');
  };

  // Loading state (only for existing entities)
  if (loading && !isNewEntity) {
    return <LoadingSpinner message="Loading..." />;
  }

  // Not found (only for existing entities that failed to load)
  if (!entity && !isNewEntity) {
    return (
      <EmptyState
        message="Not found"
        action={
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
        }
      />
    );
  }

  const isEditMode = mode === 'edit';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header Bar - Consistent pattern with TYPE_LABEL */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-muted/10 min-h-[50px]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            className="h-7 px-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {schema.entityType.replace(/([A-Z])/g, '_$1').toUpperCase()}_DETAIL
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isEditMode && entity ? (
            <>
              {renderActions?.(entity, mode)}

              {/* 032-multitenancy: Publishing actions */}
              {entity.isOwner !== false && entity.status === EntityStatus.DRAFT && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePublish}
                  disabled={!!publishAction}
                  className="font-mono text-xs text-success border-success/40 hover:bg-success/10"
                >
                  {publishAction === 'publishing' ? '...' : 'Publish'}
                </Button>
              )}
              {entity.isOwner !== false && entity.status === EntityStatus.PUBLISHED && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnpublish}
                  disabled={!!publishAction}
                  className="font-mono text-xs border-border/60 hover:border-warning/60"
                >
                  {publishAction === 'unpublishing' ? '...' : 'Unpublish'}
                </Button>
              )}
              {entity.isOwner === false && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFork}
                  disabled={!!publishAction}
                  className="font-mono text-xs border-border/60 hover:border-primary/60 hover:bg-primary/5"
                >
                  {publishAction === 'forking' ? '...' : 'Fork'}
                </Button>
              )}

              {/* Edit button: only for owners */}
              {entity.isOwner !== false && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  className="gap-1.5 border-dashed border-border/60 hover:border-primary/60 hover:bg-primary/5 hover:text-primary font-mono text-xs"
                >
                  Edit
                </Button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-muted/40 p-0.5 border border-border/30 h-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={form.undo}
                  disabled={!form.canUndo}
                  title="Undo"
                  className="h-7 w-7 text-muted-foreground"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={form.redo}
                  disabled={!form.canRedo}
                  title="Redo"
                  className="h-7 w-7 text-muted-foreground"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancelClick} disabled={form.isSaving} className="text-muted-foreground font-mono text-xs hover:text-foreground">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={form.isSaving || !form.hasChanges}
                className={cn(
                  "gap-1.5 font-mono text-xs font-bold transition-all duration-300",
                  saveSuccess
                    ? "bg-success hover:bg-success text-white ring-2 ring-success/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {form.isSaving ? 'Saving...' : saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Saved
                  </>
                ) : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ARIA Tabs (when tabs prop is provided) */}
      {tabs && tabs.length > 0 && (
        <div
          role="tablist"
          aria-label="Entity mode"
          className="flex border-b border-border bg-muted/10 px-4"
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isDisabled = tab.disabled ?? false;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set(tab.id, el);
                  } else {
                    tabRefs.current.delete(tab.id);
                  }
                }}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls="entity-content-panel"
                aria-disabled={isDisabled ? 'true' : undefined}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabClick(tab)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={cn(
                  "px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  isActive
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 overflow-y-auto"
        {...(tabs && tabs.length > 0 ? {
          role: 'tabpanel',
          id: 'entity-content-panel',
          'aria-labelledby': `tab-${activeTabId}`,
        } : {})}
      >
        {/* Custom tab content when renderTabContent is provided */}
        {tabs && tabs.length > 0 && renderTabContent ? (
          <div className={cn(
            "px-6 py-6 transition-opacity duration-150",
            isTransitioning && "opacity-40"
          )}>
            {renderTabContent(activeTabId, entity)}
          </div>
        ) : (
        <div
          className={cn(
            "px-6 py-6 space-y-5 transition-opacity duration-150",
            isTransitioning && "opacity-40"
          )}
        >
          {/* Title & Meta */}
          <div className="space-y-4">
            {/* Row 1: Agent Type (Selects) + Slug (Title) + Metadata (Right) */}
            <div className="flex items-start gap-2">
              {/* Selects (Edit Mode) */}
              {isEditMode && (
                <div className="flex items-center gap-2 flex-shrink-0 empty:hidden">
                  {renderEditFields ? renderEditFields(form.formData, form.setField, form.isSaving) : Object.entries(schema.fields).map(([fieldName, fieldDefUnknown]) => {
                    const fieldDef = asFieldDefinition(fieldDefUnknown);
                    const section = getFieldSection(fieldName, fieldDef.type);
                    if (section !== 'header' || fieldName === String(titleField) || fieldName === 'tags') return null;
                    if (fieldDef.type !== 'select') return null;
                    return (
                      <FormField
                        key={fieldName}
                        label={fieldDef.label}
                        required={fieldDef.required}
                      >
                        <Select
                          variant="terminal"
                          value={String(form.formData[fieldName as keyof TForm] || '')}
                          onChange={(e) => form.setField(fieldName as keyof TForm, e.target.value as TForm[keyof TForm])}
                          disabled={form.isSaving}
                          className="w-[200px]"
                        >
                          {fieldDef.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </FormField>
                    );
                  })}
                </div>
              )}

              {/* Title / Slug */}
              <div className="flex-1 min-w-[200px]">
                {!isEditMode ? (
                  <h1 className="text-2xl font-bold tracking-tight leading-tight">{getTitle()}</h1>
                ) : (
                  <FormField
                    label={String(schema.fields[titleField]?.label || String(titleField))}
                    className="w-full"
                  >
                    <Input
                      variant="terminal"
                      value={String(form.formData[titleField] || '')}
                      onChange={(e) => form.setField(titleField, e.target.value as TForm[keyof TForm])}
                      className={cn(
                        "font-bold",
                        form.aiFilledFields.has(String(titleField)) && 'field-ai-filled'
                      )}
                      placeholder={isNewEntity ? `New ${schema.entityType}...` : 'Title'}
                    />
                  </FormField>
                )}
              </div>

              {/* Read-only Metadata (Date/Status) - Top Right */}
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground pt-1 ml-auto flex-shrink-0 empty:hidden">
                {entity && (
                  <span
                    className="font-mono opacity-70"
                    title={formatFullTimestamp(Number(entity.updatedAt || entity.createdAt || 0))}
                  >
                    {formatLibraryTimestamp(Number(entity.updatedAt || entity.createdAt || 0))}
                  </span>
                )}
                {!isEditMode && entity?.status === EntityStatus.DRAFT && (
                  <Badge variant="soft" intent="neutral" size="sm">Draft</Badge>
                )}
                {!isEditMode && entity?.isOwner === false && entity.createdBy && (
                  <span className="font-mono text-2xs text-muted-foreground/60">@{entity.createdBy}</span>
                )}
                {!isEditMode && entity && renderMetadata?.(entity)}
              </div>
            </div>

            {/* Row 2: Tags - skip if schema marks as hidden */}
            {isEditMode && 'tags' in form.formData && !isFieldHidden(schema.fields['tags' as keyof TForm] as FieldDefinition | undefined) && (
              <FormField label="Tags">
                <TagInput
                  variant="terminal"
                  value={String(form.formData['tags' as keyof TForm] || '')}
                  onChange={(val) => form.setField('tags' as keyof TForm, val as TForm[keyof TForm])}
                  placeholder="Add tags..."
                  isAiFilled={form.aiFilledFields.has('tags')}
                  className="w-full"
                />
              </FormField>
            )}
            {!isEditMode && entity?.tags && (
              <TagList tags={entity.tags} />
            )}

            {/* Row 3: Description - skip if schema marks as hidden */}
            {isEditMode && 'description' in schema.fields && !isFieldHidden(schema.fields['description' as keyof TForm] as FieldDefinition | undefined) && (
              <SchemaField
                fieldKey="description"
                definition={asFieldDefinition(schema.fields['description' as keyof TForm])}
                value={form.formData['description' as keyof TForm]}
                onChange={(val) => form.setField('description' as keyof TForm, val as TForm[keyof TForm])}
                aiFilled={form.aiFilledFields.has('description')}
                className="w-full"
              />
            )}
          </div>

          {/* View-mode Preamble (before content) */}
          {!isEditMode && entity && renderViewPreamble?.(entity)}

          {/* Content */}
          {!hideContentField && (
            <ContentPreview
              filename={`${schema.entityType.toUpperCase()}.md`}
              showHeader={true}
              commandPrefix={isEditMode ? 'markdown' : 'cat'}
            >
              {!isEditMode ? (
                renderContentAsMarkdown ? (
                  getContent() ? (
                    <Markdown className="prose prose-sm max-w-none text-foreground/85">{getContent()}</Markdown>
                  ) : (
                    <span className="italic text-muted-foreground/50">No content</span>
                  )
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-base leading-relaxed text-foreground/85">
                    {getContent() || <span className="italic text-muted-foreground/50">No content</span>}
                  </pre>
                )
              ) : (
                <MarkdownTextarea
                  value={String(form.formData[contentField] || '')}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    form.setField(contentField, e.target.value as TForm[keyof TForm])
                  }
                  aiFilled={form.aiFilledFields.has(String(contentField))}
                  placeholder="Write content here..."
                  className="min-h-[300px] w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                />
              )}
            </ContentPreview>
          )}

          {/* Edit-mode: Additional Schema Fields */}
          {(() => {
            if (!isEditMode) return null;

            const additionalFields = Object.entries(schema.fields).filter(([fieldName, fieldDefUnknown]) => {
              const fieldDef = fieldDefUnknown as FieldDefinition;
              const section = getFieldSection(fieldName, fieldDef.type);

              if (
                section === 'hidden' ||
                section === 'main' ||
                section === 'header' ||
                fieldName === String(titleField) ||
                fieldName === String(contentField) ||
                fieldName === 'tags' ||
                fieldName === 'description'
              ) {
                return false;
              }
              return true;
            });

            if (additionalFields.length === 0 || hideAdditionalFields) return null;

            return (
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  # Additional Fields
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {additionalFields.map(([fieldName, fieldDefUnknown]) => {
                    const fieldDef = fieldDefUnknown as FieldDefinition;
                    const isFullWidth = fieldDef.type === 'multiselect' || fieldDef.type === 'textarea' || fieldDef.type === 'markdown';
                    return (
                      <div key={fieldName} className={isFullWidth ? "md:col-span-2" : ""}>
                        <SchemaField
                          fieldKey={fieldName}
                          definition={fieldDef}
                          value={form.formData[fieldName as keyof TForm]}
                          onChange={(val) => form.setField(fieldName as keyof TForm, val as TForm[keyof TForm])}
                          disabled={form.isSaving}
                          aiFilled={form.aiFilledFields.has(fieldName)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Edit-mode: Custom Full-Width Sections */}
          {isEditMode && renderEditSections && (
            <div className="pt-4">
              {renderEditSections(form.formData, form.setField, form.isSaving)}
            </div>
          )}

          {/* View-mode sections */}
          {!isEditMode && entity && renderViewSections?.(entity)}
        </div>
        )}
      </div>

      {/* Edit Footer - Status toggle (only for entity owners) */}
      {isEditMode && entity?.isOwner !== false && (
        <footer className="flex justify-center items-center px-6 py-3 border-t-2 border-border/50 bg-muted/20 flex-shrink-0 font-mono text-xs uppercase tracking-wide">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'transition-colors select-none cursor-pointer hover:underline underline-offset-4',
                !isPublished ? 'font-bold text-foreground' : 'text-muted-foreground/50'
              )}
              onClick={() => !form.isSaving && setIsPublished(false)}
            >
              [ DRAFT ]
            </span>
            <Switch
              checked={isPublished}
              onCheckedChange={setIsPublished}
              disabled={form.isSaving}
              className="data-[state=checked]:bg-success scale-90"
            />
            <span
              className={cn(
                'transition-colors select-none cursor-pointer hover:underline underline-offset-4',
                isPublished ? 'font-bold text-success' : 'text-muted-foreground/50'
              )}
              onClick={() => !form.isSaving && setIsPublished(true)}
            >
              [ PUBLISHED ]
            </span>
          </div>
        </footer>
      )}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        entityType={schema.entityType}
        onSave={handleDialogSave}
        onDiscard={handleDiscard}
        onCancel={() => {
          setShowUnsavedDialog(false);
          setPendingAction(null);
          cancelNavigation(); // Clear pending navigation
        }}
        isSaving={form.isSaving}
      />
    </div>
  );
}
