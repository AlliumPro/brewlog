import type { ReactNode } from 'react';

import styles from './ChartFigure.module.css';

interface ChartFigureProps {
  title: string;
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  children: ReactNode;
}

/**
 * Every chart ships with the same numbers as a table behind a disclosure. An SVG of coloured
 * marks is unreadable to a screen reader and to anyone who cannot separate the hues, and
 * "look at the chart" is not an alternative.
 */
export function ChartFigure({ title, caption, columns, rows, children }: ChartFigureProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{caption}</p>
      </figcaption>

      <div className={styles.chart} role="img" aria-label={`${title}. ${caption}`}>
        {children}
      </div>

      <details className={styles.details}>
        <summary className={styles.summary}>Show the numbers</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, index) => (
                    <td key={`${columns[index] ?? String(index)}-${cell}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
