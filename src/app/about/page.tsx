import Link from 'next/link';
import { Screen } from '@/components/shell/Screen';
import { MonoLabel, ParchmentCard } from '@/components/primitives';
import { CURRENT_RELEASE, RELEASES, UNRELEASED, type ChangeGroup } from '@/lib/changelog';
import { fullRuDate } from '@/lib/dates';
import styles from './about.module.css';

/** Карточка истории: заголовок, справа мета, внутри группы изменений. Свёрнута
 *  и развёрнута нативным <details>: клавиатура и клик по заголовку работают без
 *  клиентского кода, и на первой отрисовке всё уже открыто. */
function HistoryCard({
  title,
  meta,
  groups,
}: {
  title: string;
  meta: React.ReactNode;
  groups: readonly ChangeGroup[];
}) {
  return (
    <ParchmentCard as="article" className={styles.release}>
      <details open>
        <summary className={styles.releaseHead}>
          <h3 className={styles.releaseTitle}>{title}</h3>
          {meta}
        </summary>

        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.title} className={styles.group}>
              <h4 className={styles.groupTitle}>{group.title}</h4>
              <ul className={styles.items}>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </ParchmentCard>
  );
}

/** «О проекте»: что это за сайт и история версий. Сюда ведёт ссылка в правом
 *  нижнем углу окна. Открыт и без входа — как всё остальное чтение. */
export default function AboutPage() {
  return (
    <Screen
      title="О проекте"
      note={
        <span className={styles.version}>
          {`Версия ${CURRENT_RELEASE.version} · ${fullRuDate(CURRENT_RELEASE.date)}`}
        </span>
      }
    >
      <div className={styles.intro}>
        <p>
          Это сайт D&amp;D-кампании «Слёзы Мирабеллы». Здесь ведутся заметки о том, что было на
          играх: яркие моменты, цитаты, кадры, записи о мире и связи между теми, кого встретила
          партия.
        </p>
        <p>
          Важная часть функционала — [[ссылки]]. Имя в двойных квадратных скобках в записи или
          пересказе сессии связывает текст с персонажем, местом или фракцией, и из этих связей
          складывается <Link href="/board">«Доска связей»</Link>.
        </p>
        <p>
          Читать сайт можно без входа. Участники входят со своим паролем, пишут и правят общие
          записи наравне с мастером; личную заметку видят только её автор и мастер.
        </p>
      </div>

      <section className={styles.history} aria-labelledby="history-title">
        <h2 id="history-title" className={styles.sectionTitle}>
          История версий
        </h2>

        {/* Свежие правки — своей карточкой над версиями: на сайте они уже есть,
            а номер получат при следующем выпуске. */}
        {UNRELEASED.length > 0 && (
          <HistoryCard
            title={`Новое после ${CURRENT_RELEASE.version}`}
            meta={
              <MonoLabel size={10} tracking="0.08em" tone="accent">
                Уже на сайте
              </MonoLabel>
            }
            groups={UNRELEASED}
          />
        )}

        {RELEASES.map((release) => (
          <HistoryCard
            key={release.version}
            title={release.title}
            meta={
              <MonoLabel size={10} tracking="0.08em" tone="faint" uppercase={false}>
                {`v${release.version} · ${fullRuDate(release.date)}`}
              </MonoLabel>
            }
            groups={release.groups}
          />
        ))}
      </section>
    </Screen>
  );
}
