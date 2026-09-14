import Image from 'next/image';
import Link from 'next/link';
import { Screen } from '@/components/shell/Screen';
import { FilterChips, ImagePlaceholder, MonoLabel, ParchmentCard } from '@/components/primitives';
import { CropPortraitButton } from '@/components/character/CropPortraitButton';
import { getCharacters } from '@/lib/queries/characters';
import { parseCrop } from '@/lib/crop';
import { getViewer } from '@/lib/viewer';
import styles from '@/components/character/Party.module.css';

export default async function PartyPage({
  searchParams,
}: {
  searchParams: Promise<{ guests?: string }>;
}) {
  /* Гостевые персонажи скрыты по умолчанию: партия — те, кто ведёт хронику.
   * Кнопка — тот же тумблер, что «Группировать по сессиям» в галерее. */
  const guests = (await searchParams).guests === '1';
  const [party, viewer] = await Promise.all([getCharacters({ guests }), getViewer()]);
  const noGuests = guests && party.every((character) => character.isPc);

  return (
    <Screen
      title="Партия"
      note={noGuests ? 'Кто ведёт эту хронику. Гостевых персонажей нет' : 'Кто ведёт эту хронику'}
      aside={
        <FilterChips
          ariaLabel="Гостевые персонажи"
          items={[
            {
              id: 'guests',
              label: 'ПОКАЗАТЬ ГОСТЕВЫХ ПЕРСОНАЖЕЙ',
              href: guests ? '/party' : '/party?guests=1',
              toggle: true,
              on: guests,
            },
          ]}
        />
      }
    >
      <div className={styles.grid}>
        {party.map((character) => {
          /* Единственное место, где показывают кадр. Не кадрировали —
           * карточка берёт портрет, как и все остальные экраны. */
          const shown = character.portraitCropUrl ?? character.portrait;

          return (
            <div key={character.id} className={styles.cell}>
              <Link href={`/characters/${character.slug}`} className={styles.cardLink}>
                <ParchmentCard interactive className={styles.card}>
                  {shown ? (
                    <div className={styles.portrait}>
                      <Image
                        src={shown}
                        alt=""
                        fill
                        className={styles.portraitImage}
                        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 25vw"
                      />
                    </div>
                  ) : (
                    <ImagePlaceholder className={styles.portrait} align="bottom" hatchStep={8} />
                  )}
                  <h2 className={styles.name}>{character.name}</h2>
                  <MonoLabel size={9} tracking="0.1em" tone="faint" block>
                    {[character.isPc ? null : 'Гость', character.race, character.classes]
                      .filter(Boolean)
                      .join(' · ')}
                  </MonoLabel>
                  {character.bio ? <p className={styles.bio}>{character.bio}</p> : null}
                </ParchmentCard>
              </Link>

              {viewer && character.portrait ? (
                <CropPortraitButton
                  nodeId={character.id}
                  name={character.name}
                  source={character.portrait}
                  crop={parseCrop(character.portraitCrop)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
