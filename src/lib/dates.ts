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
