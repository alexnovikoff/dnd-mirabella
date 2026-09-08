/** Разбор [[wiki-ссылок]] — общий для рендера, сида и этапа 4. */

const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export type WikiToken =
  { type: 'text'; value: string } | { type: 'link'; name: string; label: string };

/** Режет текст на куски: обычный текст и ссылки. */
export function tokenizeWiki(body: string): WikiToken[] {
  const tokens: WikiToken[] = [];
  let last = 0;

  for (const match of body.matchAll(WIKI_LINK)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ type: 'text', value: body.slice(last, start) });
    const name = match[1].trim();
    tokens.push({ type: 'link', name, label: (match[2] ?? name).trim() });
    last = start + match[0].length;
  }

  if (last < body.length) tokens.push({ type: 'text', value: body.slice(last) });
  return tokens;
}

/** Имена сущностей, упомянутых в тексте, в порядке появления. */
export function parseWikiLinks(body: string): string[] {
  return tokenizeWiki(body)
    .filter((token): token is Extract<WikiToken, { type: 'link' }> => token.type === 'link')
    .map((token) => token.name);
}
