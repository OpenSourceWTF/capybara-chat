/**
 * HumanInputModal - Modal for agent requesting human input
 *
 * Displayed when the agent needs human intervention to continue.
 * Blocks other interactions until input is provided.
 */

import { useState } from 'react';
import { MessageCircleQuestion, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import type { SessionHumanInputData } from '../../hooks/useSessionSocketEvents';

export interface HumanInputModalProps {
  request: SessionHumanInputData | null;
  onSubmit: (response: string) => void;
  onCancel?: () => void;
}

export function HumanInputModal({
  request,
  onSubmit,
  onCancel,
}: HumanInputModalProps) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!request) {
    return null;
  }

  const handleSubmit = async () => {
    if (!response.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(response.trim());
      setResponse('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptionClick = (option: string) => {
    onSubmit(option);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="w-full max-w-md mx-4 bg-background border shadow-lg animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <MessageCircleQuestion className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Input Required</h2>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Question */}
          <div className="text-sm">
            <p className="font-medium">{request.question}</p>
            {request.context && (
              <p className="mt-2 text-muted-foreground text-xs font-mono bg-muted/50 p-2">
                {request.context}
              </p>
            )}
          </div>

          {/* Options (if provided) */}
          {request.options && request.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {request.options.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  size="sm"
                  onClick={() => handleOptionClick(option)}
                  disabled={submitting}
                >
                  {option}
                </Button>
              ))}
            </div>
          )}

          {/* Free-form input */}
          <div className="space-y-2">
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Type your response..."
              className="w-full min-h-[80px] px-3 py-2 text-sm border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Press ⌘+Enter to submit
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-muted/30">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!response.trim() || submitting}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? 'Sending...' : 'Send Response'}
          </Button>
        </div>
      </div>
    </div>
  );
}
