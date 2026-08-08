import { Link } from 'react-router';

import type { Brew } from '@/shared/api';
import { formatBrewTime, formatDate, formatRatio } from '@/shared/lib';
import { HeroValue, Rating } from '@/shared/ui';

import { methodLabel } from '../model/methods';
import styles from './BrewCard.module.css';

interface BrewCardProps {
  brew: Brew;
}

/**
 * The ratio is the headline, as the brief asks — it is the number that actually explains why
 * a cup tasted the way it did. The whole card is one link target so it is reachable in a
 * single tab stop.
 */
export function BrewCard({ brew }: BrewCardProps) {
  return (
    <article className={styles.card}>
      <Link to={`/brews/${brew.id}`} className={styles.link}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.bean}>{brew.beanName}</h2>
            <p className={styles.meta}>
              {methodLabel(brew.method, brew.methodOther)}
              {brew.roaster !== null && <span className={styles.separator}>·</span>}
              {brew.roaster}
            </p>
          </div>
          <Rating value={brew.rating} />
        </div>

        <div className={styles.numbers}>
          <HeroValue label="ratio" value={formatRatio(brew.ratio)} />
          <HeroValue label="time" value={formatBrewTime(brew.brewTimeSeconds)} />
          <HeroValue label="brewed" value={formatDate(brew.brewedAt)} />
        </div>
      </Link>
    </article>
  );
}
