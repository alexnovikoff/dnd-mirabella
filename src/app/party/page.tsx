import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default function PartyPage() {
  return (
    <Screen title="Партия" note="Аэлис, Джаду, Метель, Оген — и всё, что за ними тянется.">
      <Stub stage="Этап 5">Карточки персонажей со ссылками на /characters/:slug</Stub>
    </Screen>
  );
}
