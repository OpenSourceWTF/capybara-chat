/**
 * EntityAutocomplete Component Tests
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityAutocomplete } from './EntityAutocomplete';
import type { EntitySearchResult } from '../../hooks/useEntitySearch';
import type { EntitySelectionState } from '../../lib/slash-command-parser';

// Mock scrollIntoView which is not available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Helper to create selection state
const createSelectionState = (overrides: Partial<EntitySelectionState> = {}): EntitySelectionState => ({
  active: true,
  entityType: 'prompt',
  action: 'edit',
  searchQuery: '',
  commandPrefix: '/edit prompt:',
  ...overrides,
});

// Helper to create search results
const createResults = (count: number): EntitySearchResult[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `prompt-${i + 1}`,
    displayName: `Prompt ${i + 1}`,
    entityType: 'prompt' as const,
  }));

describe('EntityAutocomplete', () => {
  it('renders loading state', () => {
    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={[]}
        loading={true}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByTestId('entity-autocomplete')).toBeInTheDocument();
    expect(screen.getByText(/Searching prompts.../)).toBeInTheDocument();
  });

  it('renders searching state (debouncing)', () => {
    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={[]}
        loading={false}
        isSearching={true}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/Searching prompts.../)).toBeInTheDocument();
  });

  it('renders empty state when no entities exist', () => {
    render(
      <EntityAutocomplete
        selectionState={createSelectionState({ searchQuery: '' })}
        results={[]}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/No prompts available. Create one first./)).toBeInTheDocument();
  });

  it('renders no results message when search finds nothing', () => {
    render(
      <EntityAutocomplete
        selectionState={createSelectionState({ searchQuery: 'nonexistent' })}
        results={[]}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/No prompts found matching "nonexistent"/)).toBeInTheDocument();
  });

  it('renders list of results', () => {
    const results = createResults(3);

    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={results}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Prompt 1')).toBeInTheDocument();
    expect(screen.getByText('Prompt 2')).toBeInTheDocument();
    expect(screen.getByText('Prompt 3')).toBeInTheDocument();
    expect(screen.getByText('prompt-1')).toBeInTheDocument();
  });

  it('highlights selected item', () => {
    const results = createResults(3);

    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={results}
        loading={false}
        isSearching={false}
        selectedIndex={1}
        onSelect={vi.fn()}
      />
    );

    const buttons = screen.getAllByTestId(/entity-suggestion-/);
    expect(buttons[0]).not.toHaveClass('bg-muted');
    expect(buttons[1]).toHaveClass('bg-muted');
    expect(buttons[2]).not.toHaveClass('bg-muted');
  });

  it('calls onSelect when item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const results = createResults(2);

    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={results}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByTestId('entity-suggestion-1'));
    expect(onSelect).toHaveBeenCalledWith(results[1]);
  });

  it('clamps selectedIndex to valid range', () => {
    const results = createResults(2);

    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={results}
        loading={false}
        isSearching={false}
        selectedIndex={10} // Out of bounds
        onSelect={vi.fn()}
      />
    );

    // Last item should be highlighted (clamped to index 1)
    const buttons = screen.getAllByTestId(/entity-suggestion-/);
    expect(buttons[0]).not.toHaveClass('bg-muted');
    expect(buttons[1]).toHaveClass('bg-muted');
  });

  it('shows keyboard navigation hint', () => {
    const results = createResults(1);

    render(
      <EntityAutocomplete
        selectionState={createSelectionState()}
        results={results}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/↑↓ to navigate/)).toBeInTheDocument();
    expect(screen.getByText(/Enter to select/)).toBeInTheDocument();
  });

  it('renders correct icon for different entity types', () => {
    const promptResults: EntitySearchResult[] = [
      { id: 'prompt-1', displayName: 'Test Prompt', entityType: 'prompt' },
    ];

    const { rerender } = render(
      <EntityAutocomplete
        selectionState={createSelectionState({ entityType: 'prompt' })}
        results={promptResults}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    // Component renders, icon is present (we can't easily test which icon without querying by class)
    expect(screen.getByTestId('entity-suggestion-0')).toBeInTheDocument();

    // Test with document type
    const docResults: EntitySearchResult[] = [
      { id: 'doc-1', displayName: 'Test Doc', entityType: 'document' },
    ];

    rerender(
      <EntityAutocomplete
        selectionState={createSelectionState({ entityType: 'document' })}
        results={docResults}
        loading={false}
        isSearching={false}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Test Doc')).toBeInTheDocument();
  });
});
