import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Screen } from '@/components/shell/Screen';
import {
  AccentQuoteCard,
  ImagePlaceholder,
  Metric,
  MonoLabel,
  ParchmentCard,
} from '@/components/primitives';
import { EntryActions } from '@/components/entry/EntryActions';
import { SessionEditor } from '@/components/session/SessionEditor';
import { WikiText } from '@/components/wiki/WikiText';
import { getSession } from '@/lib/queries/sessions';
import { getNodeIndex } from '@/lib/queries/chronicle';
import { getViewer } from '@/lib/viewer';
import { numericDate } from '@/lib/dates';
import { plural } from '@/lib/plural';
import styles from '@/components/session/Session.module.css';

export default async function SessionPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const parsed = Number(number);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();

  const viewer = await getViewer();
  const [session, index] = await Promise.all([getSession(parsed, viewer), getNodeIndex()]);
  if (!session) notFound();

  const canEdit = (authorId: string | null) =>
    viewer !== null && (viewer.role === 'dm' || authorId === viewer.id);

  const moments = session.entries.filter((entry) => entry.kind === 'moment');
  const quotes = session.entries.filter((entry) => entry.kind === 'quote');
  const notes = session.entries.filter((entry) => entry.kind === 'note');

  return (
    <Screen
      title={
        session.title ? `Сессия ${session.number} — ${session.title}` : `Сессия ${session.number}`
      }
      /* Даты может не быть — тогда подписи под заголовком нет вовсе,
         а не прочерк, которым numericDate заполняет пустую ячейку списка. */
      note={
        [session.date ? numericDate(session.date) : null, session.location]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      aside={
        <div className={styles.nav}>
          {session.previous ? (
            <Link href={`/sessions/${session.previous}`} className={styles.navLink}>
              ← С{session.previous}
            </Link>
          ) : null}
          {session.next ? (
            <Link href={`/sessions/${session.next}`} className={styles.navLink}>
              С{session.next} →
            </Link>
          ) : null}
        </div>
      }
    >
      <div className={styles.header}>
        <div className={styles.nav}>
          <Metric value={moments.length} label="МОМЕНТОВ" />
          <Metric value={quotes.length} label="ЦИТАТ" />
          <Metric value={notes.length} label="ЗАМЕТОК" />
          <Metric value={session.images.length} label="КАДРОВ" />
        </div>
        <SessionEditor
          number={session.number}
          title={session.title}
          date={session.date}
          location={session.location}
        />
      </div>

      {session.entries.length === 0 ? (
        <MonoLabel size={10} tracking="0.08em" tone="faint" block>
          За эту сессию ещё ничего не записано
        </MonoLabel>
      ) : null}

      {moments.map((entry) => (
        <ParchmentCard key={entry.id} as="article" padding="tight">
          <MonoLabel size={10} tracking="0.06em" tone="faint">
            {[
              entry.authorName,
              entry.isCrit ? `Крит ${entry.roll ?? 20}` : null,
              entry.isFail ? `Провал ${entry.roll ?? 1}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </MonoLabel>
          {entry.title ? <h3 className={styles.entryTitle}>{entry.title}</h3> : null}
          {entry.body ? (
            <p className={styles.entryBody}>
              <WikiText body={entry.body} index={index} />
            </p>
          ) : null}
          <EntryActions
            canEdit={canEdit(entry.authorId)}
            entry={{
              id: entry.id,
              kind: entry.kind,
              title: entry.title,
              body: entry.body,
              subjectId: entry.subjectId,
              visibility: entry.visibility,
            }}
          />
        </ParchmentCard>
      ))}

      {quotes.map((entry) => (
        <div key={entry.id}>
          <AccentQuoteCard quote={entry.body ?? ''} author={`— ${entry.authorName ?? ''}`} />
          <EntryActions
            canEdit={canEdit(entry.authorId)}
            entry={{
              id: entry.id,
              kind: entry.kind,
              title: entry.title,
              body: entry.body,
              subjectId: entry.subjectId,
              visibility: entry.visibility,
            }}
          />
        </div>
      ))}

      {notes.map((entry) => (
        <ParchmentCard key={entry.id} as="article" padding="tight">
          <MonoLabel
            size={9}
            tracking="0.08em"
            tone={entry.visibility === 'private' ? 'accent' : 'label'}
          >
            {`${entry.visibility === 'private' ? 'Личная заметка' : 'Заметка'} · ${entry.authorName ?? ''}`}
          </MonoLabel>
          {entry.body ? (
            <p className={styles.entryBody}>
              <WikiText body={entry.body} index={index} />
            </p>
          ) : null}
          <EntryActions
            canEdit={canEdit(entry.authorId)}
            entry={{
              id: entry.id,
              kind: entry.kind,
              title: entry.title,
              body: entry.body,
              subjectId: entry.subjectId,
              visibility: entry.visibility,
            }}
          />
        </ParchmentCard>
      ))}

      {session.images.length > 0 ? (
        <>
          <MonoLabel size={10} tracking="0.14em" block>
            {`Кадры · ${session.images.length} ${plural(session.images.length, 'штука', 'штуки', 'штук')}`}
          </MonoLabel>
          <div className={styles.grid}>
            {session.images.map((image) => (
              <ImagePlaceholder key={image.id} hatchStep={6} className={styles.cell} />
            ))}
          </div>
        </>
      ) : null}
    </Screen>
  );
}
