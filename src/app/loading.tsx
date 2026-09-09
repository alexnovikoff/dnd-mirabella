import { Skeleton, SkeletonCard } from '@/components/primitives';
import styles from './chronicle.module.css';

export default function ChronicleLoading() {
  return (
    <>
      <div style={{ padding: '30px 32px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width={220} height={11} />
        <Skeleton width={320} height={100} />
        <Skeleton width={420} height={16} />
      </div>

      <div className={styles.grid}>
        <section className={styles.feed}>
          <SkeletonCard />
          <SkeletonCard lines={2} />
        </section>
        <aside style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton width={90} height={10} />
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} />
        </aside>
      </div>
    </>
  );
}
