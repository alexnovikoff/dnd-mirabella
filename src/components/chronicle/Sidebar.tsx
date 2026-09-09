import Link from 'next/link';
import { NewSessionButton } from '@/components/session/NewSessionButton';
import {
  DropZone,
  ImagePlaceholder,
  MonoLabel,
  STATUS_META,
  StatusPill,
} from '@/components/primitives';
import type { NodeStatus } from '@/lib/db/schema';
import { numericDate } from '@/lib/dates';
import styles from './Sidebar.module.css';

type SessionRow = { id: string; number: number; title: string | null; date: string | null };
type StatusNode = {
  id: string;
  name: string;
  slug: string;
  status: NodeStatus | null;
  links: number;
};
type GalleryPreview = { total: number; recent: { id: string; caption: string | null }[] };

export function Sidebar({
  sessions,
  notes,
  gallery,
  activeSessionNumber,
}: {
  sessions: SessionRow[];
  notes: StatusNode[];
  gallery: GalleryPreview;
  activeSessionNumber: number | null;
}) {
  return (
    <aside className={styles.aside}>
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <MonoLabel size={10} tracking="0.14em" block>
            Сессии
          </MonoLabel>
          <NewSessionButton />
        </div>
        <div>
          {sessions.map((session) => {
            const past = session.number !== activeSessionNumber;
            return (
              <Link
                key={session.id}
                href={`/sessions/${session.number}`}
                className={past ? `${styles.sessionRow} ${styles.sessionPast}` : styles.sessionRow}
              >
                <span>
                  {session.number}
                  {session.title ? ` · ${session.title}` : ''}
                </span>
                <MonoLabel size={11} tracking="0.06em" tone="faint" uppercase={false}>
                  {numericDate(session.date)}
                </MonoLabel>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.block}>
        <MonoLabel size={10} tracking="0.14em" block>
          Заметки
        </MonoLabel>
        <div className={styles.notes}>
          {notes.map((note) => {
            const meta = note.status ? STATUS_META[note.status] : null;
            return (
              <Link
                key={note.id}
                href={`/entities/${note.slug}`}
                className={styles.note}
                style={
                  {
                    '--note-color': meta?.color ?? 'var(--rule)',
                    '--note-ink': meta?.ink ?? 'var(--ink-body-2)',
                    background: meta?.background ?? 'var(--card)',
                  } as React.CSSProperties
                }
              >
                <span
                  className={
                    meta?.struck ? `${styles.noteTitle} ${styles.noteStruck}` : styles.noteTitle
                  }
                >
                  {note.name}
                </span>
                {note.status ? <StatusPill status={note.status} links={note.links} /> : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.block}>
        <MonoLabel size={10} tracking="0.14em" block>
          {`Галерея · ${gallery.total}`}
        </MonoLabel>
        <div className={styles.grid}>
          {gallery.recent.map((image) => (
            <ImagePlaceholder key={image.id} hatchStep={6} className={styles.cell} />
          ))}
          <DropZone variant="cell" label="Drop img" />
        </div>
      </section>
    </aside>
  );
}
