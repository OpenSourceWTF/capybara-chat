/**
 * BreadcrumbBar Tests (TDD)
 *
 * Tests for BreadcrumbBar component - a terminal-style breadcrumb navigation.
 * These tests are written BEFORE implementation (TDD approach).
 *
 * Requirements:
 * 1. Renders items with "/" separators
 * 2. Marks current item with aria-current="page"
 * 3. Current item is not clickable
 * 4. Non-current items are clickable
 * 5. Has nav element with aria-label="Breadcrumb"
 * 6. Terminal style: ">" prefix, "[ ]" around current
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BreadcrumbBar } from './BreadcrumbBar';

// Type definition for breadcrumb items
interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

describe('BreadcrumbBar', () => {
  const defaultItems: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Prompts', href: '/prompts' },
    { label: 'Current Prompt' }, // No href = current
  ];

  describe('rendering', () => {
    it('should render all breadcrumb items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Prompts')).toBeInTheDocument();
      expect(screen.getByText('Current Prompt')).toBeInTheDocument();
    });

    it('should render "/" separators between items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      // Find separators - they should be present
      const separators = screen.getAllByText('/');
      expect(separators).toHaveLength(2); // 3 items = 2 separators
    });

    it('should render with terminal-style ">" prefix', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      // Terminal style starts with ">"
      expect(screen.getByText('>')).toBeInTheDocument();
    });

    it('should render current item with "[ ]" brackets', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      // Current item (last one without href) should be bracketed
      const nav = screen.getByRole('navigation');
      expect(nav.textContent).toContain('[');
      expect(nav.textContent).toContain('Current Prompt');
      expect(nav.textContent).toContain(']');
    });

    it('should not render brackets around non-current items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      // "Home" and "Prompts" should not be bracketed
      const homeLink = screen.getByRole('link', { name: 'Home' });
      const specsLink = screen.getByRole('link', { name: 'Prompts' });

      // Links should not contain brackets in their text
      expect(homeLink.textContent).not.toContain('[');
      expect(specsLink.textContent).not.toContain('[');
    });

    it('should handle single item breadcrumb', () => {
      render(<BreadcrumbBar items={[{ label: 'Dashboard' }]} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      // No separators for single item
      expect(screen.queryByText('/')).not.toBeInTheDocument();
    });

    it('should handle empty items array', () => {
      render(<BreadcrumbBar items={[]} />);

      const nav = screen.getByRole('navigation');
      // Should still render nav element
      expect(nav).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have nav element with aria-label="Breadcrumb"', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();
    });

    it('should have ordered list (ol) for breadcrumb structure', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const nav = screen.getByRole('navigation');
      const list = within(nav).getByRole('list');
      expect(list.tagName).toBe('OL');
    });

    it('should mark current item with aria-current="page"', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const currentItem = screen.getByText('Current Prompt');
      expect(currentItem).toHaveAttribute('aria-current', 'page');
    });

    it('should not have aria-current on non-current items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      const specsLink = screen.getByRole('link', { name: 'Prompts' });

      expect(homeLink).not.toHaveAttribute('aria-current');
      expect(specsLink).not.toHaveAttribute('aria-current');
    });

    it('should use aria-hidden="true" on separator elements', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const separators = screen.getAllByText('/');
      separators.forEach((sep) => {
        expect(sep).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('should have listitem role for each breadcrumb item', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });
  });

  describe('click behavior', () => {
    it('should call onClick for clickable items', async () => {
      const user = userEvent.setup();
      const handleHomeClick = vi.fn();

      const items: BreadcrumbItem[] = [
        { label: 'Home', onClick: handleHomeClick },
        { label: 'Prompts', href: '/prompts' },
        { label: 'Current Prompt' },
      ];

      render(<BreadcrumbBar items={items} />);

      await user.click(screen.getByText('Home'));

      expect(handleHomeClick).toHaveBeenCalledTimes(1);
    });

    it('should navigate to href for link items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveAttribute('href', '/');

      const specsLink = screen.getByRole('link', { name: 'Prompts' });
      expect(specsLink).toHaveAttribute('href', '/prompts');
    });

    it('should not be clickable when item is current (no href/onClick)', () => {
      // Current item has no href - clicking should do nothing
      render(<BreadcrumbBar items={defaultItems} />);

      const currentItem = screen.getByText('Current Prompt');

      // Current item should be a span, not a link or button
      expect(currentItem.tagName).not.toBe('A');
      expect(currentItem.tagName).not.toBe('BUTTON');
    });

    it('should render links for items with href', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Prompts' })).toBeInTheDocument();
    });

    it('should render buttons for items with onClick but no href', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      const items: BreadcrumbItem[] = [
        { label: 'Back', onClick: handleClick },
        { label: 'Current' },
      ];

      render(<BreadcrumbBar items={items} />);

      const backButton = screen.getByRole('button', { name: 'Back' });
      expect(backButton).toBeInTheDocument();

      await user.click(backButton);
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    it('should use monospace font (terminal style)', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('font-mono');
    });

    it('should have muted color for non-current items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveClass('text-muted-foreground');
    });

    it('should have primary/foreground color for current item', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const currentItem = screen.getByText('Current Prompt');
      expect(currentItem).toHaveClass('text-foreground');
    });

    it('should have hover effect on clickable items', () => {
      render(<BreadcrumbBar items={defaultItems} />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveClass('hover:text-foreground');
    });

    it('should apply custom className to nav element', () => {
      render(<BreadcrumbBar items={defaultItems} className="custom-breadcrumb" />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('custom-breadcrumb');
    });
  });

  describe('edge cases', () => {
    it('should handle items with special characters in labels', () => {
      const items: BreadcrumbItem[] = [
        { label: '<script>alert("xss")</script>', href: '/' },
        { label: 'Current & Active' },
      ];

      render(<BreadcrumbBar items={items} />);

      // Should render as text, not execute
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
      expect(screen.getByText('Current & Active')).toBeInTheDocument();
    });

    it('should handle very long labels', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Short', href: '/' },
        { label: 'This is a very long breadcrumb label that might cause layout issues' },
      ];

      render(<BreadcrumbBar items={items} />);

      const longLabel = screen.getByText(/This is a very long breadcrumb label/);
      expect(longLabel).toBeInTheDocument();
      // Should have truncation class
      expect(longLabel).toHaveClass('truncate');
    });

    it('should handle undefined onClick gracefully', async () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', onClick: undefined, href: '/' },
        { label: 'Current' },
      ];

      // Should not crash
      render(<BreadcrumbBar items={items} />);
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should handle items with both href and onClick', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/', onClick: handleClick },
        { label: 'Current' },
      ];

      render(<BreadcrumbBar items={items} />);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      await user.click(homeLink);

      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should be tabbable to clickable items', async () => {
      const user = userEvent.setup();
      render(<BreadcrumbBar items={defaultItems} />);

      await user.tab();
      expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('link', { name: 'Prompts' })).toHaveFocus();
    });

    it('should skip current item in tab order', async () => {
      const user = userEvent.setup();
      render(<BreadcrumbBar items={defaultItems} />);

      // Tab through all tabbable elements
      await user.tab();
      await user.tab();
      await user.tab();

      // Current item should not be focused (it's not interactive)
      const currentItem = screen.getByText('Current Prompt');
      expect(currentItem).not.toHaveFocus();
    });

    it('should activate links with Enter key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      const items: BreadcrumbItem[] = [
        { label: 'Home', onClick: handleClick },
        { label: 'Current' },
      ];

      render(<BreadcrumbBar items={items} />);

      const homeButton = screen.getByRole('button', { name: 'Home' });
      homeButton.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalled();
    });
  });
});
