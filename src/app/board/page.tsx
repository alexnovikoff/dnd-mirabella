import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default function BoardPage() {
  return (
    <Screen title="Доска связей" note="Граф всех сущностей кампании и работа с выбранным узлом.">
      <Stub stage="Этап 8">SVG-рёбра под узлами, перетаскивание, панель выбранного узла</Stub>
    </Screen>
  );
}
