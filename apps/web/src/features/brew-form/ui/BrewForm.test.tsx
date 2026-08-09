import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { BrewForm } from './BrewForm';

describe('BrewForm', () => {
  it('computes the ratio live from dose and water', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={vi.fn()} />);

    // Defaults are 15 g and 250 ml.
    expect(screen.getByText('1:16.7')).toBeInTheDocument();

    const water = screen.getByLabelText('Water (ml)');
    await user.clear(water);
    await user.type(water, '300');

    expect(await screen.findByText('1:20.0')).toBeInTheDocument();
  });

  it('refuses to submit without a bean name and says why', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Grind'), 'medium');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Which bean was it?')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks the invalid field for assistive technology, not only in colour', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Bean')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('maps a filled form onto the API shape, turning blanks into null', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Bean'), 'Kieni AA');
    await user.type(screen.getByLabelText('Grind'), 'medium-fine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      method: 'v60',
      methodOther: null,
      beanName: 'Kieni AA',
      roaster: null,
      roastDate: null,
      grindSize: 'medium-fine',
      doseGrams: 15,
      waterMl: 250,
      waterTempC: 94,
      brewTimeSeconds: 165,
      notes: null,
      rating: 3,
    });
  });

  it('leaves TDS empty rather than recording zero when nothing was measured', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Bean'), 'Kieni AA');
    await user.type(screen.getByLabelText('Grind'), 'medium');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    // Number(null) is 0, and a TDS of zero would be a measurement nobody took.
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ tdsPercent: null });
  });

  it('shows extraction as soon as a TDS reading is entered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={vi.fn()} />);

    expect(screen.queryByText(/extraction/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('TDS (%)'), '1.35');

    // Defaults are 15 g and 250 ml: 1.35% × 220 / 15 = 19.8%
    expect(await screen.findByText('19.8%')).toBeInTheDocument();
    expect(screen.getByText(/18–22% band/)).toBeInTheDocument();
  });

  it('asks for the method name only when the method is "other"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrewForm submitLabel="Save" onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText('Which method?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Method' }));
    await user.click(screen.getByRole('option', { name: 'Other' }));

    expect(await screen.findByLabelText('Which method?')).toBeInTheDocument();
  });
});
