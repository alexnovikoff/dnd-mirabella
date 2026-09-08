import { MonoLabel } from '@/components/primitives';
import styles from './Stub.module.css';

/** Заглушка маршрута до того, как экран собран. */
export function Stub({ stage, children }: { stage: string; children: React.ReactNode }) {
  return (
    <div className={styles.stub}>
      <MonoLabel size={11} tracking="0.1em">
        {children}
      </MonoLabel>
      <MonoLabel size={9} tracking="0.08em" tone="faint" className={styles.stage}>
        {stage}
      </MonoLabel>
    </div>
  );
}
