/**
 * Terminal Field Style Tests
 *
 * Guards against regressions when refactoring Input, Textarea, and Select
 * to use shared terminal field styles.
 *
 * These tests verify:
 * 1. Both 'default' and 'terminal' variants render correctly
 * 2. Variant-specific styles are applied
 * 3. Custom className is merged properly
 * 4. Disabled state works correctly
 * 5. Refs are forwarded properly
 */

import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';

describe('Input', () => {
  describe('variant styles', () => {
    it('should render with default variant by default', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');

      // Default variant has these classes
      expect(input).toHaveClass('h-10');
      expect(input).toHaveClass('border');
      expect(input).toHaveClass('bg-background');
      expect(input).toHaveClass('shadow-sm');
    });

    it('should render with terminal variant when specified', () => {
      render(<Input variant="terminal" data-testid="input" />);
      const input = screen.getByTestId('input');

      // Terminal variant has these classes
      expect(input).toHaveClass('h-8');
      expect(input).toHaveClass('border-0');
      expect(input).toHaveClass('border-b');
      expect(input).toHaveClass('bg-transparent');
      expect(input).toHaveClass('shadow-none');
    });

    it('should have monospace font and zero border radius', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');

      expect(input).toHaveClass('font-mono');
      expect(input).toHaveClass('rounded-none');
    });
  });

  describe('props', () => {
    it('should merge custom className', () => {
      render(<Input className="custom-class" data-testid="input" />);
      const input = screen.getByTestId('input');

      expect(input).toHaveClass('custom-class');
      expect(input).toHaveClass('font-mono'); // Base class still present
    });

    it('should handle disabled state', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');

      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:opacity-50');
    });

    it('should forward ref', () => {
      const ref = createRef<HTMLInputElement>();
      render(<Input ref={ref} data-testid="input" />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current).toBe(screen.getByTestId('input'));
    });

    it('should pass through input attributes', () => {
      render(
        <Input
          type="email"
          placeholder="test placeholder"
          data-testid="input"
        />
      );
      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.type).toBe('email');
      expect(input.placeholder).toBe('test placeholder');
    });
  });
});

describe('Textarea', () => {
  describe('variant styles', () => {
    it('should render with default variant by default', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');

      // Default variant has these classes
      expect(textarea).toHaveClass('border');
      expect(textarea).toHaveClass('bg-background');
      expect(textarea).toHaveClass('shadow-sm');
    });

    it('should render with terminal variant when specified', () => {
      render(<Textarea variant="terminal" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');

      // Terminal variant has these classes
      expect(textarea).toHaveClass('border-0');
      expect(textarea).toHaveClass('border-b');
      expect(textarea).toHaveClass('bg-transparent');
      expect(textarea).toHaveClass('shadow-none');
      expect(textarea).toHaveClass('resize-none');
    });

    it('should have monospace font and zero border radius', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');

      expect(textarea).toHaveClass('font-mono');
      expect(textarea).toHaveClass('rounded-none');
    });
  });

  describe('props', () => {
    it('should merge custom className', () => {
      render(<Textarea className="custom-class" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');

      expect(textarea).toHaveClass('custom-class');
      expect(textarea).toHaveClass('font-mono');
    });

    it('should handle disabled state', () => {
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');

      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('disabled:opacity-50');
    });

    it('should forward ref', () => {
      const ref = createRef<HTMLTextAreaElement>();
      render(<Textarea ref={ref} data-testid="textarea" />);

      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
      expect(ref.current).toBe(screen.getByTestId('textarea'));
    });
  });
});

describe('Select', () => {
  const options = (
    <>
      <option value="">Choose...</option>
      <option value="a">Option A</option>
      <option value="b">Option B</option>
    </>
  );

  describe('variant styles', () => {
    it('should render with default variant by default', () => {
      render(<Select data-testid="select">{options}</Select>);
      const select = screen.getByTestId('select');

      // Default variant has these classes
      expect(select).toHaveClass('h-10');
      expect(select).toHaveClass('border');
      expect(select).toHaveClass('bg-background');
      expect(select).toHaveClass('shadow-sm');
    });

    it('should render with terminal variant when specified', () => {
      render(<Select variant="terminal" data-testid="select">{options}</Select>);
      const select = screen.getByTestId('select');

      // Terminal variant has these classes
      expect(select).toHaveClass('h-8');
      expect(select).toHaveClass('border-0');
      expect(select).toHaveClass('border-b');
      expect(select).toHaveClass('bg-transparent');
      expect(select).toHaveClass('shadow-none');
    });

    it('should have monospace font and zero border radius', () => {
      render(<Select data-testid="select">{options}</Select>);
      const select = screen.getByTestId('select');

      expect(select).toHaveClass('font-mono');
      expect(select).toHaveClass('rounded-none');
    });

    it('should render chevron icon', () => {
      const { container } = render(<Select>{options}</Select>);

      // ChevronDown from lucide-react renders as an SVG
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('pointer-events-none');
    });
  });

  describe('props', () => {
    it('should merge custom className', () => {
      render(<Select className="custom-class" data-testid="select">{options}</Select>);
      const select = screen.getByTestId('select');

      expect(select).toHaveClass('custom-class');
      expect(select).toHaveClass('font-mono');
    });

    it('should handle disabled state', () => {
      render(<Select disabled data-testid="select">{options}</Select>);
      const select = screen.getByTestId('select');

      expect(select).toBeDisabled();
      expect(select).toHaveClass('disabled:opacity-50');
    });

    it('should forward ref', () => {
      const ref = createRef<HTMLSelectElement>();
      render(<Select ref={ref} data-testid="select">{options}</Select>);

      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
      expect(ref.current).toBe(screen.getByTestId('select'));
    });
  });
});

/**
 * Cross-component consistency tests
 *
 * These verify that all three components share consistent behavior
 * that should be maintained after extracting shared styles.
 */
describe('Terminal Fields Consistency', () => {
  it('all components should use font-mono', () => {
    const { rerender } = render(<Input data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('font-mono');

    rerender(<Textarea data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('font-mono');

    rerender(<Select data-testid="field"><option>Test</option></Select>);
    expect(screen.getByTestId('field')).toHaveClass('font-mono');
  });

  it('all components should use rounded-none', () => {
    const { rerender } = render(<Input data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('rounded-none');

    rerender(<Textarea data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('rounded-none');

    rerender(<Select data-testid="field"><option>Test</option></Select>);
    expect(screen.getByTestId('field')).toHaveClass('rounded-none');
  });

  it('all components should have consistent disabled styles', () => {
    const { rerender } = render(<Input disabled data-testid="field" />);
    const field1 = screen.getByTestId('field');
    expect(field1).toHaveClass('disabled:cursor-not-allowed');
    expect(field1).toHaveClass('disabled:opacity-50');

    rerender(<Textarea disabled data-testid="field" />);
    const field2 = screen.getByTestId('field');
    expect(field2).toHaveClass('disabled:cursor-not-allowed');
    expect(field2).toHaveClass('disabled:opacity-50');

    rerender(<Select disabled data-testid="field"><option>Test</option></Select>);
    const field3 = screen.getByTestId('field');
    expect(field3).toHaveClass('disabled:cursor-not-allowed');
    expect(field3).toHaveClass('disabled:opacity-50');
  });

  it('terminal variant should remove shadows on all components', () => {
    const { rerender } = render(<Input variant="terminal" data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('shadow-none');

    rerender(<Textarea variant="terminal" data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('shadow-none');

    rerender(<Select variant="terminal" data-testid="field"><option>Test</option></Select>);
    expect(screen.getByTestId('field')).toHaveClass('shadow-none');
  });

  it('terminal variant should use transparent background on all components', () => {
    const { rerender } = render(<Input variant="terminal" data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('bg-transparent');

    rerender(<Textarea variant="terminal" data-testid="field" />);
    expect(screen.getByTestId('field')).toHaveClass('bg-transparent');

    rerender(<Select variant="terminal" data-testid="field"><option>Test</option></Select>);
    expect(screen.getByTestId('field')).toHaveClass('bg-transparent');
  });
});
