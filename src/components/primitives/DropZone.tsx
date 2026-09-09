import styles from './DropZone.module.css';

export type DropZoneProps = {
  /** «БРОСЬТЕ ФАЙЛЫ СЮДА · ГРУППА «СЕССИЯ 14»» или «DROP IMG». */
  label: string;
  /** 'cell' — ячейка сетки в сайдбаре, 'band' — полоса на экране «Галерея». */
  variant?: 'cell' | 'band';
  /** Подсветка при dragover; обработчики вешает вызывающий экран. */
  active?: boolean;
  className?: string;
};

export function DropZone({ label, variant = 'band', active = false, className }: DropZoneProps) {
  const classes = [
    styles.zone,
    variant === 'cell' ? styles.cell : styles.band,
    active ? styles.active : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {variant === 'band' ? (
        <span className={styles.plus} aria-hidden="true">
          +
        </span>
      ) : null}
      {label}
    </div>
  );
}
