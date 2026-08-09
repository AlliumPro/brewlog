import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { BottomNav } from './BottomNav';

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

  it('keeps Journal active only on the index, not on every nested path', () => {
    renderWithProviders(<BottomNav />, '/brews/new');

    expect(screen.getByRole('link', { name: 'Journal' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page');
  });

  it('slides the pill to the active segment', () => {
    const { container } = renderWithProviders(<BottomNav />, '/stats');
    const pill = container.querySelector('[aria-hidden="true"]');

    // Third item, so the pill is offset by two of its own widths.
    expect(pill).toHaveStyle({ '--index': '2' });
  });

  it('falls back to the first segment on an unknown path', () => {
    const { container } = renderWithProviders(<BottomNav />, '/somewhere-else');
    const pill = container.querySelector('[aria-hidden="true"]');

    expect(pill).toHaveStyle({ '--index': '0' });
  });
});
