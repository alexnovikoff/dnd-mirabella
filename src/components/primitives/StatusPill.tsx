import { MonoLabel } from './MonoLabel';
import { plural } from '@/lib/plural';

/** Статусы заметок и наводок — README «ЗАМЕТКИ» и «Доска связей». */
export type Status = 'open' | 'resolved' | 'dead_end';

export const STATUS_META: Record<
  Status,
  {
    label: string;
    /** Цвет полосы и подписи. */
    color: string;
    /** Фон карточки; у тупика он приглушён. */
    background: string;
    /** Цвет текста карточки; у тупика ещё и line-through. */
    ink: string;
    struck: boolean;
  }
> = {
  open: {
    label: 'ОТКРЫТА',
    color: 'var(--status-open)',
    background: 'var(--card)',
    ink: 'var(--ink-body-2)',
    struck: false,
  },
  resolved: {
    label: 'РАСКРЫТА',
    color: 'var(--status-done)',
    background: 'var(--card-2)',
    ink: 'var(--ink-muted-2)',
    struck: false,
  },
  dead_end: {
    label: 'ТУПИК',
    color: 'var(--status-dead)',
    background: 'var(--card-2)',
    ink: 'var(--ink-disabled)',
    struck: true,
  },
};

export type StatusPillProps = {
  status: Status;
  /** Счётчик связей: «ОТКРЫТА · 3 СВЯЗИ». */
  links?: number;
  className?: string;
};

/** Подпись статуса: mono 9px, letter-spacing 0.08em, цветом полосы. */
export function StatusPill({ status, links, className }: StatusPillProps) {
  const meta = STATUS_META[status];
  const text =
    links === undefined
      ? meta.label
      : `${meta.label} · ${links} ${plural(links, 'связь', 'связи', 'связей').toUpperCase()}`;

  return (
    <MonoLabel size={9} tracking="0.08em" className={className}>
      <span style={{ color: meta.color }}>{text}</span>
    </MonoLabel>
  );
}
