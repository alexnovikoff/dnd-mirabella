import { MonoLabel } from './MonoLabel';
import { QuoteBody } from './QuoteBody';
import styles from './AccentQuoteCard.module.css';

export type AccentQuoteCardProps = {
  /** Текст без кавычек — «ёлочки» ставит сам компонент.
   *  Несколько строк считаются диалогом и кавычками не оборачиваются. */
  quote: string;
  /** Слева в футере: «— ОГЕН, СЕССИЯ 13». */
  author?: React.ReactNode;
  /** Справа в футере: «ЦИТАТА НЕДЕЛИ · 7 ГОЛОСОВ». */
  meta?: React.ReactNode;
  /** Надстрочник над цитатой недели: «ЦИТАТА НЕДЕЛИ · СЕССИЯ 13». */
  eyebrow?: React.ReactNode;
  /** 'feature' — цитата недели: крупнее, span 2 в сетке. */
  variant?: 'default' | 'feature';
  className?: string;
};

export function AccentQuoteCard({
  quote,
  author,
  meta,
  eyebrow,
  variant = 'default',
  className,
}: AccentQuoteCardProps) {
  const classes = [styles.card, variant === 'feature' ? styles.feature : undefined, className]
    .filter(Boolean)
    .join(' ');

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
          <MonoLabel size={10} tracking="0.1em" tone="onAccentDim">
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
