import Link from 'next/link';
import { tokenizeWiki } from '@/lib/wiki/parse';
import styles from './WikiText.module.css';

/** Текст записи с [[ссылками]]. `index` — имя/алиас в нижнем регистре → slug. */
export function WikiText({ body, index }: { body: string; index: Map<string, string> }) {
  return (
    <>
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
    </>
  );
}
