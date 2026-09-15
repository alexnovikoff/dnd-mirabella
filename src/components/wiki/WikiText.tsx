import Link from 'next/link';
import { tokenizeWiki } from '@/lib/wiki/parse';
import styles from './WikiText.module.css';

/** Текст записи с [[ссылками]]. `index` — имя/алиас в нижнем регистре → slug. */
export function WikiText({ body, index }: { body: string; index: Map<string, string> }) {
  /* Текст пишут в textarea, и Enter там — смысловой перенос. Обёртка держит
   * переносы сама: иначе каждому месту, где выводится запись, пришлось бы
   * помнить про white-space, а забытое склеивает строки в одну. */
  return (
    <span className={styles.text}>
      {tokenizeWiki(body).map((token, i) => {
        if (token.type === 'text') return token.value;

        const slug = index.get(token.name.toLowerCase());
        if (!slug) {
          return (
            <span key={i} className={styles.unresolved}>
              {token.label}
            </span>
          );
        }

        return (
          <Link key={i} href={`/entities/${slug}`} className={styles.link}>
            {token.label}
          </Link>
        );
      })}
    </span>
  );
}
