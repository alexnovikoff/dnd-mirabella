import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default async function EntityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <Screen title="Сущность" note={`Страница «${slug}»: описание, связи и упоминания.`}>
      <Stub stage="Этап 5">Куда ведут [[wiki-ссылки]] и узлы доски связей</Stub>
    </Screen>
  );
}
