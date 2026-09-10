import Link from 'next/link';
import { Screen } from '@/components/shell/Screen';
import { MonoLabel } from '@/components/primitives';
import { NewSessionButton } from '@/components/session/NewSessionButton';
import { getSessions } from '@/lib/queries/sessions';
import { getViewer } from '@/lib/viewer';
import { fullRuDate } from '@/lib/dates';
import { plural } from '@/lib/plural';
import styles from '@/components/session/Session.module.css';

/** Все сессии кампании. Сюда ведёт заголовок «Сессии» в сайдбаре хроники,
 *  где помещаются только последние пять. */
export default async function SessionsPage() {
  const viewer = await getViewer();
  const sessions = await getSessions(viewer);

  return (
    <Screen
      title="Сессии"
      note={`${sessions.length} ${plural(sessions.length, 'сессия', 'сессии', 'сессий')}. Последняя сверху.`}
      aside={<NewSessionButton />}
    >
      <div className={styles.list}>
        {sessions.map((session) => {
          /* Дата и счётчик показываются, только когда есть что показать:
           * у большинства сессий заполнен один номер и заголовок. */
          const meta = [
            session.date ? fullRuDate(session.date) : null,
            session.location,
            session.entries > 0
              ? `${session.entries} ${plural(session.entries, 'запись', 'записи', 'записей')}`
              : null,
          ].filter(Boolean);

          return (
            <Link key={session.id} href={`/sessions/${session.number}`} className={styles.listRow}>
              <MonoLabel size={11} tracking="0.08em" tone="faint" uppercase={false}>
                {`С${session.number}`}
              </MonoLabel>
              <span className={session.title ? styles.listTitle : styles.listUntitled}>
                {session.title ?? 'Без названия'}
              </span>
              {meta.length > 0 ? (
                <MonoLabel size={9} tracking="0.08em" tone="faint" uppercase={false}>
                  {meta.join(' · ')}
                </MonoLabel>
              ) : null}
            </Link>
          );
        })}
      </div>
    </Screen>
  );
}
