import styles from './MonoLabel.module.css';

export type MonoSize = 9 | 10 | 11;
/** Значения из README — только те, что реально встречаются в макете. */
export type MonoTracking = '0.06em' | '0.08em' | '0.1em' | '0.14em' | '0.16em';
export type MonoTone =
  'label' | 'faint' | 'muted' | 'accent' | 'disabled' | 'onAccent' | 'onAccentDim';

const SIZE: Record<MonoSize, string> = {
  9: styles.s9,
  10: styles.s10,
  11: styles.s11,
};

const TRACKING: Record<MonoTracking, string> = {
  '0.06em': styles.t006,
  '0.08em': styles.t008,
  '0.1em': styles.t010,
  '0.14em': styles.t014,
  '0.16em': styles.t016,
};

const TONE: Record<MonoTone, string | undefined> = {
  label: undefined, // цвет по умолчанию задан в .label
  faint: styles.faint,
  muted: styles.muted,
  accent: styles.accent,
  disabled: styles.disabled,
  onAccent: styles.onAccent,
  onAccentDim: styles.onAccentDim,
};

export type MonoLabelProps = {
  size?: MonoSize;
  tracking?: MonoTracking;
  tone?: MonoTone;
  /** Мета почти всегда капсом; даты и метка сессии — нет. */
  uppercase?: boolean;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function MonoLabel({
  size = 10,
  tracking = '0.08em',
  tone = 'label',
  uppercase = true,
  block = false,
  className,
  children,
}: MonoLabelProps) {
  const classes = [
    styles.label,
    SIZE[size],
    TRACKING[tracking],
    TONE[tone],
    uppercase ? styles.upper : undefined,
    block ? styles.block : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
