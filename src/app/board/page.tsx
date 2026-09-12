import Image from 'next/image';
import Link from 'next/link';
import { LinkRow, MonoLabel } from '@/components/primitives';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardToolbar, DeleteNodeButton, LinkNodeButton } from '@/components/board/BoardActions';
import { EntityEditor } from '@/components/entity/EntityEditor';
import { getBoard, getNodeDetail } from '@/lib/queries/board';
import { getLinkLabels } from '@/lib/queries/labels';
import { NODE_KIND_LABEL } from '@/lib/nodes';
import { plural } from '@/lib/plural';
import styles from '@/components/board/Board.module.css';

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}) {
  const { node } = await searchParams;
  const [board, labels] = await Promise.all([getBoard(), getLinkLabels()]);

  /* Без выбора панель пустая: снятие выделения должно снимать его, а не
   * переводить на случайный первый узел. */
  const selectedSlug = node ?? null;
  const detail = selectedSlug ? await getNodeDetail(selectedSlug) : null;

  /* В панель идёт один кадр — первый (он же самый свежий). Остальные лежат
   * на странице сущности: колонке в 300px сетка плиток не по размеру. */
  const preview = detail?.images.find((image) => image.url) ?? null;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <BoardToolbar />

        {/* Прокрутка и масштаб живут внутри самой канвы. */}
        <BoardCanvas
          nodes={board.nodes}
          edges={board.edges}
          labels={labels}
          selectedSlug={selectedSlug}
        />

        {/* <768px под графом идёт список узлов: оглавление доски, которую
            на телефоне листают пальцем. */}
        <div className={styles.list}>
          {board.nodes.map((item) => (
            <LinkRow
              key={item.id}
              name={item.name}
              label={NODE_KIND_LABEL[item.kind]}
              href={`/board?node=${item.slug}`}
            />
          ))}
        </div>
      </div>

      <aside className={styles.panel}>
        {detail ? (
          <>
            <div className={styles.block}>
              <MonoLabel size={10} tracking="0.14em" block>
                Выбранный узел
              </MonoLabel>
              <h2 className={styles.nodeName}>{detail.name}</h2>
              {detail.description ? (
                <p className={styles.description}>{detail.description}</p>
              ) : null}

              {/* Кадр стоит выше правки: узел узнают в лицо раньше, чем
                  берутся его править. */}
              {preview?.url ? (
                <div className={styles.preview}>
                  <Image
                    src={preview.url}
                    alt={preview.caption ?? detail.name}
                    fill
                    className={styles.previewPhoto}
                    sizes="(max-width: 1023px) 100vw, 300px"
                  />
                </div>
              ) : null}

              {/* Тот же редактор, что на странице сущности: название, тип,
                  статус и описание правятся не уходя с доски. */}
              <EntityEditor
                returnTo="board"
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
            </div>

            {/* «Связи», «Упоминания» и ссылка на карточку отходят от узла
                ниже — см. .panelDetails. */}
            <div className={styles.panelDetails}>
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
                        href={`/board?node=${relation.slug}`}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className={styles.block}>
                <MonoLabel size={10} tracking="0.14em" block>
                  Упоминания
                </MonoLabel>
                <p className={styles.mentions}>
                  {detail.mentions.moments.length === 0 &&
                  detail.mentions.notes === 0 &&
                  detail.mentions.images === 0
                    ? 'Узел ещё нигде не упомянут.'
                    : [
                        detail.mentions.moments.length > 0
                          ? `Моменты: ${detail.mentions.moments
                              .map((moment) =>
                                moment.sessionNumber
                                  ? `С${moment.sessionNumber} «${moment.title ?? 'без заголовка'}»`
                                  : `«${moment.title ?? 'без заголовка'}»`,
                              )
                              .join(', ')}.`
                          : null,
                        detail.mentions.notes > 0 ? `Заметки: ${detail.mentions.notes}.` : null,
                        detail.mentions.images > 0
                          ? `Изображения: ${detail.mentions.images}.`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                </p>
                <Link href={`/entities/${detail.slug}`}>
                  <MonoLabel size={9} tracking="0.08em" tone="accent">
                    Открыть страницу сущности →
                  </MonoLabel>
                </Link>
              </div>
            </div>

            <div className={styles.panelActions}>
              <LinkNodeButton
                fromNodeId={detail.id}
                labels={labels}
                candidates={board.nodes
                  .filter((item) => item.id !== detail.id)
                  .map((item) => ({ id: item.id, name: item.name, kind: item.kind }))}
              />
              <DeleteNodeButton
                nodeId={detail.id}
                name={detail.name}
                isCharacter={detail.isCharacter}
              />
            </div>
          </>
        ) : (
          <MonoLabel size={10} tracking="0.08em" tone="faint" block>
            {`На доске ${board.nodes.length} ${plural(board.nodes.length, 'узел', 'узла', 'узлов')}. Выберите один.`}
          </MonoLabel>
        )}
      </aside>
    </div>
  );
}
