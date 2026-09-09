import styles from './Skeleton.module.css';

export function Skeleton({
  width = '100%',
  height = 16,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <div
      className={className ? `${styles.block} ${className}` : styles.block}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Заготовка карточки — используется в loading-состояниях экранов. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.stack}>
      <Skeleton width={120} height={10} />
      <Skeleton width="70%" height={28} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '55%' : '100%'} height={14} />
      ))}
    </div>
  );
}

export { styles as skeletonStyles };
