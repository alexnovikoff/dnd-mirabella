/* Запросы экрана «Галерея»: лента изображений, сгруппированная по сессиям
 * либо плоская по дате. */

import { and, desc, eq, ne } from 'drizzle-orm';
import { runDb } from '@/lib/db/client';
import * as t from '@/lib/db/schema';
import { CAMPAIGN_ID } from '@/lib/db/seed';

export type GalleryFilter = 'all' | 'art' | 'map' | 'screenshot';

export const GALLERY_FILTERS: { id: GalleryFilter; label: string }[] = [
  { id: 'all', label: 'ВСЁ' },
  { id: 'art', label: 'АРТЫ' },
  { id: 'map', label: 'КАРТЫ' },
  { id: 'screenshot', label: 'СКРИНЫ' },
];

export function isGalleryFilter(value: string | undefined): value is GalleryFilter {
  return GALLERY_FILTERS.some((f) => f.id === value);
}

/** Всё, кроме достижений: те живут на странице персонажа. */
export type GalleryKind = Exclude<t.ImageKind, 'achievement'>;

export type GalleryImage = {
  id: string;
  url: string | null;
  caption: string | null;
  kind: GalleryKind;
  isKey: boolean;
  uploaderName: string | null;
  sessionNumber: number | null;
};

export type GalleryGroup = {
  key: string;
  title: string;
  date: string | null;
  /** Номер сессии — по нему заголовок группы ведёт на её страницу.
   *  null у кадров вне игр и у плоского списка: вести там некуда. */
  sessionNumber: number | null;
  images: GalleryImage[];
};

export function getGallery(filter: GalleryFilter, grouped: boolean) {
  return runDb(async (db) => {
    /* Достижения — часть страницы персонажа, а не хроники кампании:
     * фильтра под них здесь нет, и в «ВСЁ» они тоже не попадают. */
    const conditions = [eq(t.images.campaignId, CAMPAIGN_ID), ne(t.images.kind, 'achievement')];
    if (filter !== 'all') conditions.push(eq(t.images.kind, filter));

    const rows = await db
      .select({
        id: t.images.id,
        url: t.images.url,
        caption: t.images.caption,
        kind: t.images.kind,
        isKey: t.images.isKey,
        createdAt: t.images.createdAt,
        uploaderName: t.users.name,
        sessionId: t.sessions.id,
        sessionNumber: t.sessions.number,
        sessionTitle: t.sessions.title,
        sessionDate: t.sessions.date,
      })
      .from(t.images)
      .leftJoin(t.users, eq(t.users.id, t.images.uploaderId))
      .leftJoin(t.sessions, eq(t.sessions.id, t.images.sessionId))
      .where(and(...conditions))
      /* Ключевой кадр идёт первым в группе — он занимает плитку 2×2
       * в левом верхнем углу сетки, как в макете. */
      .orderBy(
        desc(t.sessions.number),
        desc(t.images.isKey),
        desc(t.images.createdAt),
        desc(t.images.id),
      );

    const total = rows.length;

    if (!grouped) {
      return {
        total,
        groups: [
          {
            key: 'all',
            title: 'Все изображения',
            date: null,
            sessionNumber: null,
            images: rows.map(toImage),
          },
        ] satisfies GalleryGroup[],
      };
    }

    const groups = new Map<string, GalleryGroup>();
    for (const row of rows) {
      const key = row.sessionId ?? 'none';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: row.sessionNumber
            ? `Сессия ${row.sessionNumber}${row.sessionTitle ? ` — ${row.sessionTitle}` : ''}`
            : 'Без сессии',
          date: row.sessionDate,
          sessionNumber: row.sessionNumber,
          images: [],
        });
      }
      groups.get(key)?.images.push(toImage(row));
    }

    return { total, groups: [...groups.values()] };
  });
}

type Row = {
  id: string;
  url: string | null;
  caption: string | null;
  kind: t.ImageKind;
  isKey: boolean;
  uploaderName: string | null;
  sessionNumber: number | null;
};

function toImage(row: Row): GalleryImage {
  return {
    id: row.id,
    url: row.url,
    caption: row.caption,
    /* Достижения отсечены условием выборки — сюда доходят только виды ленты. */
    kind: row.kind as GalleryKind,
    isKey: row.isKey,
    uploaderName: row.uploaderName,
    sessionNumber: row.sessionNumber,
  };
}
