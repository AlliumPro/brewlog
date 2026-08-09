import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Mirrors --color-bg in tokens.css. The browser paints the status bar from this before any
 * stylesheet is parsed, so it cannot be read from a custom property — it has to be a literal.
 * Changing --color-bg means changing these two values as well.
 */
const BAR_COLOUR: Record<'light' | 'dark', string> = {
  light: '#fbf9fc',
  dark: '#110d12',
};

function isPreference(value: string | null): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'auto';
  } catch {
    // Private mode and blocked storage both throw; treating it as "no choice made" is right.
    return 'auto';
  }
}

/** What the preference resolves to right now — 'auto' asks the operating system. */
export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'auto') {
    return preference;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BAR_COLOUR[resolveTheme(preference)]);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readStoredTheme);

  const choose = useCallback((next: ThemePreference) => {
    setPreference(next);
    applyTheme(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; it just will not survive a reload.
    }
  }, []);

  // On 'auto' the system can change under us — at sunset, or when the user flips the setting.
  useEffect(() => {
    if (preference !== 'auto') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = (): void => {
      applyTheme('auto');
    };

    media.addEventListener('change', sync);

    return () => {
      media.removeEventListener('change', sync);
    };
  }, [preference]);

  return { preference, choose, resolved: resolveTheme(preference) };
}
