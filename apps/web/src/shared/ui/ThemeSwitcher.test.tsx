import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveTheme } from '@/shared/lib';
import { renderWithProviders } from '@/test/render';

import { ThemeSwitcher } from './ThemeSwitcher';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
    // A test that fails before its own cleanup would otherwise leave a second theme-color tag
    // behind, and querySelector hands the next test the stale one.
    document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
      tag.remove();
    });
  });

  const addThemeColorMeta = (): HTMLMetaElement => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    return meta;
  };

  it('offers three states, not a two-way toggle', () => {
    renderWithProviders(<ThemeSwitcher />);

    expect(screen.getByRole('radio', { name: 'Auto' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
  });

  it('starts on auto when nothing was chosen before', () => {
    renderWithProviders(<ThemeSwitcher />);

    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    // Auto means "no override": the attribute must be absent so the media query decides.
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('writes an explicit choice to the document and to storage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitcher />);

    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('removes the override when returning to auto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitcher />);

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('theme')).toBe('auto');
  });

  it('restores the stored choice on the next visit', () => {
    localStorage.setItem('theme', 'dark');

    renderWithProviders(<ThemeSwitcher />);

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  it('keeps the status bar colour in step with the theme', async () => {
    const meta = addThemeColorMeta();
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitcher />);

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(meta.getAttribute('content')).toBe('#110d12');

    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(meta.getAttribute('content')).toBe('#fbf9fc');
  });
});

describe('resolveTheme', () => {
  /**
   * Tested at the function rather than through the switcher: on a first visit the preference
   * is already 'auto', and clicking an already-selected radio fires no change event — so the
   * component can never exercise this path. The inline script in index.html is what applies
   * it in the browser, before React exists.
   */
  it('asks the operating system when the preference is auto', () => {
    const original = globalThis.matchMedia;

    globalThis.matchMedia = (query: string) =>
      ({ matches: query.includes('dark'), media: query }) as unknown as MediaQueryList;
    expect(resolveTheme('auto')).toBe('dark');

    globalThis.matchMedia = (query: string) =>
      ({ matches: false, media: query }) as unknown as MediaQueryList;
    expect(resolveTheme('auto')).toBe('light');

    globalThis.matchMedia = original;
  });

  it('ignores the system when the user has chosen', () => {
    globalThis.matchMedia = (query: string) =>
      ({ matches: true, media: query }) as unknown as MediaQueryList;

    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});
