import type { ReactNode } from 'react';
import Link from 'next/link';
import { MonoLabel } from './MonoLabel';
import styles from './LinkRow.module.css';

export function LinkRow({
  name,
  label,
  href,
  arrow = false,
  accent = false,
  action,
}: {
  name: string;
  /** Тип отношения: ДОЛГ, ВРАЖДА, ПРОДАНА НА. */
  label?: string | null;
  href?: string;
  arrow?: boolean;
  /** README: «ТАЙНА — цветом #9a5a2e». */
  accent?: boolean;
  /** Кнопка справа, например «убрать связь». Кнопку в ссылку не вложить,
   *  поэтому строка тогда — рамка, а ссылка в ней занимает всё до кнопки. */
  action?: ReactNode;
}) {
  const content = (
    <>
      <span>
        {arrow ? '→ ' : ''}
        {name}
      </span>
      {label ? (
        <MonoLabel size={9} tracking="0.06em" tone={accent ? 'accent' : 'faint'}>
          {label}
        </MonoLabel>
      ) : null}
    </>
  );

  if (action) {
    return (
      <div className={`${styles.row} ${styles.withAction}`}>
        {href ? (
          <Link href={href} className={styles.main}>
            {content}
          </Link>
        ) : (
          <div className={styles.main}>{content}</div>
        )}
        {action}
      </div>
    );
  }

  if (!href) return <div className={styles.row}>{content}</div>;

  return (
    <Link href={href} className={styles.row}>
      {content}
    </Link>
  );
}
