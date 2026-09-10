import { Screen } from '@/components/shell/Screen';
import { FilterChips } from '@/components/primitives';
import { GalleryBoard } from '@/components/gallery/GalleryBoard';
import { GALLERY_FILTERS, getGallery, isGalleryFilter } from '@/lib/queries/gallery';
import { getActiveSession } from '@/lib/queries/chronicle';
import { plural } from '@/lib/plural';
import { getViewer } from '@/lib/viewer';

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; group?: string }>;
}) {
  const { kind, group } = await searchParams;
  const filter = isGalleryFilter(kind) ? kind : 'all';
  /* Группировка включена по умолчанию — README «Галерея». */
  const grouped = group !== 'date';

  const [gallery, session, viewer] = await Promise.all([
    getGallery(filter, grouped),
    getActiveSession(),
    getViewer(),
  ]);

  const query = (next: { kind?: string; group?: string }) => {
    const params = new URLSearchParams();
    const nextKind = next.kind ?? filter;
    const nextGroup = next.group ?? (grouped ? 'session' : 'date');
    if (nextKind !== 'all') params.set('kind', nextKind);
    if (nextGroup === 'date') params.set('group', 'date');
    const search = params.toString();
    return search ? `/gallery?${search}` : '/gallery';
  };

  return (
    <Screen
      title="Галерея"
      note={`${gallery.total} ${plural(gallery.total, 'изображение', 'изображения', 'изображений')}.${viewer ? ' Перетащите файлы прямо на страницу — группу выбирают над полосой загрузки.' : ''}`}
      aside={
        <FilterChips
          activeId={filter}
          ariaLabel="Фильтр галереи"
          items={[
            ...GALLERY_FILTERS.map((item) => ({
              id: item.id,
              label: item.label,
              href: query({ kind: item.id }),
            })),
            {
              id: 'group',
              label: 'ГРУППИРОВАТЬ ПО СЕССИЯМ',
              href: query({ group: grouped ? 'date' : 'session' }),
              toggle: true,
              on: grouped,
            },
          ]}
        />
      }
    >
      <GalleryBoard
        groups={gallery.groups}
        grouped={grouped}
        sessionLabel={session ? `Сессия ${session.number}` : null}
      />
    </Screen>
  );
}
