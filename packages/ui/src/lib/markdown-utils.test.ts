/**
 * Markdown Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { normalizeNewlines } from './markdown-utils';

describe('normalizeNewlines', () => {
  it('converts single newlines to double', () => {
    const input = 'Line one\nLine two\nLine three';
    const result = normalizeNewlines(input);
    expect(result).toBe('Line one\n\nLine two\n\nLine three');
  });

  it('preserves existing double newlines', () => {
    const input = 'Paragraph one\n\nParagraph two';
    const result = normalizeNewlines(input);
    expect(result).toBe('Paragraph one\n\nParagraph two');
  });

  it('preserves code blocks', () => {
    const input = 'Text\n```\ncode line 1\ncode line 2\n```\nMore text';
    const result = normalizeNewlines(input);
    // Code block should be unchanged
    expect(result).toContain('```\ncode line 1\ncode line 2\n```');
  });

  it('preserves list markers', () => {
    const input = 'List:\n- item 1\n- item 2\n* item 3\n+ item 4';
    const result = normalizeNewlines(input);
    // List items should not get extra newlines before them
    expect(result).toContain('- item 1');
    expect(result).toContain('- item 2');
    expect(result).toContain('* item 3');
    expect(result).toContain('+ item 4');
  });

  it('preserves numbered lists', () => {
    const input = 'Steps:\n1. First\n2. Second\n3. Third';
    const result = normalizeNewlines(input);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
    expect(result).toContain('3. Third');
  });

  it('handles empty string', () => {
    expect(normalizeNewlines('')).toBe('');
  });

  it('handles string with no newlines', () => {
    const input = 'Single line text';
    expect(normalizeNewlines(input)).toBe('Single line text');
  });

  it('handles multiple code blocks', () => {
    const input = '```js\ncode1\n```\ntext\n```py\ncode2\n```';
    const result = normalizeNewlines(input);
    expect(result).toContain('```js\ncode1\n```');
    expect(result).toContain('```py\ncode2\n```');
  });

  it('handles code blocks with language specifiers', () => {
    const input = '```typescript\nconst x = 1;\nconst y = 2;\n```';
    const result = normalizeNewlines(input);
    expect(result).toContain('const x = 1;\nconst y = 2;');
  });
});
