import styles from './ParchmentCard.module.css';

export type ParchmentCardProps = {
  /** 'tight' — 18px 20px: сетка цитат, компактные карточки. */
  padding?: 'default' | 'tight';
  /** Ховер: тень +1px и осветление фона. Только для кликабельных карточек. */
  interactive?: boolean;
  as?: 'div' | 'article' | 'li';
  className?: string;
  children: React.ReactNode;
};

export function ParchmentCard({
  padding = 'default',
  interactive = false,
  as: Tag = 'div',
  className,
  children,
}: ParchmentCardProps) {
  const classes = [
    styles.card,
    padding === 'tight' ? styles.tight : undefined,
    interactive ? styles.interactive : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <Tag className={classes}>{children}</Tag>;
}
