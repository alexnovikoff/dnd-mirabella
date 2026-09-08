import { describe, expect, it } from 'vitest';
import { parseWikiLinks, tokenizeWiki } from './parse';

describe('tokenizeWiki', () => {
  it('режет текст на куски вокруг ссылок', () => {
    expect(tokenizeWiki('До [[Дамайя]] после')).toEqual([
      { type: 'text', value: 'До ' },
      { type: 'link', name: 'Дамайя', label: 'Дамайя' },
      { type: 'text', value: ' после' },
    ]);
  });

  it('поддерживает подпись через вертикальную черту', () => {
    expect(tokenizeWiki('[[Горы Андерксот|в горах]]')).toEqual([
      { type: 'link', name: 'Горы Андерксот', label: 'в горах' },
    ]);
  });

  it('обрезает пробелы внутри скобок', () => {
    expect(parseWikiLinks('[[  Дамайя  ]]')).toEqual(['Дамайя']);
  });

  it('не считает ссылкой одиночные скобки', () => {
    expect(parseWikiLinks('массив[0] и [одиночные] скобки')).toEqual([]);
  });

  it('возвращает имена в порядке появления и с повторами', () => {
    expect(parseWikiLinks('[[А]] и [[Б]], снова [[А]]')).toEqual(['А', 'Б', 'А']);
  });

  it('на тексте без ссылок отдаёт один кусок', () => {
    expect(tokenizeWiki('просто текст')).toEqual([{ type: 'text', value: 'просто текст' }]);
  });
});
