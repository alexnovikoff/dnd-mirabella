import { Screen } from '@/components/shell/Screen';
import { Stub } from '@/components/shell/Stub';

export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <Screen title="Страница персонажа" note={`Профиль «${slug}» со всей привязанной историей.`}>
      <Stub stage="Этап 5">Портрет, метрики, его моменты и цитаты, связи, личная заметка</Stub>
    </Screen>
  );
}
