import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { BottomNav } from './BottomNav';

const pill = (container: HTMLElement): Element | null =>
  container.querySelector('[aria-hidden="true"]');

describe('BottomNav', () => {
  it('is a labelled navigation landmark', () => {
    renderWithProviders(<BottomNav />);

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('marks the current section for assistive technology, not only with the pill', () => {
    renderWithProviders(<BottomNav />, '/stats');

    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Journal' })).not.toHaveAttribute('aria-current');
  });

  it('keeps Journal inactive on the log form', () => {
    renderWithProviders(<BottomNav />, '/brews/new');

    expect(screen.getByRole('link', { name: 'Journal' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page');
  });

  it('treats a brew page as part of the journal', () => {
    // Regression: the pill was placed under Journal by one calculation while NavLink decided
    // no link was active, so the label stayed muted grey on the bright gradient.
    const { container } = renderWithProviders(<BottomNav />, '/brews/01900000-0000-7000-8000-0');

    expect(screen.getByRole('link', { name: 'Journal' })).toHaveAttribute('aria-current', 'page');
    expect(pill(container)).toHaveStyle({ '--index': '0' });
  });

  it('slides the pill to the active segment', () => {
    const { container } = renderWithProviders(<BottomNav />, '/stats');

    // Fourth item — Journal, Log, Recipes, Stats — so the pill is offset by three widths.
    expect(pill(container)).toHaveStyle({ '--index': '3' });
  });

  it('reaches the profile section', () => {
    renderWithProviders(<BottomNav />, '/profile');

    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows no pill at all when the path belongs to no section', () => {
    const { container } = renderWithProviders(<BottomNav />, '/somewhere-else');

    // A pill parked under an inactive label is what produced the unreadable text.
    expect(pill(container)).toBeNull();

    for (const label of ['Journal', 'Log', 'Recipes', 'Stats', 'You']) {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute('aria-current');
    }
  });
});
