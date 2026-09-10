import Image from 'next/image';
import Link from 'next/link';
import { Screen } from '@/components/shell/Screen';
import { ImagePlaceholder, MonoLabel, ParchmentCard } from '@/components/primitives';
import { CropPortraitButton } from '@/components/character/CropPortraitButton';
import { getCharacters } from '@/lib/queries/characters';
import { parseCrop } from '@/lib/crop';
import { getViewer } from '@/lib/viewer';
import styles from '@/components/character/Party.module.css';

export default async function PartyPage() {
  const [party, viewer] = await Promise.all([getCharacters(), getViewer()]);

  return (
    <Screen title="Партия" note="Кто ведёт эту хронику">
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
                    {[character.race, character.classes].filter(Boolean).join(' · ')}
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
