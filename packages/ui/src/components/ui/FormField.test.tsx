/**
 * FormField Enhanced Tests (TDD)
 *
 * Tests for enhanced FormField component with error state support.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Current FormField only has label/required support.
 * New requirements add error state display with accessibility:
 * 1. Shows error when showError={true} and error is provided
 * 2. Hides error when showError={false} even if error is provided
 * 3. Shows "[!]" prefix for error messages (terminal style)
 * 4. Shows "[ok]" prefix for valid state (when showError=false and was previously shown)
 * 5. Has aria-invalid="true" when showing error
 * 6. Has aria-describedby pointing to error element
 * 7. Children are always rendered (never null)
 * 8. Gracefully handles non-string error values
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  describe('basic functionality (existing)', () => {
    it('should render label text', () => {
      render(
        <FormField label="Username">
          <input type="text" />
        </FormField>
      );

      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('should render required indicator when required={true}', () => {
      render(
        <FormField label="Email" required={true}>
          <input type="email" />
        </FormField>
      );

      // Required indicator is an asterisk
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should not render required indicator when required={false}', () => {
      render(
        <FormField label="Email" required={false}>
          <input type="email" />
        </FormField>
      );

      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('should render children', () => {
      render(
        <FormField label="Name">
          <input type="text" data-testid="name-input" />
        </FormField>
      );

      expect(screen.getByTestId('name-input')).toBeInTheDocument();
    });

    it('should apply custom className to wrapper', () => {
      const { container } = render(
        <FormField label="Name" className="custom-field">
          <input type="text" />
        </FormField>
      );

      expect(container.firstChild).toHaveClass('custom-field');
    });

    it('should use inline layout when inline={true}', () => {
      const { container } = render(
        <FormField label="Toggle" inline={true}>
          <input type="checkbox" />
        </FormField>
      );

      expect(container.firstChild).toHaveClass('flex');
      expect(container.firstChild).toHaveClass('items-center');
    });

    it('should use stacked layout by default', () => {
      const { container } = render(
        <FormField label="Name">
          <input type="text" />
        </FormField>
      );

      expect(container.firstChild).toHaveClass('flex-col');
    });
  });

  describe('error state display (new)', () => {
    it('should show error when showError={true} and error is provided', () => {
      render(
        <FormField label="Email" error="Invalid email format" showError={true}>
          <input type="email" data-testid="email-input" />
        </FormField>
      );

      expect(screen.getByText(/Invalid email format/)).toBeInTheDocument();
    });

    it('should hide error when showError={false} even if error is provided', () => {
      render(
        <FormField label="Email" error="Invalid email format" showError={false}>
          <input type="email" />
        </FormField>
      );

      expect(screen.queryByText(/Invalid email format/)).not.toBeInTheDocument();
    });

    it('should not show error when error is undefined', () => {
      render(
        <FormField label="Email" showError={true}>
          <input type="email" />
        </FormField>
      );

      // No error message element should be rendered
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show "[!]" prefix for error messages (terminal style)', () => {
      render(
        <FormField label="Email" error="Invalid email" showError={true}>
          <input type="email" />
        </FormField>
      );

      // The error message should have terminal-style prefix
      expect(screen.getByText(/\[!\]/)).toBeInTheDocument();
    });

    it('should show "[ok]" prefix for valid state after previous error', () => {
      render(
        <FormField label="Email" showValid={true}>
          <input type="email" />
        </FormField>
      );

      // Valid state indicator
      expect(screen.getByText(/\[ok\]/)).toBeInTheDocument();
    });
  });

  describe('accessibility (new)', () => {
    it('should have aria-invalid="true" on wrapper when showing error', () => {
      render(
        <FormField label="Email" error="Invalid email" showError={true}>
          <input type="email" data-testid="email-input" />
        </FormField>
      );

      // The wrapper should indicate invalid state for screen readers
      const wrapper = screen.getByTestId('email-input').closest('[aria-invalid]');
      expect(wrapper).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not have aria-invalid when not showing error', () => {
      render(
        <FormField label="Email">
          <input type="email" data-testid="email-input" />
        </FormField>
      );

      const wrapper = screen.getByTestId('email-input').closest('[aria-invalid]');
      // Should either not have the attribute or have it as "false"
      expect(wrapper?.getAttribute('aria-invalid')).not.toBe('true');
    });

    it('should have aria-describedby pointing to error element when showing error', () => {
      render(
        <FormField
          label="Email"
          error="Invalid email"
          showError={true}
          id="email-field"
        >
          <input type="email" data-testid="email-input" />
        </FormField>
      );

      // Error element should have an ID
      const errorElement = screen.getByText(/Invalid email/);
      expect(errorElement).toHaveAttribute('id');

      // Wrapper or input should reference error via aria-describedby
      const errorId = errorElement.getAttribute('id');
      const wrapper = screen.getByTestId('email-input').closest('[aria-describedby]');
      expect(wrapper?.getAttribute('aria-describedby')).toContain(errorId);
    });

    it('should use role="alert" for error messages', () => {
      render(
        <FormField label="Email" error="Required field" showError={true}>
          <input type="email" />
        </FormField>
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent(/Required field/);
    });
  });

  describe('children rendering', () => {
    it('should always render children when showError={true}', () => {
      render(
        <FormField label="Email" error="Error" showError={true}>
          <input type="email" data-testid="input" />
        </FormField>
      );

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('should always render children when showError={false}', () => {
      render(
        <FormField label="Email" error="Error" showError={false}>
          <input type="email" data-testid="input" />
        </FormField>
      );

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <FormField label="Range">
          <input type="number" data-testid="min" />
          <span>to</span>
          <input type="number" data-testid="max" />
        </FormField>
      );

      expect(screen.getByTestId('min')).toBeInTheDocument();
      expect(screen.getByTestId('max')).toBeInTheDocument();
      expect(screen.getByText('to')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should gracefully handle non-string error values (object)', () => {
      const errorObject = { message: 'Complex error' };

      // Should not crash - might show stringified version or ignore
      render(
        <FormField label="Email" error={errorObject as unknown as string} showError={true}>
          <input type="email" />
        </FormField>
      );

      // Component should render without crashing
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('should gracefully handle non-string error values (number)', () => {
      render(
        <FormField label="Age" error={404 as unknown as string} showError={true}>
          <input type="number" />
        </FormField>
      );

      expect(screen.getByText('Age')).toBeInTheDocument();
    });

    it('should gracefully handle empty string error', () => {
      render(
        <FormField label="Name" error="" showError={true}>
          <input type="text" />
        </FormField>
      );

      // Empty error should not show error UI
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should gracefully handle null error', () => {
      render(
        <FormField label="Name" error={null as unknown as string} showError={true}>
          <input type="text" />
        </FormField>
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should handle undefined children gracefully', () => {
      render(<FormField label="Empty">{undefined}</FormField>);

      expect(screen.getByText('Empty')).toBeInTheDocument();
    });

    it('should maintain error state across re-renders', () => {
      const { rerender } = render(
        <FormField label="Email" error="Invalid" showError={true}>
          <input type="email" />
        </FormField>
      );

      expect(screen.getByText(/Invalid/)).toBeInTheDocument();

      // Re-render with same props
      rerender(
        <FormField label="Email" error="Invalid" showError={true}>
          <input type="email" />
        </FormField>
      );

      expect(screen.getByText(/Invalid/)).toBeInTheDocument();
    });

    it('should transition from error to valid state', () => {
      const { rerender } = render(
        <FormField label="Email" error="Invalid" showError={true}>
          <input type="email" />
        </FormField>
      );

      expect(screen.getByText(/Invalid/)).toBeInTheDocument();

      // Fix the error
      rerender(
        <FormField label="Email" showError={false} showValid={true}>
          <input type="email" />
        </FormField>
      );

      expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
      expect(screen.getByText(/\[ok\]/)).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should apply error styling class when showing error', () => {
      const { container } = render(
        <FormField label="Email" error="Invalid" showError={true}>
          <input type="email" />
        </FormField>
      );

      // Error state should have visual indication
      const wrapper = container.firstChild;
      // Expect some class indicating error state (could be border-destructive, text-destructive, etc.)
      expect(wrapper).toHaveClass('text-destructive');
    });

    it('should apply success styling class when showing valid', () => {
      const { container } = render(
        <FormField label="Email" showValid={true}>
          <input type="email" />
        </FormField>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('text-success');
    });

    it('should use monospace font for error text (terminal style)', () => {
      render(
        <FormField label="Email" error="Invalid email" showError={true}>
          <input type="email" />
        </FormField>
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveClass('font-mono');
    });
  });
});
