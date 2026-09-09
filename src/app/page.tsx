import { MonoLabel } from '@/components/primitives';
import { BoardPreview } from '@/components/chronicle/BoardPreview';
import { FeedFilters } from '@/components/chronicle/FeedFilters';
import { Hero } from '@/components/chronicle/Hero';
import { CompactMomentCard, MomentCard } from '@/components/chronicle/MomentCard';
import { QuoteEntry } from '@/components/chronicle/QuoteEntry';
import { Sidebar } from '@/components/chronicle/Sidebar';
import {
  getActiveSession,
  getBoardPreview,
  getCampaign,
  getFeed,
  getGalleryPreview,
  getNodeIndex,
  getParty,
  getRecentSessions,
  getStatusNodes,
  isFeedFilter,
} from '@/lib/queries/chronicle';
import { getViewer } from '@/lib/viewer';
import styles from './chronicle.module.css';

export default async function ChroniclePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const active = isFeedFilter(filter) ? filter : 'all';
  const viewer = await getViewer();

  const [campaign, party, feed, index, sessions, notes, gallery, board, activeSession] =
    await Promise.all([
      getCampaign(),
      getParty(),
      getFeed(active, viewer),
      getNodeIndex(),
      getRecentSessions(5),
      getStatusNodes(4),
      getGalleryPreview(5),
      getBoardPreview(),
      getActiveSession(),
    ]);

  /* Свежие записи идут полными карточками, ранние — компактными:
   * так лента держит ритм макета, а не превращается в стену. */
  const compactBelow = activeSession ? activeSession.number - 1 : 0;

  /* Право на правку считает сервер: автор либо мастер. */
  const canEdit = (authorId: string | null) =>
    viewer !== null && (viewer.role === 'dm' || authorId === viewer.id);

  return (
    <>
      <Hero
        eyebrow={campaign?.eyebrow ?? null}
        title={campaign?.title ?? ''}
        tagline={campaign?.tagline ?? null}
        party={party}
      />

      <div className={styles.grid}>
        <section className={styles.feed}>
          <div className={styles.head}>
            <h2 className={styles.title}>Яркие моменты</h2>
            <FeedFilters active={active} />
          </div>

          {feed.length === 0 ? (
            <div className={styles.empty}>
              <MonoLabel size={11} tracking="0.1em">
                Здесь пока пусто
              </MonoLabel>
              <MonoLabel size={9} tracking="0.08em" tone="faint">
                Снимите фильтр или добавьте запись
              </MonoLabel>
            </div>
          ) : (
            feed.map((entry) => {
              if (entry.kind === 'quote')
                return (
                  <QuoteEntry key={entry.id} entry={entry} canEdit={canEdit(entry.authorId)} />
                );
              const compact = (entry.sessionNumber ?? 0) < compactBelow;
              return compact ? (
                <CompactMomentCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  canEdit={canEdit(entry.authorId)}
                />
              ) : (
                <MomentCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  canEdit={canEdit(entry.authorId)}
                />
              );
            })
          )}
        </section>

        <Sidebar
          sessions={sessions}
          notes={notes}
          gallery={gallery}
          activeSessionNumber={activeSession?.number ?? null}
        />
      </div>

      <BoardPreview nodes={board.nodes} edges={board.edges} />
    </>
  );
}
