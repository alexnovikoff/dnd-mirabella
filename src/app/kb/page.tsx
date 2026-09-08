import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default function KnowledgeBasePage() {
  return (
    <Screen title="База знаний" note="Заметки и наводки со статусами: открыта, раскрыта, тупик.">
      <Stub stage="Этап 5">Подтабы Заметки / NPC / Локации, карточки со статусами и чипами</Stub>
    </Screen>
  );
}
