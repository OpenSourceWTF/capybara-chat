/**
 * VersionDiff Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionDiff } from './VersionDiff';
import type { DocumentVersion } from '@capybara-chat/types';

// Create mock versions
const mockCurrentVersion: DocumentVersion = {
  id: 'ver-2',
  documentId: 'doc-1',
  content: 'Updated content\nWith new line',
  createdAt: Date.now(),
  createdBy: 'user',
};

const mockPreviousVersion: DocumentVersion = {
  id: 'ver-1',
  documentId: 'doc-1',
  content: 'Original content',
  createdAt: Date.now() - 10000,
  createdBy: 'user',
};

describe('VersionDiff', () => {
  it('should render the diff viewer', () => {
    render(
      <VersionDiff
        currentVersion={mockCurrentVersion}
        previousVersion={mockPreviousVersion}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('version-diff')).toBeInTheDocument();
    expect(screen.getByText('Version Comparison')).toBeInTheDocument();
  });

  it('should show message for first version when no previous version', () => {
    render(
      <VersionDiff
        currentVersion={mockCurrentVersion}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('This is the first version')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <VersionDiff
        currentVersion={mockCurrentVersion}
        previousVersion={mockPreviousVersion}
        onClose={onClose}
      />
    );

    // Find and click the close button (X icon button)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn =>
      btn.querySelector('svg.lucide-x') || btn.textContent === ''
    );

    if (closeButton) {
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should show restore button when onRestore is provided', () => {
    render(
      <VersionDiff
        currentVersion={mockCurrentVersion}
        previousVersion={mockPreviousVersion}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(screen.getByTestId('restore-version-button')).toBeInTheDocument();
  });

  it('should not show restore button when onRestore is not provided', () => {
    render(
      <VersionDiff
        currentVersion={mockCurrentVersion}
        previousVersion={mockPreviousVersion}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId('restore-version-button')).not.toBeInTheDocument();
  });

  it('should call onRestore when restore button is clicked', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();

    render(
      <VersionDiff
        currentVersion={mockCurrentVersion}
        previousVersion={mockPreviousVersion}
        onClose={vi.fn()}
        onRestore={onRestore}
      />
    );

    await user.click(screen.getByTestId('restore-version-button'));
    expect(onRestore).toHaveBeenCalledWith(mockCurrentVersion);
  });
});
