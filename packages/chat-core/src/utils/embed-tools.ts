import {
  type TimelineItem,
  type UIChatMessage,
  type EmbeddedToolUse,
  type ToolUseItem,
  type SessionEvent,
  type ThinkingItem,
} from '../types';

/**
 * Embed tools in their parent messages based on messageId.
 */
export function embedToolsInMessages(rawTimeline: TimelineItem[]): TimelineItem[] {
  // Separate messages and tools
  const messages: UIChatMessage[] = [];
  const tools: any[] = [];
  const events: SessionEvent[] = [];
  const thinkingItems: ThinkingItem[] = [];

  for (const item of rawTimeline) {
    if ((item as any).itemType === 'message' || item.type === 'message') {
      // Handle legacy itemType for robustness if API returns it, or just mapped type
      messages.push({ ...item, type: 'message' } as UIChatMessage);
    } else if ((item as any).itemType === 'tool_use' || item.type === 'tool_use') {
      tools.push(item);
    } else if ((item as any).itemType === 'event' || item.type === 'event') {
      events.push({ ...item, type: 'event' } as SessionEvent);
    } else if ((item as any).itemType === 'thinking' || item.type === 'thinking') {
      thinkingItems.push({ ...item, type: 'thinking' } as ThinkingItem);
    }
  }

  // Build messageId -> tools map
  const messageToolsMap = new Map<string, ToolUseItem[]>();
  for (const tool of tools) {
    if (tool.messageId) {
      const existing = messageToolsMap.get(tool.messageId) || [];
      // Convert raw tool to ToolUseItem
      const toolItem: ToolUseItem = {
        id: tool.id,
        type: 'tool_use',
        name: tool.toolName || tool.name, // Handle variations
        input: tool.input,
        output: tool.output,
        error: tool.error,
        isError: !!tool.error,
        status: tool.status || (tool.error ? 'failed' : tool.output ? 'completed' : 'running'),
        timestamp: tool.timestamp || tool.createdAt || 0,
        createdAt: tool.createdAt || tool.timestamp || 0,
        elapsedMs: tool.elapsedMs,
      };
      existing.push(toolItem);
      messageToolsMap.set(tool.messageId, existing);
    }
  }

  // Embed tools in messages
  const processedMessages = messages.map(msg => {
    const associatedTools = messageToolsMap.get(msg.id) || [];
    // Merge with existing tools if any
    const existingTools = msg.toolUses || [];
    const mergedTools = [...existingTools];

    for (const tool of associatedTools) {
      if (!mergedTools.find(t => t.id === tool.id)) {
        mergedTools.push(tool);
      }
    }

    if (mergedTools.length > 0) {
      return { ...msg, toolUses: mergedTools };
    }
    return msg;
  });

  // Rebuild timeline
  const result: TimelineItem[] = [
    ...processedMessages,
    ...events,
    ...thinkingItems
  ];

  // Sort by createdAt
  result.sort((a, b) => a.createdAt - b.createdAt);

  return result;
}
