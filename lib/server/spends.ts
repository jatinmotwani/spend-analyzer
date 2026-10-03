import 'server-only';
import { z } from 'zod';
import { CATEGORY_IDS, type CategoryId } from '../categories';
import { ISO_DATE, parseISODate, toISODate } from '../dates';
import type { Spend } from '../insights';
import { raw, sql } from './db';

type Row = {
  id: string;
  amount: number;
  title: string;
  note: string;
  category: CategoryId;
  spent_on: string;
  heard: string;
  source: string;
  created_ms: number;
};

const toSpend = (r: Row): Spend => ({
  id: r.id,
  amount: r.amount,
  title: r.title,
  note: r.note,
  category: r.category,
  date: r.spent_on,
  heard: r.heard,
  source: r.source,
  createdAt: r.created_ms,
});

// Driver-neutral column list: numbers as float8, dates as text.
const COLUMNS = 'id, amount::float8 as amount, title, note, category, spent_on::text as spent_on, heard, source, (extract(epoch from created_at) * 1000)::float8 as created_ms';

export const MAX_TRANSCRIPT = 300;

const text = (max: number) => z.string().transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).pipe(z.string().max(max));

export const SpendInput = z.object({
  amount: z.number().positive().lt(10_000_000).transform((n) => Math.round(n * 100) / 100),
  title: text(60).pipe(z.string().min(1, 'Add a title')),
  note: text(120).default(''),
  category: z.enum(CATEGORY_IDS),
  date: z
    .string()
    .regex(ISO_DATE)
    .refine((d) => d >= '2000-01-01' && toISODate(parseISODate(d)) === d, 'Invalid date'),
});
export type SpendInput = z.infer<typeof SpendInput>;

export const SpendPatch = SpendInput.partial();

export async function listSpends(userId: string, from: string, to: string, limit = 5000): Promise<Spend[]> {
  const rows = await sql<Row>`
    select ${raw(COLUMNS)} from spends
    where user_id = ${userId}::uuid and spent_on >= ${from}::date and spent_on < ${to}::date
    order by spent_on desc, created_at desc
    limit ${limit}`;
  return rows.map(toSpend);
}

export async function insertSpends(
  userId: string,
  items: (SpendInput & { heard?: string; source: string })[],
): Promise<Spend[]> {
  if (!items.length) return [];
  const payload = JSON.stringify(
    items.map((s, ord) => ({
      ord,
      amount: s.amount,
      title: s.title,
      note: s.note ?? '',
      category: s.category,
      spent_on: s.date,
      heard: (s.heard ?? '').slice(0, 300),
      source: s.source,
    })),
  );
  // jsonb_to_recordset keeps a multi-row insert to one bound parameter. JSON params go
  // through ::text so both drivers send the string as-is (postgres.js re-encodes ::jsonb).
  const rows = await sql<Row>`
    insert into spends (user_id, amount, title, note, category, spent_on, heard, source, created_at)
    select ${userId}::uuid, x.amount, x.title, x.note, x.category, x.spent_on, x.heard, x.source,
           now() + (x.ord * interval '1 microsecond')
    from jsonb_to_recordset(${payload}::text::jsonb)
      as x(ord int, amount numeric, title text, note text, category text, spent_on date, heard text, source text)
    returning ${raw(COLUMNS)}`;
  return rows.map(toSpend);
}

export async function updateSpend(userId: string, id: string, patch: z.infer<typeof SpendPatch>): Promise<Spend | null> {
  const [row] = await sql<Row>`
    update spends set
      amount = coalesce(${patch.amount ?? null}::numeric, amount),
      title = coalesce(${patch.title ?? null}::text, title),
      note = coalesce(${patch.note ?? null}::text, note),
      category = coalesce(${patch.category ?? null}::text, category),
      spent_on = coalesce(${patch.date ?? null}::date, spent_on)
    where id = ${id}::uuid and user_id = ${userId}::uuid
    returning ${raw(COLUMNS)}`;
  return row ? toSpend(row) : null;
}

export async function deleteSpends(userId: string, ids: string[]): Promise<number> {
  const rows = await sql`
    delete from spends
    where user_id = ${userId}::uuid
      and id in (select value::uuid from jsonb_array_elements_text(${JSON.stringify(ids)}::text::jsonb))
    returning 1`;
  return rows.length;
}

/**
 * Categories the user has settled on before, keyed by lower-cased title.
 * Editing a spend's category is how the app learns: next time the same place
 * or item comes up, the category the user chose most often wins.
 */
export async function learnedCategories(userId: string, titles: string[]): Promise<Map<string, CategoryId>> {
  const wanted = [...new Set(titles.map((t) => t.trim().toLowerCase()))].filter(Boolean);
  if (!wanted.length) return new Map();
  const rows = await sql<{ t: string; category: CategoryId }>`
    select distinct on (t) t, category from (
      select lower(title) as t, category, count(*) as n, max(created_at) as last
      from spends
      where user_id = ${userId}::uuid
        and lower(title) in (select value from jsonb_array_elements_text(${JSON.stringify(wanted)}::text::jsonb))
      group by 1, 2
    ) s
    order by t, n desc, last desc`;
  return new Map(rows.map((r) => [r.t, r.category]));
}

/** The places the user logs most, used as speech-recognition hints. */
export async function topPlaces(userId: string, limit = 40): Promise<string[]> {
  const rows = await sql<{ title: string }>`
    select min(title) as title from spends
    where user_id = ${userId}::uuid and spent_on > current_date - 180
    group by lower(title)
    order by count(*) desc
    limit ${limit}`;
  return rows.map((r) => r.title);
}
