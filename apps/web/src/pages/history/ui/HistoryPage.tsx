import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { BrewCard, isBrewMethod, useGetBrewsQuery } from '@/entities/brew';
import type { BrewListQuery, BrewMethod, BrewSort } from '@/shared/api';
import { Button, EmptyState, ErrorState, Skeleton } from '@/shared/ui';

import { BrewFilters } from './BrewFilters';
import styles from './HistoryPage.module.css';

const PAGE_SIZE = 20;

function queryFromParams(params: URLSearchParams, limit: number): BrewListQuery {
  const methods: BrewMethod[] = [];

  for (const value of params.getAll('method')) {
    if (isBrewMethod(value)) {
      methods.push(value);
    }
  }

  const q = params.get('q');
  const sort: BrewSort = params.get('sort') === 'rating' ? 'rating' : 'date';

  return {
    ...(methods.length > 0 ? { method: methods } : {}),
    ...(q !== null && q !== '' ? { q } : {}),
    sort,
    limit,
    offset: 0,
  };
}

export function HistoryPage() {
  const [params] = useSearchParams();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const query = queryFromParams(params, limit);
  const { data, isLoading, isError, isFetching, refetch } = useGetBrewsQuery(query);

  const hasFilters = params.getAll('method').length > 0 || (params.get('q') ?? '') !== '';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>History</h1>

      <BrewFilters />

      {isLoading && <Skeleton count={3} />}

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {data?.items.length === 0 && !hasFilters && (
        <EmptyState
          title="No brews yet."
          hint="The journal fills up one cup at a time. Log the next one and the numbers start telling you something."
          action={
            <Link to="/brews/new">
              <Button>Log a brew</Button>
            </Link>
          }
        />
      )}

      {data?.items.length === 0 && hasFilters && (
        <EmptyState
          title="Nothing matches those filters."
          hint="Try a different method, or clear the filters to see the whole journal."
        />
      )}

      {data !== undefined && data.items.length > 0 && (
        <>
          <ul className={styles.list}>
            {data.items.map((brew) => (
              <li key={brew.id}>
                <BrewCard brew={brew} />
              </li>
            ))}
          </ul>

          <p className={styles.count} aria-live="polite">
            {`Showing ${String(data.items.length)} of ${String(data.total)}`}
          </p>

          {data.items.length < data.total && (
            <Button
              variant="secondary"
              disabled={isFetching}
              onClick={() => {
                setLimit((current) => current + PAGE_SIZE);
              }}
            >
              {isFetching ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
