import { describe, expect, it } from 'vitest';
import { nameMatcher } from './name-mentions';

describe('nameMatcher', () => {
  it('узнаёт имя в именительном падеже', () => {
    expect(nameMatcher(['Оген'])('Оген у костра')).toBe(true);
  });

  it('склоняет мужское имя на согласную', () => {
    const matches = nameMatcher(['Оген']);
    expect(matches('Меч Огена')).toBe(true);
    expect(matches('Подарок Огену')).toBe(true);
    expect(matches('Рядом с Огеном')).toBe(true);
    expect(matches('Мысли об Огене')).toBe(true);
  });

  it('склоняет имя на -ь — и женское, и мужское', () => {
    expect(nameMatcher(['Метель'])('Шугар-дэдди Метели')).toBe(true);
    expect(nameMatcher(['Метель'])('Танец с Метелью')).toBe(true);
    expect(nameMatcher(['Игорь'])('Щит Игоря')).toBe(true);
    expect(nameMatcher(['Игорь'])('С Игорем')).toBe(true);
  });

  it('склоняет имена на -а и -я', () => {
    expect(nameMatcher(['Мира'])('Письмо Миры')).toBe(true);
    expect(nameMatcher(['Мира'])('С Мирой')).toBe(true);
    expect(nameMatcher(['Ольга'])('Кот Ольги')).toBe(true);
    expect(nameMatcher(['Дамайя'])('Встреча с Дамайей')).toBe(true);
    expect(nameMatcher(['Мария'])('О Марии')).toBe(true);
  });

  it('склоняет имена на -й', () => {
    expect(nameMatcher(['Андрей'])('Конь Андрея')).toBe(true);
    expect(nameMatcher(['Андрей'])('С Андреем')).toBe(true);
  });

  it('несклоняемое имя узнаёт как есть', () => {
    expect(nameMatcher(['Джаду'])('Джаду в пустыне')).toBe(true);
  });

  it('не смотрит на регистр и на ё', () => {
    expect(nameMatcher(['Аэлис'])('отец аэлиса')).toBe(true);
    expect(nameMatcher(['Алёна'])('Шляпа Алены')).toBe(true);
    expect(nameMatcher(['Алена'])('Шляпа Алёны')).toBe(true);
  });

  it('не узнаёт имя внутри другого слова', () => {
    expect(nameMatcher(['Метель'])('Метелица')).toBe(false);
    expect(nameMatcher(['Оген'])('Огенский тракт')).toBe(false);
    expect(nameMatcher(['Мира'])('Сотворение мирового древа')).toBe(false);
    expect(nameMatcher(['Джаду'])('Город Джадду')).toBe(false);
  });

  it('узнаёт имя в [[wiki-ссылке]]', () => {
    expect(nameMatcher(['Аэлис'])('Портрет [[Аэлис|нашего эльфа]]')).toBe(true);
  });

  it('узнаёт любое из имён — например, прежнее', () => {
    const matches = nameMatcher(['Метель', 'Снежинка']);
    expect(matches('Снежинку унесло ветром')).toBe(true);
  });

  it('имя из нескольких слов склоняет по словам', () => {
    const matches = nameMatcher(['Брат Лука']);
    expect(matches('В дороге с Братом Лукой')).toBe(true);
    expect(matches('В дороге с братом')).toBe(false);
  });

  it('без подписи или без имён упоминаний нет', () => {
    expect(nameMatcher(['Оген'])(null)).toBe(false);
    expect(nameMatcher(['Оген'])('')).toBe(false);
    expect(nameMatcher([])('Оген')).toBe(false);
    expect(nameMatcher(['  '])('Оген')).toBe(false);
  });
});
