import { MonoLabel } from './MonoLabel';
import { QuoteBody } from './QuoteBody';
import styles from './AccentQuoteCard.module.css';

export type AccentQuoteCardProps = {
  /** Текст без кавычек — «ёлочки» ставит сам компонент.
   *  Несколько строк считаются диалогом и кавычками не оборачиваются. */
  quote: string;
  /** Слева в футере: «— ОГЕН, СЕССИЯ 13». */
  author?: React.ReactNode;
  /** Справа в футере: «СЕССИЯ 13». */
  meta?: React.ReactNode;
  /** Надстрочник над цитатой: «СЛУЧАЙНАЯ ЦИТАТА». */
  eyebrow?: React.ReactNode;
  className?: string;
};

export function AccentQuoteCard({ quote, author, meta, eyebrow, className }: AccentQuoteCardProps) {
  const classes = [styles.card, className].filter(Boolean).join(' ');

  return (
    <figure className={classes}>
      {eyebrow ? (
        <MonoLabel size={10} tracking="0.1em" tone="onAccentDim">
          {eyebrow}
        </MonoLabel>
      ) : null}

      <blockquote className={styles.quote}>
        <QuoteBody text={quote} />
      </blockquote>

      {author || meta ? (
        <figcaption className={styles.footer}>
          <MonoLabel size={11} tracking="0.1em" tone="onAccentDim">
            {author}
          </MonoLabel>
          {meta ? (
            <MonoLabel size={10} tracking="0.1em" tone="onAccentDim">
              {meta}
            </MonoLabel>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
