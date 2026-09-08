import { MonoLabel } from './MonoLabel';
import styles from './ImagePlaceholder.module.css';

export type ImagePlaceholderProps = {
  /** Что за картинка тут ожидается: «СКРИНШОТ ИЛИ АРТ СЦЕНЫ». */
  caption?: string;
  /** 'center' — блок в карточке момента, 'bottom' — плитка галереи. */
  align?: 'center' | 'bottom';
  /** Шаг штриховки в px. README — 7; прототип использует 5, 6 и 8. */
  hatchStep?: number;
  height?: number | string;
  minHeight?: number | string;
  bordered?: boolean;
  className?: string;
};

export function ImagePlaceholder({
  caption,
  align = 'center',
  hatchStep,
  height,
  minHeight,
  bordered = true,
  className,
}: ImagePlaceholderProps) {
  const classes = [
    styles.box,
    bordered ? styles.bordered : undefined,
    align === 'bottom' ? styles.bottom : styles.center,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={
        {
          height,
          minHeight,
          ...(hatchStep ? { '--hatch-step': `${hatchStep}px` } : {}),
        } as React.CSSProperties
      }
      role="presentation"
    >
      {caption ? (
        align === 'bottom' ? (
          <MonoLabel size={9} tracking="0.06em" tone="faint">
            {caption}
          </MonoLabel>
        ) : (
          <MonoLabel size={11} tracking="0.1em">
            {caption}
          </MonoLabel>
        )
      ) : null}
    </div>
  );
}
