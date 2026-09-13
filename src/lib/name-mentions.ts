/* Упоминание имени в свободном тексте — с учётом падежей.
 *
 * Подписи кадров пишут как придётся: «Меч Огена», «Шугар-дэдди Метели»,
 * без [[скобок]]. Словаря имён кампании нет, да и имена в ней выдуманные,
 * поэтому склоняем по последней букве — как склоняются русские имена:
 * на согласную (Оген → Огена, Огеном), на -ь (Метель → Метели, Метелью;
 * Игорь → Игоря), на -а, -я и -й. Имена на прочие гласные (Джаду)
 * не склоняются и узнаются как есть.
 *
 * Беглую гласную (Павел → Павла) и прилагательные в составе имени
 * («Та Самая Таверна») правило не видит: такое имя узнают по прежним
 * именам — формы можно дописать туда. */

/** Окончания по последней букве имени; сама буква в основу не входит. */
const DECLENSION: Record<string, string[]> = {
  а: ['а', 'ы', 'и', 'е', 'у', 'ой', 'ою', 'ей', 'ею'],
  я: ['я', 'и', 'е', 'ю', 'ей', 'ею'],
  ь: ['ь', 'я', 'ю', 'ем', 'е', 'и', 'ью'],
  й: ['й', 'я', 'ю', 'ем', 'е', 'и'],
};

/** Имя на согласную — основа целиком, окончание дописывается. */
const CONSONANT_ENDINGS = ['', 'а', 'у', 'ом', 'ем', 'е'];
const ENDS_WITH_CONSONANT = /[бвгджзклмнпрстфхцчшщ]$/;

/** Имя не должно продолжаться буквой или цифрой ни с одной стороны:
 *  «Метель» не прячется в «Метелице». */
const WORD_CHAR = '[\\p{L}\\p{N}]';

/** Регистр и ё в подписях гуляют — сравниваем без них. */
function normalize(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordForms(word: string): string {
  const endings = DECLENSION[word.at(-1) ?? ''];
  if (endings) return `${escapeRegExp(word.slice(0, -1))}(?:${endings.join('|')})`;
  if (ENDS_WITH_CONSONANT.test(word)) {
    return `${escapeRegExp(word)}(?:${CONSONANT_ENDINGS.join('|')})`;
  }
  return escapeRegExp(word);
}

/** Проверка «упомянуто ли в тексте одно из имён». Имя из нескольких слов
 *  склоняется по словам: «с Братом Лукой». Регулярка собирается
 *  один раз — дальше ею проверяют сколько угодно подписей. */
export function nameMatcher(names: string[]): (text: string | null) => boolean {
  const patterns = names
    .map((name) => normalize(name).split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0)
    .map((words) => words.map(wordForms).join('\\s+'));

  if (patterns.length === 0) return () => false;

  const mention = new RegExp(`(?<!${WORD_CHAR})(?:${patterns.join('|')})(?!${WORD_CHAR})`, 'u');
  return (text) => (text ? mention.test(normalize(text)) : false);
}
