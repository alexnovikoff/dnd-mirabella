import { Skeleton, SkeletonCard } from '@/components/primitives';

export default function ScreenLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '28px 32px 34px' }}>
      <Skeleton width={260} height={42} />
      <Skeleton width={420} height={14} />
      <SkeletonCard />
      <SkeletonCard lines={2} />
    </div>
  );
}
