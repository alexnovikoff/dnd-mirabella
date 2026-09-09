'use client';

import { useState, useTransition } from 'react';
import { toggleVote } from '@/lib/actions/votes';
import { plural } from '@/lib/plural';
import styles from './Quotes.module.css';

/** «♦ N» — один голос на пользователя, повторный клик снимает. */
export function VoteButton({
  entryId,
  votes,
  mine,
  withNoun = false,
}: {
  entryId: string;
  votes: number;
  mine: boolean;
  withNoun?: boolean;
}) {
  const [state, setState] = useState({ votes, mine });
  const [pending, startTransition] = useTransition();

  const label = withNoun
    ? `♦ ${state.votes} ${plural(state.votes, 'голос', 'голоса', 'голосов').toUpperCase()}`
    : `♦ ${state.votes}`;

  return (
    <button
      type="button"
      className={state.mine ? `${styles.vote} ${styles.voted}` : styles.vote}
      disabled={pending}
      aria-pressed={state.mine}
      title={state.mine ? 'Снять голос' : 'Отдать голос'}
      onClick={() =>
        startTransition(async () => {
          setState(await toggleVote(entryId));
        })
      }
    >
      {label}
    </button>
  );
}
