import { MonoLabel } from './MonoLabel';
import styles from './ImagePlaceholder.module.css';

export type ImagePlaceholderProps = {
  /** Что за картинка тут ожидается: «СКРИНШОТ ИЛИ АРТ СЦЕНЫ». */
  caption?: string;
  /** 'center' — блок в карточке момента, 'bottom' — плитка галереи. */
  align?: 'center' | 'bottom';
  /** 'coarse' — крупная штриховка плиток галереи (8/16). */
  hatch?: 'fine' | 'coarse';
  height?: number | string;
  minHeight?: number | string;
  bordered?: boolean;
  className?: string;
};

export function ImagePlaceholder({
  caption,
  align = 'center',
  hatch = 'fine',
  height,
  minHeight,
  bordered = true,
  className,
}: ImagePlaceholderProps) {
  const classes = [
    styles.box,
    bordered ? styles.bordered : undefined,
    hatch === 'coarse' ? styles.coarse : undefined,
    align === 'bottom' ? styles.bottom : styles.center,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ height, minHeight }} role="presentation">
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
