import { MonoLabel } from './MonoLabel';
import styles from './Metric.module.css';

export function Metric({
  value,
  label,
  accent = false,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className={styles.metric}>
      <div className={accent ? `${styles.value} ${styles.accent}` : styles.value}>{value}</div>
      <MonoLabel size={9} tracking="0.1em" tone="faint" block>
        {label}
      </MonoLabel>
    </div>
  );
}
