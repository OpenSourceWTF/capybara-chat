/**
 * CopyableId - Reusable copyable entity ID element
 *
 * Displays a truncated ID with a click-to-copy button.
 * Shows Copy icon by default, briefly switches to Check icon on copy.
 * Follows the pattern established in TaskDetailView.
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CopyableIdProps {
  /** Full ID string to copy */
  id: string;
  /** Optional label prefix (e.g. "SESSION:", "CLAUDE:") */
  label?: string;
  /** Number of characters to show (default: 12) */
  truncateLength?: number;
  /** Whether to show trailing ellipsis after truncation (default: false) */
  showEllipsis?: boolean;
}

export function CopyableId({
  id,
  label,
  truncateLength = 12,
  showEllipsis = false,
}: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayId = id.length > truncateLength
    ? id.substring(0, truncateLength) + (showEllipsis ? '…' : '')
    : id;

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
      title={`Copy full ID: ${id}`}
    >
      {label && <span className="uppercase tracking-wider">{label}</span>}
      {displayId}
      {copied ? (
        <Check className="w-3 h-3 text-success" />
      ) : (
        <Copy className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}
