import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { METHOD_OPTIONS } from '@/entities/brew';
import type { BrewMethod, BrewSort } from '@/shared/api';
import { useDebouncedValue } from '@/shared/lib';
import { Button } from '@/shared/ui';

import styles from './BrewFilters.module.css';

/**
 * Filter state lives in the URL, not in component state: a filtered view survives a reload,
 * can be bookmarked, and the back button behaves the way the user expects.
 */
export function BrewFilters() {
  const [params, setParams] = useSearchParams();
  const activeMethods = params.getAll('method');
  const sort = (params.get('sort') ?? 'date') as BrewSort;

  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (debouncedSearch === '') {
          next.delete('q');
        } else {
          next.set('q', debouncedSearch);
        }

        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, setParams]);

  const toggleMethod = (method: BrewMethod): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      const selected = next.getAll('method');

      next.delete('method');

      for (const value of selected.includes(method)
        ? selected.filter((item) => item !== method)
        : [...selected, method]) {
        next.append('method', value);
      }

      return next;
    });
  };

  const hasFilters = activeMethods.length > 0 || search !== '';

  return (
    <section className={styles.filters} aria-label="Filter brews">
      <div className={styles.row}>
        <label className={styles.searchLabel} htmlFor="brew-search">
          Search
        </label>
        <input
          id="brew-search"
          type="search"
          className={styles.search}
          placeholder="Bean or roaster"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />

        <label className={styles.searchLabel} htmlFor="brew-sort">
          Sort
        </label>
        <select
          id="brew-sort"
          className={styles.sort}
          value={sort}
          onChange={(event) => {
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set('sort', event.target.value);
              return next;
            });
          }}
        >
          <option value="date">Newest first</option>
          <option value="rating">Best rated</option>
        </select>
      </div>

      <div className={styles.chips}>
        {METHOD_OPTIONS.map((option) => {
          const active = activeMethods.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              className={active ? styles.chipActive : styles.chip}
              aria-pressed={active}
              onClick={() => {
                toggleMethod(option.value);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch('');
            setParams(new URLSearchParams());
          }}
        >
          Clear filters
        </Button>
      )}
    </section>
  );
}
