/**
 * Markdown - Renders markdown content with appropriate styling
 *
 * Single newlines are converted to paragraph breaks (double newlines)
 * to match user expectations from chat interfaces.
 *
 * Pure functions extracted to lib/markdown-utils.ts for unit testing.
 */

import ReactMarkdown from 'react-markdown';
import { HTMLAttributes, useMemo } from 'react';
import { DocumentLinkButton } from './DocumentLinkButton';
import { normalizeNewlines } from '../../lib/markdown-utils';

export interface MarkdownProps extends HTMLAttributes<HTMLDivElement> {
  children: string;
}

export function Markdown({ children, className = '', ...props }: MarkdownProps) {
  // Memoize the normalized content to avoid re-processing on every render
  const normalizedContent = useMemo(() => normalizeNewlines(children || ''), [children]);

  return (
    <div className={`max-w-none ${className}`} {...props}>
      <ReactMarkdown
        components={{
          // Headings - using typography scale (per STYLE_GUIDE.md)
          // text-xl = 19px (h1), text-lg = 16px (h2), text-md = 14px (h3)
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-md font-bold mt-2 mb-1 first:mt-0">{children}</h3>
          ),
          // Paragraphs - tighter spacing for terminal aesthetic
          p: ({ children }) => (
            <p className="mb-1.5 last:mb-0 leading-snug">{children}</p>
          ),
          // Code blocks - terminal aesthetic (no rounded corners)
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-muted p-3 text-sm font-mono overflow-x-auto whitespace-pre border border-border" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 last:mb-0">{children}</pre>
          ),
          // Lists - tight spacing for terminal aesthetic
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 mb-1.5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 mb-1.5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-snug [&>p]:mb-0 [&>p]:inline">{children}</li>
          ),
          // Links - detect document links and render as prominent button
          a: ({ href, children }) => {
            // Document links get special button treatment
            if (href?.startsWith('/documents/')) {
              return <DocumentLinkButton href={href}>{children}</DocumentLinkButton>;
            }
            return (
              <a href={href} className="text-primary underline underline-offset-2 hover:no-underline" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground mb-1.5 last:mb-0">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="border-border my-4" />,
          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
