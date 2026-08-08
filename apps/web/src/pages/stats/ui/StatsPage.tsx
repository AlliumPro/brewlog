import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { METHOD_LABELS } from '@/entities/brew';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui';

import { useGetStatsQuery } from '../api/statsApi';
import { ChartFigure } from './ChartFigure';
import styles from './StatsPage.module.css';

const AXIS = { stroke: 'var(--color-text-faint)', fontSize: 12 };
const GRID = 'var(--color-border)';

const MINIMUM_BREWS = 3;

export function StatsPage() {
  const { data, isLoading, isError, refetch } = useGetStatsQuery();

  if (isLoading) {
    return <Skeleton count={2} />;
  }

  if (isError || data === undefined) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (data.totalBrews < MINIMUM_BREWS) {
    return (
      <EmptyState
        title="Not enough brews yet"
        hint={`Statistics start saying something after a few entries. There ${data.totalBrews === 1 ? 'is 1 brew' : `are ${String(data.totalBrews)} brews`} so far — log at least ${String(MINIMUM_BREWS)}.`}
      />
    );
  }

  const methodRows = data.methodDistribution.map((entry) => ({
    ...entry,
    label: METHOD_LABELS[entry.method],
  }));

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Statistics</h1>

      <ChartFigure
        title="Rating over time"
        caption="Monthly average, with the number of brews behind it."
        columns={['Month', 'Average rating', 'Brews']}
        rows={data.ratingOverTime.map((point) => [
          point.month,
          point.avgRating.toFixed(2),
          String(point.count),
        ])}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.ratingOverTime}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="month" {...AXIS} />
            <YAxis domain={[1, 5]} {...AXIS} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
              }}
            />
            <Line
              type="monotone"
              dataKey="avgRating"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--color-accent)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Rating against ratio"
        caption="Every brew as a point. Clusters show which ratios reliably score well."
        columns={['Ratio', 'Rating', 'Method']}
        rows={data.ratingByRatio.map((point) => [
          `1:${point.ratio.toFixed(1)}`,
          String(point.rating),
          METHOD_LABELS[point.method],
        ])}
      >
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="ratio" type="number" name="ratio" {...AXIS} />
            <YAxis dataKey="rating" type="number" domain={[1, 5]} name="rating" {...AXIS} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
              }}
            />
            <Scatter data={data.ratingByRatio} fill="var(--color-olive)" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Brews by method"
        caption="What you actually reach for."
        columns={['Method', 'Brews']}
        rows={methodRows.map((entry) => [entry.label, String(entry.count)])}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={methodRows} layout="vertical">
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} {...AXIS} />
            <YAxis type="category" dataKey="label" width={110} {...AXIS} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
              }}
            />
            <Bar dataKey="count" fill="var(--color-accent-deep)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>

      <ChartFigure
        title="Best beans"
        caption="Average rating, counting only beans you brewed at least twice."
        columns={['Bean', 'Average rating', 'Brews']}
        rows={data.topBeans.map((bean) => [
          bean.beanName,
          bean.avgRating.toFixed(2),
          String(bean.count),
        ])}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.topBeans} layout="vertical">
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 5]} {...AXIS} />
            <YAxis type="category" dataKey="beanName" width={140} {...AXIS} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
              }}
            />
            <Bar dataKey="avgRating" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
    </div>
  );
}
