import Link from 'next/link';
import styles from './Screen.module.css';

/** Ссылка в строке над заголовком: возврат к списку или соседний раздел. */
export type ScreenLink = { href: string; label: string };

export type ScreenProps = {
  /** Заголовок экрана — Cormorant 42px/1. */
  title: string;
  /** Кнопка в строке заголовка, у правого края: «Править». Раскрытая
   *  форма переносится под заголовок на всю ширину. */
  action?: React.ReactNode;
  /** Мета-строка сразу под заголовком: тип и статус карточки. */
  meta?: React.ReactNode;
  /** Подпись под заголовком: счётчики, сроки, подсказки. */
  note?: React.ReactNode;
  /** Описание карточки — абзац под мета-строкой. В отличие от подписи
   *  отбит и от шапки, и от содержимого экрана. */
  description?: React.ReactNode;
  /** Фильтры и тумблеры справа от заголовка. */
  aside?: React.ReactNode;
  /** Возврат к списку, из которого открыли карточку: строка над заголовком. */
  back?: ScreenLink;
  /** Соседние разделы в той же строке. Стрелки нет: это не возврат, а переход. */
  links?: ScreenLink[];
  children?: React.ReactNode;
};

export function Screen({
  title,
  action,
  meta,
  note,
  description,
  aside,
  back,
  links,
  children,
}: ScreenProps) {
  return (
    <section className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headText}>
          {back || links?.length ? (
            <div className={styles.crumbs}>
              {back ? (
                <Link href={back.href} className={styles.back}>
                  {`← ${back.label}`}
                </Link>
              ) : null}
              {links?.map((link) => (
                <Link key={link.href} href={link.href} className={styles.back}>
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
          {action ? (
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{title}</h1>
              {action}
            </div>
          ) : (
            <h1 className={styles.title}>{title}</h1>
          )}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
          {note ? <p className={styles.note}>{note}</p> : null}
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
