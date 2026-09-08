import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default function GalleryPage() {
  return (
    <Screen
      title="Галерея"
      note="Изображения, сгруппированные по сессиям. Перетащите файлы прямо на страницу — они попадут в текущую сессию."
    >
      <Stub stage="Этап 6">Группы по сессиям, ключевой кадр 2×2, лайтбокс, загрузка</Stub>
    </Screen>
  );
}
