import { Fragment } from 'react';

/**
 * Текст цитаты. Одна строка берётся в «ёлочки»; диалог из нескольких строк —
 * нет: в русской типографике реплики с именами говорящих в кавычки не
 * заключают, а перенос строки в них смысловой.
 */
export function QuoteBody({ text }: { text: string }) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;
  if (lines.length === 1) return <>«{lines[0]}»</>;

  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </>
  );
}
