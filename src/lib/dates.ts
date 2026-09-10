const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сент',
  'окт',
  'нояб',
  'дек',
];

/** «6 сент» — метка сессии в шапке. */
export function shortRuDate(value: string | null): string {
  if (!value) return '';
  const [, month, day] = value.split('-');
  return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1]}`;
}

/** «06.09» — дата в списке сессий сайдбара. */
export function numericDate(value: string | null): string {
  if (!value) return '—';
  const [, month, day] = value.split('-');
  return `${day}.${month}`;
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** «6 сентября 2025» — дата игры в списке сессий и в шапке её карточки.
 *  Там дата одна на весь экран, сокращать её не за чем, а год отличает
 *  прошлогоднюю игру от сегодняшней: кампания идёт не первый год. */
export function fullRuDate(value: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${Number(day)} ${MONTHS_GENITIVE[Number(month) - 1]} ${Number(year)}`;
}
