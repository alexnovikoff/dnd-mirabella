import { notFound } from 'next/navigation';
import { Screen } from '@/components/shell/Screen';
import { LinkRow, MonoLabel, StatusPill } from '@/components/primitives';
import { getNodeDetail } from '@/lib/queries/board';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import styles from '@/components/board/Board.module.css';

/** Куда ведут [[wiki-ссылки]] и узлы доски. */
export default async function EntityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getNodeDetail(slug);
  if (!detail) notFound();

  return (
    <Screen
      title={detail.name}
      note={detail.description ?? undefined}
      aside={
        <div className={styles.tools}>
          <MonoLabel size={10} tracking="0.08em">
            {NODE_KIND_LABEL[detail.kind]}
          </MonoLabel>
          {detail.status ? <StatusPill status={detail.status} /> : null}
        </div>
      }
    >
      <div className={styles.block}>
        <MonoLabel size={10} tracking="0.14em" block>
          {`Связи · ${detail.relations.length}`}
        </MonoLabel>
        <div className={styles.rows}>
          {detail.relations.length === 0 ? (
            <MonoLabel size={9} tracking="0.08em" tone="faint">
              Связей пока нет
            </MonoLabel>
          ) : (
            detail.relations.map((relation) => (
              <LinkRow
                key={`${relation.id}-${relation.label ?? ''}`}
                arrow
                name={relation.name}
                label={relation.label?.toUpperCase()}
                href={`/entities/${relation.slug}`}
              />
            ))
          )}
        </div>
      </div>

      <div className={styles.block}>
        <MonoLabel size={10} tracking="0.14em" block>
          Упоминания
        </MonoLabel>
        {detail.mentions.moments.length === 0 && detail.mentions.notes === 0 ? (
          <MonoLabel size={9} tracking="0.08em" tone="faint">
            Сущность ещё нигде не упомянута
          </MonoLabel>
        ) : (
          <div className={styles.rows}>
            {detail.mentions.moments.map((moment) => (
              <LinkRow
                key={moment.id}
                name={moment.title ?? 'Без заголовка'}
                label={moment.sessionNumber ? `С${moment.sessionNumber}` : undefined}
              />
            ))}
            {detail.mentions.notes > 0 ? (
              <LinkRow name="Заметки" label={String(detail.mentions.notes)} />
            ) : null}
          </div>
        )}
      </div>

      <LinkRow name="Открыть на доске связей" label="ГРАФ" href={`/board?node=${detail.slug}`} />
    </Screen>
  );
}
