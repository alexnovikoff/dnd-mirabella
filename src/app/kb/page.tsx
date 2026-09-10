import { Screen } from '@/components/shell/Screen';
import { FilterChips } from '@/components/primitives';
import { AddKbItemButton } from '@/components/kb/AddKbItemButton';
import { FreeNoteCard, RumorNote } from '@/components/kb/NoteCards';
import {
  getFreeNotes,
  getNodesByKind,
  getRumors,
  isKbTab,
  KB_TABS,
  mergeKbCards,
} from '@/lib/queries/kb';
import { getNodeIndex } from '@/lib/queries/chronicle';
import { getViewer } from '@/lib/viewer';
import { plural } from '@/lib/plural';
import styles from '@/components/kb/NoteCards.module.css';

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = isKbTab(tab) ? tab : 'all';
  const viewer = await getViewer();

  const [rumors, notes, npcs, locations, index] = await Promise.all([
    getRumors(),
    getFreeNotes(viewer),
    getNodesByKind('npc'),
    getNodesByKind('location'),
    getNodeIndex(),
  ]);

  const cards =
    active === 'npc'
      ? npcs
      : active === 'locations'
        ? locations
        : active === 'all'
          ? mergeKbCards(rumors, npcs, locations)
          : rumors;
  /* Свободные заметки живут только в «Заметках» и во «Всём». */
  const showNotes = active === 'all' || active === 'notes';
  const count = cards.length + (showNotes ? notes.length : 0);

  const noun =
    active === 'npc'
      ? plural(count, 'NPC', 'NPC', 'NPC')
      : active === 'locations'
        ? plural(count, 'локация', 'локации', 'локаций')
        : active === 'all'
          ? plural(count, 'элемент', 'элемента', 'элементов')
          : plural(count, 'заметка', 'заметки', 'заметок');

  /* Кнопка «+» заводит по умолчанию то, что показывает открытый таб. */
  const defaultType = active === 'npc' ? 'npc' : active === 'locations' ? 'location' : 'note';

  return (
    <Screen
      title="База знаний"
      note={`${count} ${noun}. Заметки и наводки со статусами: открыта, раскрыта, тупик.`}
      aside={
        <FilterChips
          activeId={active}
          activeStyle="solid"
          ariaLabel="Разделы базы знаний"
          items={KB_TABS.map((item) => ({
            id: item.id,
            label: item.label,
            href: item.id === 'all' ? '/kb' : `/kb?tab=${item.id}`,
          }))}
        />
      }
    >
      <div className={styles.list}>
        {cards.map((card) => (
          <RumorNote key={card.id} card={card} tab={active} />
        ))}
        {showNotes
          ? notes.map((note) => <FreeNoteCard key={note.id} note={note} index={index} />)
          : null}
        <AddKbItemButton defaultType={defaultType} />
      </div>
    </Screen>
  );
}
