/**
 * Chat Components
 *
 * Components for AI assistant chat integration.
 */

export { CommandAutocomplete, type CommandAutocompleteProps } from './CommandAutocomplete';

// Activity display components
export { ChatStatusHeader, type ChatStatusHeaderProps, type EditingContextInfo } from './ChatStatusHeader';
export { ActivityStatusBar, type ActivityStatusBarProps } from './ActivityStatusBar';
export { SessionActivityBar, type SessionActivityBarProps } from './SessionActivityBar';
export { StatusBanner, type StatusBannerProps, type BannerVariant } from './StatusBanner';
export { HumanInputModal, type HumanInputModalProps } from './HumanInputModal';
export { SessionFooter, type SessionFooterProps } from './SessionFooter';

// Main chat components (moved from components root)
export { GeneralConversation } from './GeneralConversation';
export { MessageInputBar } from './MessageInputBar';
export { MessageList } from './MessageList';
export { ChatSearchBar, highlightText, type SearchMatch } from './ChatSearchBar';
