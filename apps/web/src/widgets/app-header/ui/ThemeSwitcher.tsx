import { RadioGroup } from 'radix-ui';

import { useTheme } from '@/shared/lib';
import type { ThemePreference } from '@/shared/lib';

import styles from './ThemeSwitcher.module.css';

/**
 * Three states rather than a two-way toggle. Someone who picked "dark" by hand does not
 * expect it to switch itself back at sunrise, and someone on "auto" does expect exactly that —
 * a toggle cannot express both.
 */
const OPTIONS: { value: ThemePreference; label: string; title: string }[] = [
  { value: 'auto', label: 'Auto', title: 'Follow the system setting' },
  { value: 'light', label: 'Light', title: 'Always light' },
  { value: 'dark', label: 'Dark', title: 'Always dark' },
];

export function ThemeSwitcher() {
  const { preference, choose } = useTheme();

  return (
    <RadioGroup.Root
      className={styles.group}
      value={preference}
      aria-label="Colour theme"
      onValueChange={(next) => {
        choose(next as ThemePreference);
      }}
    >
      {OPTIONS.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          className={styles.option}
          title={option.title}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
