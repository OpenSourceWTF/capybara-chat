/**
 * Markdown Utilities - Pure functions for markdown processing
 *
 * Extracted from Markdown.tsx for unit testing.
 */

/**
 * Normalize newlines for better paragraph handling.
 * - Preserves code blocks (```...```)
 * - Preserves list items
 * - Converts plain sentence endings followed by newline to paragraph breaks
 */
export function normalizeNewlines(content: string): string {
  // First, protect code blocks by replacing them with placeholders
  const codeBlocks: string[] = [];
  let processed = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Convert single newlines to double (paragraph breaks)
  // But not when followed by list markers or already double
  processed = processed.replace(/([^\n])\n(?!\n)(?![-*+\d])/g, '$1\n\n');

  // Restore code blocks
  processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[parseInt(idx)]);

  return processed;
}
