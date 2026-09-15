import Link from 'next/link';
import { Screen } from '@/components/shell/Screen';
import { MonoLabel, ParchmentCard } from '@/components/primitives';
import { CURRENT_RELEASE, RELEASES } from '@/lib/changelog';
import { fullRuDate } from '@/lib/dates';
import styles from './about.module.css';

/** «О проекте»: что это за сайт и история версий. Сюда ведёт ссылка в подвале
 *  листа. Открыт и без входа — как всё остальное чтение. */
export default function AboutPage() {
  return (
    <Screen
      title="О проекте"
      note={`Версия ${CURRENT_RELEASE.version} · ${fullRuDate(CURRENT_RELEASE.date)}`}
    >
      <div className={styles.intro}>
        <p>
          «Слёзы Мирабеллы» — сайт кампании D&amp;D. Здесь остаётся всё, что было на играх: яркие
          моменты, цитаты, кадры, заметки о мире и связи между теми, кого встретила партия.
        </p>
        <p>
          Главное здесь — [[ссылки]]. Имя в двойных квадратных скобках в записи или пересказе сессии
          связывает текст с персонажем, местом или фракцией, и из этих связей складывается{' '}
          <Link href="/board">«Доска связей»</Link>.
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

        {RELEASES.map((release) => (
          <ParchmentCard key={release.version} as="article" className={styles.release}>
            <header className={styles.releaseHead}>
              <h3 className={styles.releaseTitle}>{release.title}</h3>
              <MonoLabel size={10} tracking="0.08em" tone="faint" uppercase={false}>
                {`v${release.version} · ${fullRuDate(release.date)}`}
              </MonoLabel>
            </header>

            <div className={styles.groups}>
              {release.groups.map((group) => (
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
          </ParchmentCard>
        ))}
      </section>
    </Screen>
  );
}
