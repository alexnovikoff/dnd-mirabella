import Image from 'next/image';
import Link from 'next/link';
import { MonoLabel } from '@/components/primitives';
import styles from './Hero.module.css';

type Member = {
  id: string;
  name: string;
  slug: string;
  race: string | null;
  classes: string | null;
  portrait: string | null;
};

export function Hero({
  eyebrow,
  title,
  tagline,
  party,
}: {
  eyebrow: string | null;
  title: string;
  tagline: string | null;
  party: Member[];
}) {
  /* Заголовок в макете разбит на две строки по словам. */
  const words = title.split(' ');

  return (
    <section className={styles.hero}>
      <div className={styles.text}>
        {eyebrow ? (
          <MonoLabel size={11} tracking="0.16em" block>
            {eyebrow}
          </MonoLabel>
        ) : null}
        <h1 className={styles.title}>
          {words.map((word, i) => (
            <span key={i}>
              {word}
              {i < words.length - 1 ? <br /> : null}
            </span>
          ))}
        </h1>
        {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
      </div>

      <div className={styles.party}>
        {party.map((member) => (
          <Link key={member.id} href={`/characters/${member.slug}`} className={styles.member}>
            {member.portrait ? (
              <Image
                src={member.portrait}
                alt=""
                width={62}
                height={62}
                className={styles.avatarImage}
              />
            ) : (
              <span className={styles.avatar} aria-hidden="true" />
            )}
            <span className={styles.name}>{member.name}</span>
            <span className={styles.role}>
              {member.race}
              {member.classes ? (
                <>
                  <br />
                  {member.classes}
                </>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
