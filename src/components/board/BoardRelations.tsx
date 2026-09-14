'use client';

import { LinkRow, MonoLabel } from '@/components/primitives';
import { useQuickEntry } from '@/components/editor/QuickEntryProvider';
import type { NodeDetail } from '@/lib/queries/board';
import { RemoveLinkButton } from './RemoveLinkButton';

/** «Связи» в панели выбранного узла. Строка ведёт к узлу на другом конце;
 *  вошедший убирает связь крестиком, не уходя на карточку сущности. Тип
 *  здесь не правится: колонке в 300px поле типа в каждой строке тесно, для
 *  этого есть окно после перетаскивания и карточка. */
export function BoardRelations({ relations }: { relations: NodeDetail['relations'] }) {
  const { canWrite } = useQuickEntry();

  if (relations.length === 0) {
    return (
      <MonoLabel size={9} tracking="0.08em" tone="faint">
        Связей пока нет
      </MonoLabel>
    );
  }

  return relations.map((relation) => (
    <LinkRow
      key={relation.linkId}
      arrow
      name={relation.name}
      label={relation.label?.toUpperCase()}
      href={`/board?node=${relation.slug}`}
      action={
        canWrite ? (
          <RemoveLinkButton linkId={relation.linkId} name={relation.name} label={relation.label} />
        ) : undefined
      }
    />
  ));
}
