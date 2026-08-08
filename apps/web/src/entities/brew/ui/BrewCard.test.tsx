import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Brew } from '@/shared/api';
import { renderWithProviders } from '@/test/render';

import { BrewCard } from './BrewCard';

const brew: Brew = {
  id: '01900000-0000-7000-8000-000000000000',
  method: 'v60',
  methodOther: null,
  beanName: 'Kieni AA',
  roaster: 'Nomad',
  roastDate: '2026-07-20',
  grindSize: 'medium-fine',
  doseGrams: 15,
  waterMl: 250,
  waterTempC: 94,
  brewTimeSeconds: 165,
  notes: 'blackcurrant',
  rating: 4,
  ratio: 16.7,
  daysAfterRoast: 8,
  photoUrl: null,
  brewedAt: '2026-07-28T07:30:00.000Z',
  createdAt: '2026-07-28T07:30:00.000Z',
  updatedAt: '2026-07-28T07:30:00.000Z',
};

describe('BrewCard', () => {
  it('leads with the ratio and the brew time', () => {
    renderWithProviders(<BrewCard brew={brew} />);

    expect(screen.getByText('1:16.7')).toBeInTheDocument();
    expect(screen.getByText('2:45')).toBeInTheDocument();
  });

  it('names the bean, the method and the roaster', () => {
    renderWithProviders(<BrewCard brew={brew} />);

    expect(screen.getByRole('heading', { name: 'Kieni AA' })).toBeInTheDocument();
    expect(screen.getByText(/V60/)).toBeInTheDocument();
    expect(screen.getByText(/Nomad/)).toBeInTheDocument();
  });

  it('exposes the rating as text, not only as coloured dots', () => {
    renderWithProviders(<BrewCard brew={brew} />);

    expect(screen.getByText('Rated 4 out of 5')).toBeInTheDocument();
  });

  it('shows the custom method name when the method is "other"', () => {
    renderWithProviders(<BrewCard brew={{ ...brew, method: 'other', methodOther: 'siphon' }} />);

    expect(screen.getByText(/siphon/)).toBeInTheDocument();
  });

  it('links to the details screen', () => {
    renderWithProviders(<BrewCard brew={brew} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', `/brews/${brew.id}`);
  });
});
