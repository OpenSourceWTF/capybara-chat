/**
 * TagList Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagList } from './TagList';

describe('TagList', () => {
  it('renders null for empty tags', () => {
    const { container } = render(<TagList tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null for undefined tags', () => {
    const { container } = render(<TagList tags={undefined as unknown as string[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all tags when under maxVisible', () => {
    render(<TagList tags={['a', 'b']} maxVisible={3} />);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('truncates tags and shows overflow count', () => {
    render(<TagList tags={['a', 'b', 'c', 'd', 'e']} maxVisible={2} />);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.queryByText('c')).not.toBeInTheDocument();
  });

  it('shows all tags when maxVisible is 0', () => {
    render(<TagList tags={['a', 'b', 'c']} maxVisible={0} />);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('applies size sm styles', () => {
    render(<TagList tags={['tag']} size="sm" />);
    const badge = screen.getByText('tag');
    expect(badge.className).toContain('text-xs');
  });

  it('applies size md styles', () => {
    render(<TagList tags={['tag']} size="md" />);
    const badge = screen.getByText('tag');
    expect(badge.className).toContain('text-xs');
  });

  it('handles onTagClick when provided', () => {
    const onClick = vi.fn();
    render(<TagList tags={['clickable']} onTagClick={onClick} />);
    fireEvent.click(screen.getByText('clickable'));
    expect(onClick).toHaveBeenCalledWith('clickable');
  });

  it('does not call onClick when not provided', () => {
    render(<TagList tags={['tag']} />);
    // Just verify it renders without onClick
    expect(screen.getByText('tag')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TagList tags={['tag']} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
