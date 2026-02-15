/**
 * Hooks Index
 * Re-exports all custom hooks for convenient imports
 */

// Data fetching hooks
export { useFetch, useLazyFetch, type FetchState, type UseFetchOptions } from './useFetch';
export { useFetchList, type FetchListOptions, type FetchListResult } from './useFetchList';
export { useDelete, usePost, usePatch, type MutationResult, type UseDeleteOptions } from './useApiMutation';

// Session & Chat hooks
export { useSessionMessages, type UIChatMessage, type SessionEvent, type TimelineItem } from './useSessionMessages';
export { useSessionList, type UseSessionListOptions, type UseSessionListResult } from './useSessionList';
export { useSessionMemories, type SessionMemoriesState, type UseSessionMemoriesOptions } from './useSessionMemories';
export {
  useSessionCreatedEntities,
  type SessionCreatedEntity,
  type SessionEntityType,
  type SessionEntityCounts,
  type SessionCreatedEntitiesState,
  type UseSessionCreatedEntitiesOptions,
} from './useSessionCreatedEntities';
export {
  useSessionResponseEvents,
  useSessionLifecycleEvents,
  useSessionActivityEvents,
  type SessionResponseData,
  type MessageStatusData,
  type SessionErrorData,
  type SessionContextInjectedData,
  type SessionActivityData,
  type SessionHumanInputData,
} from './useSessionSocketEvents';
export { useSessionActivityState } from './useSessionActivityState';
export { useChatPreferences, type ChatPreferences } from './useChatPreferences';
export { useChatColors } from './useChatColors';

// Entity hooks
export { useEntityForm } from './useEntityForm';
export { useEntityEvents } from './useEntityEvents';
export { useEntitySearch, type EntitySearchResult, type SearchableEntity } from './useEntitySearch';

// Navigation & UI hooks
export { useNavigationState } from './useNavigationState';
export { useModal } from './useModal';
export { useTheme } from './useTheme';
export { useCollapsiblePane } from './useCollapsiblePane';

// Domain-specific hooks
export * from './useWorkspace';
export { useTasks } from './useTasks';
export { useTaskPR, type PRStatus, type UseTaskPROptions, type UseTaskPRResult, type CreatePRInput, type MergePRInput, type ClosePRInput } from './useTaskPR';
export { useTechniques } from './useTechniques';
export { useLogsQuery } from './useLogsQuery';

// Library hooks
export { useLibraryData, type UseLibraryDataResult } from './useLibraryData';
