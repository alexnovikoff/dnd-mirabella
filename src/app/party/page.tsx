import Link from 'next/link';
import { Screen } from '@/components/shell/Screen';
import { ImagePlaceholder, MonoLabel, ParchmentCard } from '@/components/primitives';
import { getCharacters } from '@/lib/queries/characters';
import styles from '@/components/character/Party.module.css';

export default async function PartyPage() {
  const party = await getCharacters();

  return (
    <Screen title="Партия" note="Кто ведёт эту хронику.">
      <div className={styles.grid}>
        {party.map((character) => (
          <Link key={character.id} href={`/characters/${character.slug}`}>
            <ParchmentCard interactive className={styles.card}>
              <ImagePlaceholder className={styles.portrait} align="bottom" hatchStep={8} />
              <h2 className={styles.name}>{character.name}</h2>
              <MonoLabel size={9} tracking="0.1em" tone="faint" block>
                {[character.race, character.classes].filter(Boolean).join(' · ')}
              </MonoLabel>
              {character.bio ? <p className={styles.bio}>{character.bio}</p> : null}
            </ParchmentCard>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
