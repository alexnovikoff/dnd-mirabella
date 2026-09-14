import styles from './PreviewBadge.module.css';

/* Метка «не боевой сайт» — на локальной и превью-версиях. Флаг задан в Vercel
 * для Preview и Development, в Production его нет; локально он в .env.
 * Префикс NEXT_PUBLIC_ — значение подставляется при сборке, поэтому поменять
 * флаг значит пересобрать деплой. */
export function PreviewBadge() {
  if (process.env.NEXT_PUBLIC_SHOW_PREVIEW_BADGE !== '1') return null;

  return (
    <div className={styles.badge} aria-hidden="true">
      Preview
    </div>
  );
}
