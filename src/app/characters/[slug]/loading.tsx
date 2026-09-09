import { Skeleton, SkeletonCard } from '@/components/primitives';

export default function CharacterLoading() {
  return (
    <div style={{ display: 'flex', gap: 28, padding: '30px 32px' }}>
      <Skeleton width={190} height={240} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <Skeleton width={280} height={11} />
        <Skeleton width={220} height={52} />
        <Skeleton width="80%" height={16} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
