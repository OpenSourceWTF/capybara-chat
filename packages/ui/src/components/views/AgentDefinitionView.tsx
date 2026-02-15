/**
 * AgentDefinitionView - Agent definition wrapper for EntityView
 *
 * "Control Room" Layout with Cozy Terminal styling:
 * - Zero border radius everywhere
 * - Monospace fonts
 * - Bracketed tags [TAG] instead of pills
 * - Border-bottom inputs
 * - Terminal-style [x] toggles for tools
 */

import type { AgentDefinition } from '@capybara-chat/types';
import { SERVER_DEFAULTS, API_PATHS, resolveModelLabel } from '@capybara-chat/types';
import { EntityView } from '../entity/EntityView';
import { agentDefinitionSchema, type AgentDefinitionFormData } from '../../schemas/agent-definition-schema';
import {
  Badge,
  PromptPicker,
  MCPServerEditor,
  SubagentEditor,
  MarkdownTextarea,
  Input,
  Textarea,
  TagInput,
  FormField,
  Markdown,
  TagList,
  ContentPreview,
  ASCIIFaceAvatar,
  CopyableId,
} from '../ui';

interface AgentDefinitionViewProps {
  entityId: string;
  serverUrl?: string;
  sessionId?: string;
  initialMode?: 'view' | 'edit';
  onBack?: () => void;
  onSave?: (entity: AgentDefinition) => void;
  onClose?: () => void;
  /** Navigate to another agent by slug (for subagent links) */
  onNavigateToAgent?: (agentSlug: string) => void;
}

// Available tools for the toggle list
const TOOL_OPTIONS = [
  { id: 'Read', label: 'Read', description: 'Read files' },
  { id: 'Write', label: 'Write', description: 'Create files' },
  { id: 'Edit', label: 'Edit', description: 'Modify files' },
  { id: 'Bash', label: 'Bash', description: 'Shell commands' },
  { id: 'Grep', label: 'Grep', description: 'Search contents' },
  { id: 'Glob', label: 'Glob', description: 'Find files' },
  { id: 'WebFetch', label: 'WebFetch', description: 'Fetch web' },
  { id: 'WebSearch', label: 'WebSearch', description: 'Search web' },
  { id: 'Task', label: 'Task', description: 'Background tasks' },
];


/**
 * Terminal-style tool toggle: [x] TOOL or [ ] TOOL
 */
function ToolToggle({
  label,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`
        font-mono text-xs transition-colors whitespace-nowrap
        ${enabled
          ? 'text-primary hover:text-primary/80'
          : 'text-muted-foreground/50 hover:text-muted-foreground'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={`${enabled ? 'Disable' : 'Enable'} ${label}`}
    >
      <span className="opacity-60">[</span>
      <span className={enabled ? 'text-primary' : 'opacity-40'}>{enabled ? 'x' : ' '}</span>
      <span className="opacity-60">]</span>
      <span className="ml-1">{label}</span>
    </button>
  );
}

/**
 * Section header with terminal styling
 */
function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1 mb-3">
      <span className="text-2xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
        {children}
      </span>
      {right}
    </div>
  );
}



export function AgentDefinitionView({
  entityId,
  serverUrl = SERVER_DEFAULTS.SERVER_URL,
  sessionId,
  initialMode = 'view',
  onBack,
  onSave,
  onClose,
  onNavigateToAgent,
}: AgentDefinitionViewProps) {
  return (
    <EntityView<AgentDefinition, AgentDefinitionFormData>
      schema={agentDefinitionSchema}
      entityId={entityId}
      serverUrl={serverUrl}
      sessionId={sessionId}
      apiPath={API_PATHS.AGENT_DEFINITIONS}
      initialMode={initialMode}
      onBack={onBack}
      backLabel="Back to Agents"
      onSave={onSave}
      onClose={onClose}
      titleField="name"
      contentField="systemPrompt"
      hideContentField={true}
      hideAdditionalFields={true}
      renderMetadata={(agent) => (
        <>
          <ASCIIFaceAvatar id={agent.id} />
          <CopyableId id={agent.id} />
          <span className="opacity-30">•</span>
          {(agent.author || agent.createdBy) && (
            <>
              <span className="text-muted-foreground">
                {agent.author ? `By ${agent.author.name}` : `@${agent.createdBy}`}
              </span>
              <span className="opacity-30">•</span>
            </>
          )}
          <span className="font-mono text-sm text-muted-foreground">[{resolveModelLabel(agent.agentContext?.model)}]</span>
          {agent.isSystem && (
            <>
              <span className="opacity-30">•</span>
              <span className="font-mono text-sm text-blue-600">[SYSTEM]</span>
            </>
          )}
        </>
      )}
      renderEditSections={(formData, setField, disabled) => (
        <div className="space-y-6 font-mono">

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 1: IDENTITY
          ═══════════════════════════════════════════════════════════════ */}
          <section className="border border-border p-4 bg-card">
            <SectionHeader>IDENTITY</SectionHeader>

            <div className="space-y-3">
              {/* Description */}
              <FormField label="Description">
                <Textarea
                  variant="terminal"
                  value={formData.description || ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="describe agent purpose..."
                  disabled={disabled}
                  rows={2}
                />
              </FormField>

              {/* Slug + Skills + Tags - inline */}
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Slug" required>
                  <Input
                    variant="terminal"
                    value={formData.slug || ''}
                    onChange={(e) => setField('slug', e.target.value)}
                    placeholder="my-agent"
                    disabled={disabled}
                  />
                </FormField>

                <FormField label="Skills">
                  <TagInput
                    variant="terminal"
                    value={formData.skills || ''}
                    onChange={(val) => setField('skills', val)}
                    placeholder="python, analysis..."
                    disabled={disabled}
                  />
                </FormField>

                <FormField label="Tags">
                  <TagInput
                    variant="terminal"
                    value={formData.tags || ''}
                    onChange={(val) => setField('tags', val)}
                    placeholder="internal, v2..."
                    disabled={disabled}
                  />
                </FormField>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 2: SYSTEM PROMPT
              Preview-only when linked, editable when not linked
          ═══════════════════════════════════════════════════════════════ */}
          <section className="border border-border p-4 bg-card">
            {/* Header row: just SYSTEM_PROMPT label */}
            <SectionHeader>SYSTEM_PROMPT</SectionHeader>

            {/* Library picker - full width, terminal styled */}
            <div className="mb-3">
              <PromptPicker
                segmentId={formData.systemPromptSegmentId}
                onChange={(id) => setField('systemPromptSegmentId', id)}
                onLoadContent={(content) => setField('systemPrompt', content)}
                serverUrl={serverUrl}
                disabled={disabled}
              />
            </div>

            {/* Content display - depends on link state */}
            {formData.systemPromptSegmentId ? (
              /* LINKED: Show preview-only (rendered markdown) */
              <div className="w-full min-h-[180px] px-3 py-2 border border-border bg-muted/20 text-sm leading-relaxed overflow-auto">
                {formData.systemPrompt ? (
                  <Markdown className="prose prose-sm max-w-none text-foreground">{formData.systemPrompt}</Markdown>
                ) : (
                  <span className="text-muted-foreground/50 italic">[No content loaded]</span>
                )}
              </div>
            ) : (
              /* NOT LINKED: Show editable MarkdownTextarea with toggle */
              <MarkdownTextarea
                value={formData.systemPrompt || ''}
                onChange={(e) => setField('systemPrompt', e.target.value)}
                placeholder="You are a specialized agent designed to..."
                className="w-full min-h-[180px] font-mono text-sm leading-relaxed"
                disabled={disabled}
              />
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 3: PERMISSIONS (Tools + MCP Auto-Grants)
              Single column, terminal-style [x] toggles
          ═══════════════════════════════════════════════════════════════ */}
          <section className="border border-border p-4 bg-card">
            <SectionHeader>
              PERMISSIONS [{formData.allowedTools?.length || 0}/{TOOL_OPTIONS.length}]
            </SectionHeader>

            {/* Tools as horizontal flow of [x] toggles */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {TOOL_OPTIONS.map((tool) => {
                const isEnabled = formData.allowedTools?.includes(tool.id) ?? false;
                return (
                  <ToolToggle
                    key={tool.id}
                    label={tool.label}
                    enabled={isEnabled}
                    onChange={(checked) => {
                      const current = formData.allowedTools || [];
                      if (checked) {
                        setField('allowedTools', [...current, tool.id]);
                      } else {
                        setField('allowedTools', current.filter((t) => t !== tool.id));
                      }
                    }}
                    disabled={disabled}
                  />
                );
              })}
            </div>

            {/* MCP Auto-Permissions - wildcard grants per MCP server */}
            {(formData.mcpServers?.length ?? 0) > 0 && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <span className="text-2xs font-mono text-muted-foreground uppercase tracking-wide">
                  MCP_GRANTED
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {formData.mcpServers?.map(mcp => (
                    <span
                      key={mcp.name}
                      className="text-xs font-mono text-primary"
                      title={`Grants all tools from ${mcp.name} server`}
                    >
                      [mcp__{mcp.name}__*]
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 4: SUB-AGENTS (Full width, single column)
          ═══════════════════════════════════════════════════════════════ */}
          <section className="border border-border p-4 bg-card">
            <SectionHeader>
              SUB_AGENTS [{formData.subagents?.length || 0}]
            </SectionHeader>

            <SubagentEditor
              value={formData.subagents}
              onChange={(links) => setField('subagents', links)}
              currentAgentId={entityId}
              serverUrl={serverUrl}
              disabled={disabled}
            />
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 5: MCP INTEGRATIONS (Full width)
          ═══════════════════════════════════════════════════════════════ */}
          <section className="border border-border p-4 bg-card">
            <SectionHeader>
              MCP_INTEGRATIONS [{formData.mcpServers?.length || 0}]
            </SectionHeader>

            <MCPServerEditor
              value={formData.mcpServers}
              onChange={(servers) => setField('mcpServers', servers)}
              disabled={disabled}
            />
          </section>
        </div>
      )}
      renderViewSections={(agent: AgentDefinition) => (
        <div className="space-y-4 pt-4 font-mono">
          {/* Placeholder for Agent Definition View sections - temporarily removed to fix build */}
          <div className="text-xs text-muted-foreground">Detailed view temporarily disabled</div>
        </div>
      )}
    />
  );
}
