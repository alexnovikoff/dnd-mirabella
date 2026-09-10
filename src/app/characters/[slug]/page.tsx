import { notFound } from 'next/navigation';
import {
  AccentQuoteCard,
  ImagePlaceholder,
  Metric,
  MonoLabel,
  ParchmentCard,
} from '@/components/primitives';
import { WikiText } from '@/components/wiki/WikiText';
import { EntryActions } from '@/components/entry/EntryActions';
import { Achievements } from '@/components/character/Achievements';
import { CharacterEditor } from '@/components/character/CharacterEditor';
import { PersonalNotes } from '@/components/character/PersonalNotes';
import { PortraitEditor } from '@/components/character/PortraitEditor';
import { RelationsEditor } from '@/components/entity/RelationsEditor';
import { getBoard } from '@/lib/queries/board';
import { getLinkLabels } from '@/lib/queries/labels';
import { getCharacter } from '@/lib/queries/characters';
import { getNodeIndex } from '@/lib/queries/chronicle';
import { getViewer } from '@/lib/viewer';
import { canEditEntry } from '@/lib/auth-shared';
import styles from '@/components/character/Character.module.css';

export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  const [character, index, board, labels] = await Promise.all([
    getCharacter(slug, viewer),
    getNodeIndex(),
    getBoard(),
    getLinkLabels(),
  ]);

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
        <PortraitEditor nodeId={character.id} name={character.name} portrait={character.portrait} />

        <div className={styles.headText}>
          <MonoLabel size={11} tracking="0.16em" block>
            {meta}
          </MonoLabel>
          <h1 className={styles.name}>{character.name}</h1>
          {character.bio ? <p className={styles.bio}>{character.bio}</p> : null}

          <div className={styles.headRow}>
            <div className={styles.metrics}>
              <Metric value={character.metrics.moments} label="МОМЕНТОВ" />
              <Metric value={character.metrics.quotes} label="ЦИТАТ" />
              <Metric value={character.metrics.links} label="СВЯЗЕЙ" />
              <Metric value={character.metrics.crits} label="КРИТА" accent />
            </div>
            <CharacterEditor
              nodeId={character.id}
              name={character.name}
              race={character.race}
              classes={character.classes}
              level={character.level}
              bio={character.bio}
              sinceSession={character.sinceSession}
            />
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
              <EntryActions
                canEdit={canEditEntry(viewer, moment)}
                entry={{
                  id: moment.id,
                  kind: moment.kind,
                  title: moment.title,
                  body: moment.body,
                  subjectId: moment.subjectId,
                  sessionId: moment.sessionId,
                  visibility: moment.visibility,
                }}
              />
            </ParchmentCard>
          ))}

          {character.quotes.map((quote) => (
            <div key={quote.id}>
              <AccentQuoteCard
                quote={quote.body ?? ''}
                author={`— ${character.name}${quote.sessionNumber ? `, сессия ${quote.sessionNumber}` : ''}`}
                meta={quote.votes > 0 ? `♦ ${quote.votes}` : undefined}
              />
              <EntryActions
                canEdit={canEditEntry(viewer, quote)}
                entry={{
                  id: quote.id,
                  kind: quote.kind,
                  title: quote.title,
                  body: quote.body,
                  subjectId: quote.subjectId,
                  sessionId: quote.sessionId,
                  visibility: quote.visibility,
                }}
              />
            </div>
          ))}
        </section>

        <aside className={styles.aside}>
          <div className={styles.block}>
            <MonoLabel size={10} tracking="0.14em" block>
              Связи
            </MonoLabel>
            <RelationsEditor
              nodeId={character.id}
              relations={character.relations}
              labels={labels}
              candidates={board.nodes
                .filter((item) => item.id !== character.id)
                .map((item) => ({ id: item.id, name: item.name, kind: item.kind }))}
            />
          </div>

          <PersonalNotes
            nodeId={character.id}
            notes={character.privateNotes.map((note) => ({ id: note.id, body: note.body }))}
          />

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

      <Achievements
        nodeId={character.id}
        name={character.name}
        achievements={character.achievements.map((achievement) => ({
          id: achievement.id,
          url: achievement.url,
          caption: achievement.caption,
          uploaderName: achievement.uploaderName,
        }))}
      />
    </>
  );
}
