import styles from './Screen.module.css';

export type ScreenProps = {
  /** Заголовок экрана — Cormorant 42px/1. */
  title: string;
  /** Подпись под заголовком: счётчики, сроки, подсказки. */
  note?: React.ReactNode;
  /** Фильтры и тумблеры справа от заголовка. */
  aside?: React.ReactNode;
  children?: React.ReactNode;
};

export function Screen({ title, note, aside, children }: ScreenProps) {
  return (
    <section className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{title}</h1>
          {note ? <p className={styles.note}>{note}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
