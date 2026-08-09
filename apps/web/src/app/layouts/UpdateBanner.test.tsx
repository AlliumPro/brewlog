import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  it('announces itself without stealing focus', () => {
    renderWithProviders(<UpdateBanner onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    // status, not alert: a new version is worth mentioning, not worth interrupting for.
    expect(screen.getByRole('status')).toHaveTextContent('A new version is ready.');
  });

  it('offers both updating now and postponing', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();

    renderWithProviders(<UpdateBanner onUpdate={onUpdate} onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    // Postponing must not reload: the brew form may be half filled.
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
