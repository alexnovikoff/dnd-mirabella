import { notFound } from 'next/navigation';
import { Screen } from '@/components/shell/Screen';
import { LinkRow, MonoLabel, StatusPill } from '@/components/primitives';
import { EntityEditor } from '@/components/entity/EntityEditor';
import { EntityImages } from '@/components/entity/EntityImages';
import { RelationsEditor } from '@/components/entity/RelationsEditor';
import { getBoard, getNodeDetail } from '@/lib/queries/board';
import { getLinkLabels } from '@/lib/queries/labels';
import { isKbTab } from '@/lib/queries/kb';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import styles from '@/components/board/Board.module.css';

/** Куда ведут [[wiki-ссылки]] и узлы доски. */
export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ slug }, { tab }] = await Promise.all([params, searchParams]);
  const detail = await getNodeDetail(slug);
  if (!detail) notFound();

  const [board, labels] = await Promise.all([getBoard(), getLinkLabels()]);

  /* Карточку открывают из «Базы знаний» — вернём читателя в тот же раздел
   * списка. Таб сверяем со списком: в ссылку попадает только известное
   * значение, а с доски и из [[ссылок]] его просто нет. */
  const backTab = isKbTab(tab) && tab !== 'all' ? tab : null;

  return (
    <Screen
      title={detail.name}
      note={detail.description ?? undefined}
      back={{ href: backTab ? `/kb?tab=${backTab}` : '/kb', label: 'К базе знаний' }}
      aside={
        <div className={styles.tools}>
          <MonoLabel size={10} tracking="0.08em">
            {NODE_KIND_LABEL[detail.kind]}
          </MonoLabel>
          {detail.status ? <StatusPill status={detail.status} /> : null}
        </div>
      }
    >
      <EntityEditor
        node={{
          id: detail.id,
          name: detail.name,
          kind: detail.kind,
          status: detail.status,
          description: detail.description,
          aliases: detail.aliases,
          isCharacter: detail.isCharacter,
        }}
      />

      {/* Изображения идут сразу под правкой: карточку узнают в лицо раньше,
          чем читают её связи. */}
      <div className={styles.block}>
        <MonoLabel size={10} tracking="0.14em" block>
          {`Изображения · ${detail.images.length}`}
        </MonoLabel>
        <EntityImages nodeId={detail.id} name={detail.name} images={detail.images} />
      </div>

      <div className={styles.block}>
        <MonoLabel size={10} tracking="0.14em" block>
          {`Связи · ${detail.relations.length}`}
        </MonoLabel>
        <RelationsEditor
          nodeId={detail.id}
          relations={detail.relations}
          labels={labels}
          candidates={board.nodes
            .filter((item) => item.id !== detail.id)
            .map((item) => ({ id: item.id, name: item.name, kind: item.kind }))}
        />
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
