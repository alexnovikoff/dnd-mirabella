import { Screen } from '@/components/shell/Screen';
import { FilterChips } from '@/components/primitives';
import { AddNoteButton } from '@/components/kb/AddNoteButton';
import { FreeNoteCard, RumorNote } from '@/components/kb/NoteCards';
import { getFreeNotes, getNodesByKind, getRumors, isKbTab, KB_TABS } from '@/lib/queries/kb';
import { getNodeIndex } from '@/lib/queries/chronicle';
import { STUB_USER_ID } from '@/lib/campaign';
import { plural } from '@/lib/plural';
import styles from '@/components/kb/NoteCards.module.css';

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = isKbTab(tab) ? tab : 'notes';

  const [rumors, notes, npcs, locations, index] = await Promise.all([
    getRumors(),
    getFreeNotes(STUB_USER_ID),
    getNodesByKind('npc'),
    getNodesByKind('location'),
    getNodeIndex(),
  ]);

  const cards = active === 'npc' ? npcs : active === 'locations' ? locations : rumors;
  const showNotes = active === 'notes';
  const count = cards.length + (showNotes ? notes.length : 0);

  const noun =
    active === 'npc'
      ? plural(count, 'NPC', 'NPC', 'NPC')
      : active === 'locations'
        ? plural(count, 'локация', 'локации', 'локаций')
        : plural(count, 'заметка', 'заметки', 'заметок');

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
            href: item.id === 'notes' ? '/kb' : `/kb?tab=${item.id}`,
          }))}
        />
      }
    >
      <div className={styles.list}>
        {cards.map((card) => (
          <RumorNote key={card.id} card={card} />
        ))}
        {showNotes
          ? notes.map((note) => <FreeNoteCard key={note.id} note={note} index={index} />)
          : null}
        <AddNoteButton />
      </div>
    </Screen>
  );
}
