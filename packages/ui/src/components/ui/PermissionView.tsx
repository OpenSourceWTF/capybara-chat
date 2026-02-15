/**
 * PermissionView - Read-only computed permissions display
 *
 * Shows the effective permissions for an agent:
 * - Built-in tools from allowedTools
 * - MCP tool access auto-computed from mcpServers
 */

import { Shield, Wrench, Plug } from 'lucide-react';
import type { AgentMCPServerConfig } from '@capybara-chat/types';
import { Badge } from './Badge';
import { cn } from '../../lib/utils';

export interface PermissionViewProps {
  allowedTools: string[];
  mcpServers: AgentMCPServerConfig[];
  className?: string;
}

const ALL_BUILTIN_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task', 'WebFetch', 'WebSearch'];

export function PermissionView({ allowedTools, mcpServers, className }: PermissionViewProps) {
  const enabledServers = mcpServers.filter(s => s.enabled);
  const hasBuiltin = allowedTools.length > 0;
  const hasMcp = enabledServers.length > 0;

  if (!hasBuiltin && !hasMcp) {
    return (
      <div className={cn('space-y-2', className)}>
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
          <Shield className="w-3 h-3" />
          Effective Permissions
        </h4>
        <p className="text-xs text-muted-foreground/50 italic">No permissions configured (will use defaults)</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
        <Shield className="w-3 h-3" />
        Effective Permissions
      </h4>

      <div className="border border-border/30 bg-muted/10 p-3 space-y-3">
        {/* Built-in tools */}
        {hasBuiltin && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground/50">
              <Wrench className="w-2.5 h-2.5" />
              Built-in Tools
            </div>
            <div className="flex flex-wrap gap-1">
              {ALL_BUILTIN_TOOLS.map((tool) => {
                const isEnabled = allowedTools.includes(tool);
                return (
                  <Badge
                    key={tool}
                    variant={isEnabled ? 'soft' : 'outline'}
                    intent={isEnabled ? 'neutral' : 'neutral'}
                    size="sm"
                    className={cn(
                      'text-2xs font-mono',
                      !isEnabled && 'opacity-25 line-through',
                    )}
                  >
                    {tool}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* MCP Access */}
        {hasMcp && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground/50">
              <Plug className="w-2.5 h-2.5" />
              MCP Tool Access
            </div>
            <div className="flex flex-wrap gap-1">
              {enabledServers.map((srv) => (
                <Badge
                  key={srv.name}
                  variant="soft"
                  intent="info"
                  size="sm"
                  className="text-2xs font-mono"
                >
                  mcp__{srv.name}__*
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Always-included note */}
        <p className="text-2xs text-muted-foreground/40 pt-1 border-t border-border/20">
          MCP permissions are auto-computed from enabled servers. Form MCP is always included at runtime.
        </p>
      </div>
    </div>
  );
}
