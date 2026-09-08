import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default function QuotesPage() {
  return (
    <Screen title="Цитатник" note="Голосование за цитату недели.">
      <Stub stage="Этап 7">Сетка цитат, цитата недели span 2, фильтр по автору, «♦ N»</Stub>
    </Screen>
  );
}
