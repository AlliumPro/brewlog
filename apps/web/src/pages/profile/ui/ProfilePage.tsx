import { Tabs } from 'radix-ui';
import { useEffect, useState } from 'react';

import { useGetProfileQuery, useUpdateProfileMutation } from '@/entities/profile';
import { Button, ErrorState, Skeleton, TextField, ThemeSwitcher } from '@/shared/ui';

import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const { data, isLoading, isError, refetch } = useGetProfileQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  // The field starts empty and fills in once the profile arrives; without this it would stay
  // blank over an existing name.
  useEffect(() => {
    if (data !== undefined) {
      setName(data.displayName ?? '');
    }
  }, [data]);

  if (isLoading) {
    return <Skeleton count={2} />;
  }

  if (isError || data === undefined) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Account</h1>

      <Tabs.Root defaultValue="profile">
        <Tabs.List className={styles.tabs} aria-label="Account sections">
          <Tabs.Trigger value="profile" className={styles.tab}>
            Profile
          </Tabs.Trigger>
          <Tabs.Trigger value="appearance" className={styles.tab}>
            Appearance
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="profile" className={styles.panel}>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(false);

              void updateProfile({ displayName: name.trim() === '' ? null : name.trim() })
                .unwrap()
                .then(() => {
                  setSaved(true);
                });
            }}
          >
            <TextField
              label="Name"
              value={name}
              placeholder="How the journal should greet you"
              hint="Only used inside this app. Leave it empty and the greeting drops the name."
              autoComplete="given-name"
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
            />

            <div className={styles.formActions}>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
              {/* Announced rather than shown silently: a save with no feedback reads as a
                  save that did not happen. */}
              <span className={styles.savedNote} role="status">
                {saved ? 'Saved.' : ''}
              </span>
            </div>
          </form>
        </Tabs.Content>

        <Tabs.Content value="appearance" className={styles.panel}>
          <div className={styles.setting}>
            <div>
              <p className={styles.settingName}>Theme</p>
              <p className={styles.settingHint}>
                Auto follows the setting on this device and changes with it.
              </p>
            </div>
            <ThemeSwitcher />
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
