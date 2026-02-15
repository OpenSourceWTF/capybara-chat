/**
 * LoadingButton Tests (TDD)
 *
 * Tests for LoadingButton component - a Button wrapper that shows loading state.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Requirements:
 * 1. Shows spinner when loading={true}
 * 2. Displays loadingText when provided while loading
 * 3. Shows children when not loading
 * 4. Is disabled when loading
 * 5. Has aria-busy="true" when loading
 * 6. Forwards all Button props correctly
 * 7. Does not show spinner when loading={false}
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadingButton } from './LoadingButton';

describe('LoadingButton', () => {
  describe('loading state', () => {
    it('should show spinner when loading={true}', () => {
      render(<LoadingButton loading={true}>Submit</LoadingButton>);

      // Spinner should be present (role="status" for accessibility)
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should display loadingText when provided while loading', () => {
      render(
        <LoadingButton loading={true} loadingText="Saving...">
          Submit
        </LoadingButton>
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.queryByText('Submit')).not.toBeInTheDocument();
    });

    it('should show children as loading text when loadingText not provided', () => {
      render(<LoadingButton loading={true}>Submit</LoadingButton>);

      // When no loadingText, children should still be visible alongside spinner
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should be disabled when loading', () => {
      render(<LoadingButton loading={true}>Submit</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should have aria-busy="true" when loading', () => {
      render(<LoadingButton loading={true}>Submit</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should prevent clicks when loading', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <LoadingButton loading={true} onClick={handleClick}>
          Submit
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('non-loading state', () => {
    it('should show children when not loading', () => {
      render(<LoadingButton loading={false}>Submit</LoadingButton>);

      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should not show spinner when loading={false}', () => {
      render(<LoadingButton loading={false}>Submit</LoadingButton>);

      // No spinner role should be present
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not have aria-busy when not loading', () => {
      render(<LoadingButton loading={false}>Submit</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('aria-busy');
    });

    it('should be enabled when not loading and not explicitly disabled', () => {
      render(<LoadingButton loading={false}>Submit</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toBeEnabled();
    });

    it('should allow clicks when not loading', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <LoadingButton loading={false} onClick={handleClick}>
          Submit
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Button prop forwarding', () => {
    it('should forward variant prop to Button', () => {
      render(
        <LoadingButton loading={false} variant="destructive">
          Delete
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      // destructive variant has specific classes
      expect(button).toHaveClass('bg-destructive');
    });

    it('should forward size prop to Button', () => {
      render(
        <LoadingButton loading={false} size="sm">
          Small
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      // sm size has h-8 class
      expect(button).toHaveClass('h-8');
    });

    it('should forward className prop to Button', () => {
      render(
        <LoadingButton loading={false} className="custom-class">
          Custom
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should forward disabled prop correctly when not loading', () => {
      render(
        <LoadingButton loading={false} disabled={true}>
          Disabled
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should merge disabled state with loading state', () => {
      // When both loading=true and disabled=true, button should be disabled
      render(
        <LoadingButton loading={true} disabled={true}>
          Both
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should forward type prop to Button', () => {
      render(
        <LoadingButton loading={false} type="submit">
          Submit
        </LoadingButton>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should forward data-testid prop', () => {
      render(
        <LoadingButton loading={false} data-testid="loading-btn">
          Test
        </LoadingButton>
      );

      expect(screen.getByTestId('loading-btn')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined loading prop (defaults to false)', () => {
      render(<LoadingButton>Submit</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toBeEnabled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should handle empty children', () => {
      render(<LoadingButton loading={true}></LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should handle complex children (React elements)', () => {
      render(
        <LoadingButton loading={false}>
          <span data-testid="icon">+</span>
          <span>Add Item</span>
        </LoadingButton>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });

    it('should toggle loading state correctly', () => {
      const { rerender } = render(
        <LoadingButton loading={false}>Submit</LoadingButton>
      );

      // Initially not loading
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // Set loading
      rerender(<LoadingButton loading={true}>Submit</LoadingButton>);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();

      // Back to not loading
      rerender(<LoadingButton loading={false}>Submit</LoadingButton>);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });
});
