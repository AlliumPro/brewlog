import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>BrewLog</h1>
        <p className={styles.subtitle}>A quiet record of what you brewed and how it tasted.</p>
      </header>

      <section className={styles.empty} aria-live="polite">
        <p className={styles.emptyText}>No brews yet.</p>
        <p className={styles.emptyHint}>The journal fills up one cup at a time.</p>
      </section>
    </main>
  );
}
