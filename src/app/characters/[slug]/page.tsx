import { notFound } from 'next/navigation';
import {
  AccentQuoteCard,
  ImagePlaceholder,
  LinkRow,
  Metric,
  MonoLabel,
  ParchmentCard,
} from '@/components/primitives';
import { WikiText } from '@/components/wiki/WikiText';
import { getCharacter } from '@/lib/queries/characters';
import { getNodeIndex } from '@/lib/queries/chronicle';
import { STUB_USER_ID } from '@/lib/campaign';
import styles from '@/components/character/Character.module.css';

export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [character, index] = await Promise.all([getCharacter(slug, STUB_USER_ID), getNodeIndex()]);

  if (!character) notFound();

  const meta = [
    character.race,
    character.classes && character.level
      ? `${character.classes} ${character.level}`
      : character.classes,
    character.sinceSession ? `играет с сессии ${character.sinceSession}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <header className={styles.header}>
        <ImagePlaceholder
          caption={character.portrait ? undefined : 'Портрет 190×240'}
          align="bottom"
          className={styles.portrait}
        />

        <div className={styles.headText}>
          <MonoLabel size={11} tracking="0.16em" block>
            {meta}
          </MonoLabel>
          <h1 className={styles.name}>{character.name}</h1>
          {character.bio ? <p className={styles.bio}>{character.bio}</p> : null}

          <div className={styles.metrics}>
            <Metric value={character.metrics.moments} label="МОМЕНТОВ" />
            <Metric value={character.metrics.quotes} label="ЦИТАТ" />
            <Metric value={character.metrics.links} label="СВЯЗЕЙ" />
            <Metric value={character.metrics.crits} label="КРИТА" accent />
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <section className={styles.entries}>
          <h2 className={styles.sectionTitle}>Моменты</h2>

          {character.moments.length === 0 && character.quotes.length === 0 ? (
            <MonoLabel size={10} tracking="0.08em" tone="faint" block>
              Записей об этом персонаже пока нет
            </MonoLabel>
          ) : null}

          {character.moments.map((moment) => (
            <ParchmentCard key={moment.id} as="article" padding="tight">
              <MonoLabel size={10} tracking="0.06em" tone="faint">
                {[
                  moment.sessionNumber ? `Сессия ${moment.sessionNumber}` : null,
                  moment.isCrit ? `Крит ${moment.roll ?? 20}` : null,
                  moment.isFail ? `Провал ${moment.roll ?? 1}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </MonoLabel>
              {moment.title ? <h3 className={styles.momentTitle}>{moment.title}</h3> : null}
              {moment.body ? (
                <p className={styles.momentBody}>
                  <WikiText body={moment.body} index={index} />
                </p>
              ) : null}
            </ParchmentCard>
          ))}

          {character.quotes.map((quote) => (
            <AccentQuoteCard
              key={quote.id}
              quote={quote.body ?? ''}
              author={`— ${character.name}${quote.sessionNumber ? `, сессия ${quote.sessionNumber}` : ''}`}
              meta={quote.votes > 0 ? `♦ ${quote.votes}` : undefined}
            />
          ))}
        </section>

        <aside className={styles.aside}>
          <div className={styles.block}>
            <MonoLabel size={10} tracking="0.14em" block>
              Связи
            </MonoLabel>
            <div className={styles.rows}>
              {character.relations.length === 0 ? (
                <MonoLabel size={9} tracking="0.08em" tone="faint">
                  Связей пока нет
                </MonoLabel>
              ) : (
                character.relations.map((relation) => (
                  <LinkRow
                    key={`${relation.id}-${relation.label ?? ''}`}
                    name={relation.name}
                    label={relation.label?.toUpperCase()}
                    href={`/entities/${relation.slug}`}
                    accent={relation.label?.toLowerCase() === 'тайна'}
                  />
                ))
              )}
            </div>
          </div>

          {/* README: видна только владельцу и мастеру. До этапа 9 «владелец» —
              захардкоженный пользователь, фильтрация уже в запросе. */}
          {character.privateNotes.length > 0 ? (
            <div className={styles.block}>
              <MonoLabel size={10} tracking="0.14em" block>
                Личная заметка
              </MonoLabel>
              {character.privateNotes.map((note) => (
                <div key={note.id} className={styles.privateNote}>
                  {note.body ? <WikiText body={note.body} index={index} /> : null}
                  <MonoLabel size={9} tracking="0.06em" block>
                    Видно только игроку
                  </MonoLabel>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.block}>
            <MonoLabel size={10} tracking="0.14em" block>
              {`Галерея · ${character.images.length}`}
            </MonoLabel>
            <div className={styles.grid3}>
              {character.images.slice(0, 6).map((image) => (
                <ImagePlaceholder key={image.id} hatchStep={6} className={styles.cell} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
