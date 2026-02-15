/**
 * ContextUsageMeter Component Tests (TDD)
 *
 * Tests for the ContextUsageMeter React component per R4 specification.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Component Props (per spec R4):
 * - usage: { used: number; total: number; percent: number } | null
 * - isStale?: boolean
 * - className?: string
 *
 * NOTE: There is NO sessionType prop. Session type filtering happens in
 * the PARENT component (GeneralConversation.tsx), not in ContextUsageMeter.
 *
 * Display format when usage is available:
 *   CTX 63% [██████░░░░] 126k/200k
 *
 * Display when null:
 *   Component returns null (renders nothing)
 *
 * Color thresholds (4 bands):
 * - 0 ≤ p < 70:  text-success (green)
 * - 70 ≤ p < 80: text-warning (yellow)
 * - 80 ≤ p < 90: text-orange-600 (orange)
 * - 90 ≤ p ≤ 100: text-destructive (red)
 *
 * Token display: 'k' suffix (Math.round(value / 1000) + 'k')
 * Bar: 10 blocks, filled = Math.floor(percent/10), fill char = █, empty char = ░
 *
 * ARIA accessibility:
 * - role="meter" on the container
 * - aria-valuenow={percent}
 * - aria-valuemin="0" and aria-valuemax="100"
 * - aria-label with descriptive text
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextUsageMeter } from './ContextUsageMeter';

describe('ContextUsageMeter', () => {
  // ============================================================================
  // Null State (Component returns null when usage is null)
  // ============================================================================
  describe('null state', () => {
    it('returns null when usage is null', () => {
      const { container } = render(
        <ContextUsageMeter usage={null} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when usage is null even with className prop', () => {
      const { container } = render(
        <ContextUsageMeter usage={null} className="custom-class" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when usage is null even with isStale prop', () => {
      const { container } = render(
        <ContextUsageMeter usage={null} isStale={true} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  // ============================================================================
  // Display Format
  // ============================================================================
  describe('display format', () => {
    it('displays "CTX 63% [██████░░░░] 126k/200k" for usage {used:126000, total:200000, percent:63}', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 126000, total: 200000, percent: 63 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      const text = container.textContent;

      // Verify the exact format components
      expect(text).toContain('CTX');
      expect(text).toContain('63%');
      // 63% = 6 filled blocks (Math.floor(63/10) = 6)
      expect(text).toContain('██████░░░░');
      expect(text).toContain('126k');
      expect(text).toContain('200k');
    });

    it('displays correct bar for 23% (2 filled, 8 empty)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      const text = container.textContent || '';

      // Math.floor(23/10) = 2 filled blocks
      expect(text).toContain('██░░░░░░░░');
    });

    it('displays correct bar for 0% (0 filled, 10 empty)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 0, total: 200000, percent: 0 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      const text = container.textContent || '';

      expect(text).toContain('░░░░░░░░░░');
    });

    it('displays correct bar for 100% (10 filled, 0 empty)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 200000, total: 200000, percent: 100 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      const text = container.textContent || '';

      expect(text).toContain('██████████');
    });

    it('displays CTX label', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 50000, total: 200000, percent: 25 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('CTX');
    });

    it('displays percent value with % symbol', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 80000, total: 200000, percent: 40 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('40%');
    });

    it('matches exact format pattern with regex', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      // Verify bracket-wrapped bar with exactly 10 block characters
      expect(text).toMatch(/\[[\u2588\u2591]{10}\]/);
      // Verify slash between used/total (with 'k' suffix)
      expect(text).toMatch(/\d+k\/\d+k/);
      // Verify CTX label followed by percent
      expect(text).toMatch(/CTX\s+\d+%/);
    });
  });

  // ============================================================================
  // Color Boundaries (4 color bands)
  // ============================================================================
  describe('color thresholds', () => {
    // Green band: 0 <= p < 70
    it('at percent=0, container has text-success class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 0, total: 200000, percent: 0 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('at percent=50, container has text-success class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('at percent=69, container has text-success class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 138000, total: 200000, percent: 69 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    // Yellow band: 70 <= p < 80
    it('at percent=70, container has text-warning class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 140000, total: 200000, percent: 70 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('at percent=75, container has text-warning class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 150000, total: 200000, percent: 75 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('at percent=79, container has text-warning class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 158000, total: 200000, percent: 79 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    // Orange band: 80 <= p < 90
    it('at percent=80, container has text-orange-600 class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 160000, total: 200000, percent: 80 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('at percent=85, container has text-orange-600 class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 170000, total: 200000, percent: 85 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('at percent=89, container has text-orange-600 class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 178000, total: 200000, percent: 89 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    // Red band: 90 <= p <= 100
    it('at percent=90, container has text-destructive class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 180000, total: 200000, percent: 90 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-destructive');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
    });

    it('at percent=95, container has text-destructive class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 190000, total: 200000, percent: 95 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-destructive');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
    });

    it('at percent=100, container has text-destructive class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 200000, total: 200000, percent: 100 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-destructive');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
    });
  });

  // ============================================================================
  // Bar Calculation (filled blocks = Math.floor(percent/10))
  // ============================================================================
  describe('bar calculation', () => {
    it('at 9% has 0 filled blocks', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 18000, total: 200000, percent: 9 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.floor(9/10) = 0 filled blocks
      expect(container.textContent).toContain('░░░░░░░░░░');
    });

    it('at 10% has 1 filled block', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 20000, total: 200000, percent: 10 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.floor(10/10) = 1 filled block
      expect(container.textContent).toContain('█░░░░░░░░░');
    });

    it('at 55% has 5 filled blocks', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 110000, total: 200000, percent: 55 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.floor(55/10) = 5 filled blocks
      expect(container.textContent).toContain('█████░░░░░');
    });

    it('at 99% has 9 filled blocks', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 198000, total: 200000, percent: 99 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.floor(99/10) = 9 filled blocks
      expect(container.textContent).toContain('█████████░');
    });

    it('at 45% has 4 filled blocks', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 90000, total: 200000, percent: 45 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.floor(45/10) = 4 filled blocks
      expect(container.textContent).toContain('████░░░░░░');
    });

    it('bar is enclosed in square brackets', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      const text = container.textContent || '';
      expect(text).toMatch(/\[.{10}\]/);
    });
  });

  // ============================================================================
  // Token Formatting ('k' suffix)
  // ============================================================================
  describe('token formatting', () => {
    it('formats 126000 as "126k"', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 126000, total: 200000, percent: 63 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('126k');
    });

    it('formats 200000 as "200k"', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('200k');
    });

    it('formats 1500 as "2k" (Math.round)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 1500, total: 10000, percent: 15 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.round(1500/1000) = 2
      expect(container.textContent).toContain('2k');
    });

    it('formats 500 as "1k" (Math.round of 0.5)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 500, total: 10000, percent: 5 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      // Math.round(500/1000) = 1 (Math.round rounds 0.5 up)
      expect(container.textContent).toContain('1k');
    });

    it('formats 0 as "0k"', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 0, total: 200000, percent: 0 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('0k');
    });

    it('displays used/total format with "k" suffix', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 50000, total: 100000, percent: 50 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('50k/100k');
    });
  });

  // ============================================================================
  // Stale State
  // ============================================================================
  describe('stale state', () => {
    it('when isStale=true, container has opacity-50 class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
          isStale={true}
        />
      );

      expect(container.firstChild).toHaveClass('opacity-50');
    });

    it('when isStale=false, container does NOT have opacity-50 class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
          isStale={false}
        />
      );

      expect(container.firstChild).not.toHaveClass('opacity-50');
    });

    it('when isStale is undefined, container does NOT have opacity-50 class', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
        />
      );

      expect(container.firstChild).not.toHaveClass('opacity-50');
    });
  });

  // ============================================================================
  // ARIA Accessibility
  // ============================================================================
  describe('ARIA accessibility', () => {
    it('has role="meter" on the container', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const meter = screen.getByRole('meter');
      expect(meter).toBeInTheDocument();
    });

    it('has aria-valuenow set to the current percent', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 126000, total: 200000, percent: 63 }}
        />
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '63');
    });

    it('has aria-valuemin="0"', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuemin', '0');
    });

    it('has aria-valuemax="100"', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuemax', '100');
    });

    it('has aria-label with descriptive text', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 126000, total: 200000, percent: 63 }}
        />
      );

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-label');
      const ariaLabel = meter.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/context/i);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('renders correctly with 0% usage', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 0, total: 200000, percent: 0 }}
        />
      );

      expect(container.firstChild).not.toBeNull();
      expect(container.firstChild).toHaveClass('text-success');

      const text = container.textContent || '';
      expect(text).toContain('0%');
      expect(text).toContain('0k/200k');
    });

    it('renders correctly with 100% usage', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 200000, total: 200000, percent: 100 }}
        />
      );

      expect(container.firstChild).not.toBeNull();
      expect(container.firstChild).toHaveClass('text-destructive');

      const text = container.textContent || '';
      expect(text).toContain('100%');
      expect(text).toContain('200k/200k');
    });

    it('className prop is applied to container', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
          className="custom-test-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-test-class');
    });

    it('merges className with color class correctly', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
          className="custom-class"
        />
      );

      // Should have both custom and color classes
      expect(container.firstChild).toHaveClass('custom-class');
      expect(container.firstChild).toHaveClass('text-success');
    });

    it('merges className with stale class correctly', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
          className="custom-class"
          isStale={true}
        />
      );

      // Should have custom, color, and stale classes
      expect(container.firstChild).toHaveClass('custom-class');
      expect(container.firstChild).toHaveClass('text-success');
      expect(container.firstChild).toHaveClass('opacity-50');
    });
  });

  // ============================================================================
  // Re-rendering Behavior
  // ============================================================================
  describe('re-rendering behavior', () => {
    it('updates display when usage changes', () => {
      const { rerender } = render(
        <ContextUsageMeter
          usage={{ used: 45000, total: 200000, percent: 23 }}
        />
      );

      let container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('23%');
      expect(container.textContent).toContain('45k');

      rerender(
        <ContextUsageMeter
          usage={{ used: 140000, total: 200000, percent: 70 }}
        />
      );

      container = screen.getByTestId('context-usage-meter');
      expect(container.textContent).toContain('70%');
      expect(container.textContent).toContain('140k');
    });

    it('updates color class when crossing from green to yellow (69% -> 70%)', () => {
      const { container, rerender } = render(
        <ContextUsageMeter
          usage={{ used: 138000, total: 200000, percent: 69 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');

      rerender(
        <ContextUsageMeter
          usage={{ used: 140000, total: 200000, percent: 70 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('updates color class when crossing from yellow to orange (79% -> 80%)', () => {
      const { container, rerender } = render(
        <ContextUsageMeter
          usage={{ used: 158000, total: 200000, percent: 79 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-destructive');

      rerender(
        <ContextUsageMeter
          usage={{ used: 160000, total: 200000, percent: 80 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-destructive');
    });

    it('updates color class when crossing from orange to red (89% -> 90%)', () => {
      const { container, rerender } = render(
        <ContextUsageMeter
          usage={{ used: 178000, total: 200000, percent: 89 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-orange-600');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-destructive');

      rerender(
        <ContextUsageMeter
          usage={{ used: 180000, total: 200000, percent: 90 }}
        />
      );

      expect(container.firstChild).toHaveClass('text-destructive');
      expect(container.firstChild).not.toHaveClass('text-success');
      expect(container.firstChild).not.toHaveClass('text-warning');
      expect(container.firstChild).not.toHaveClass('text-orange-600');
    });

    it('transitions from rendered to null when usage becomes null', () => {
      const { container, rerender } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
        />
      );

      expect(container.firstChild).not.toBeNull();

      rerender(
        <ContextUsageMeter usage={null} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('transitions from null to rendered when usage becomes available', () => {
      const { container, rerender } = render(
        <ContextUsageMeter usage={null} />
      );

      expect(container.firstChild).toBeNull();

      rerender(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
        />
      );

      expect(container.firstChild).not.toBeNull();
      expect(container.textContent).toContain('23%');
    });
  });

  // ============================================================================
  // Defensive Edge Cases (overflow/underflow/boundary)
  // ============================================================================
  describe('defensive edge cases', () => {
    it('caps bar at 10 filled blocks when percent > 100', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 220000, total: 200000, percent: 110 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      const filledChar = '\u2588';
      // Should be exactly 10 filled blocks, not 11
      expect(text).toContain(filledChar.repeat(10));
      // Verify no 11th filled block appears (no empty after 10 filled)
      expect(text).not.toContain(filledChar.repeat(11));
      // Should not have any empty blocks if all 10 are filled
      expect(text).toMatch(/\[[\u2588]{10}\]/);
    });

    it('shows 0 filled blocks when percent is negative', () => {
      render(
        <ContextUsageMeter
          usage={{ used: -5000, total: 200000, percent: -3 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      const emptyChar = '\u2591';
      // All 10 should be empty blocks
      expect(text).toContain(emptyChar.repeat(10));
      expect(text).toMatch(/\[[\u2591]{10}\]/);
    });

    it('handles zero total gracefully', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 0, total: 0, percent: 0 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      expect(container).toBeInTheDocument();
      expect(container.textContent).toContain('0%');
      expect(container.textContent).toContain('0k/0k');
    });

    it('handles decimal percent (23.7 rounds to 2 filled blocks via Math.floor)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 47400, total: 200000, percent: 23.7 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      const filledChar = '\u2588';
      const emptyChar = '\u2591';
      // Math.floor(23.7/10) = 2 filled blocks
      expect(text).toContain(filledChar.repeat(2) + emptyChar.repeat(8));
    });

    it('handles very large percent (150%) by capping to 10 filled blocks', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 300000, total: 200000, percent: 150 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      // Should be exactly 10 filled blocks
      expect(text).toMatch(/\[[\u2588]{10}\]/);
    });

    it('handles large negative percent (-50%) by showing 0 filled blocks', () => {
      render(
        <ContextUsageMeter
          usage={{ used: -100000, total: 200000, percent: -50 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      // All empty blocks
      expect(text).toMatch(/\[[\u2591]{10}\]/);
    });

    it('handles percent exactly at 100 boundary (10 filled blocks)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 200000, total: 200000, percent: 100 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      // Math.floor(100/10) = 10 filled blocks
      expect(text).toMatch(/\[[\u2588]{10}\]/);
    });

    it('handles single-digit percent correctly (5% = 0 filled blocks)', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 10000, total: 200000, percent: 5 }}
        />
      );

      const text = screen.getByTestId('context-usage-meter').textContent || '';
      // Math.floor(5/10) = 0 filled blocks
      expect(text).toMatch(/\[[\u2591]{10}\]/);
    });
  });

  // ============================================================================
  // Terminal Styling
  // ============================================================================
  describe('terminal styling', () => {
    it('should have monospace font class for terminal aesthetic', () => {
      const { container } = render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
        />
      );

      // Component should have font-mono for terminal style
      expect(container.firstChild).toHaveClass('font-mono');
    });

    it('uses block characters for the progress bar', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 100000, total: 200000, percent: 50 }}
        />
      );

      const container = screen.getByTestId('context-usage-meter');
      const text = container.textContent || '';

      // Should contain the Unicode block characters (█ and ░)
      expect(text).toMatch(/[█░]/);
    });

    it('has data-testid for testing', () => {
      render(
        <ContextUsageMeter
          usage={{ used: 45232, total: 200000, percent: 23 }}
        />
      );

      expect(screen.getByTestId('context-usage-meter')).toBeInTheDocument();
    });
  });
});

