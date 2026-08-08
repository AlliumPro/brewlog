import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomePage } from '../index';

describe('HomePage', () => {
  it('names the journal in a top-level heading', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'BrewLog' })).toBeInTheDocument();
  });

  it('explains the empty state instead of showing a blank screen', () => {
    render(<HomePage />);

    expect(screen.getByText('No brews yet.')).toBeInTheDocument();
  });
});
