import { z } from 'zod';
import { daysBetween, isPlausibleToday, ISO_DATE, parseISODate } from '@/lib/dates';
import { chooseDrafts, lookupTitles } from '@/lib/drafts';
import { parseSpends } from '@/lib/parser';
import { body, fail, json, requireUser, route, tooMany } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { deleteSpends, insertSpends, learnedCategories, listSpends, MAX_TRANSCRIPT, SpendInput } from '@/lib/server/spends';

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return fail(400, 'invalid', 'from and to must be YYYY-MM-DD.');
  const span = daysBetween(parseISODate(from), parseISODate(to));
  if (span < 1 || span > 400) return fail(400, 'invalid', 'Range must be 1–400 days.');
  return json({ spends: await listSpends(user.id, from, to) });
});

const Create = z.object({
  today: z.string(),
  source: z.enum(['voice', 'text', 'manual']).default('text'),
  text: z.string().max(MAX_TRANSCRIPT, 'That’s a bit long. Try one or two spends at a time.').optional(),
  // pre-parsed spends (manual entry, or queued while offline)
  items: z.array(SpendInput.extend({ heard: z.string().max(MAX_TRANSCRIPT).optional() })).min(1).max(20).optional(),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const limit = await hit(`write:${user.id}`, 60, 60);
  if (!limit.ok) return tooMany(limit.retryAfter, 'Slow down a little.');

  const input = await body(req, Create);
  if (!isPlausibleToday(input.today)) return fail(400, 'bad_date', 'Your device date looks off.');

  if (input.items) {
    const created = await insertSpends(user.id, input.items.map((s) => ({ ...s, source: input.source })));
    return json({ created }, 201);
  }

  const text = input.text?.trim();
  if (!text) return fail(400, 'invalid', 'Say or type what you spent.');

  const learned = await learnedCategories(user.id, lookupTitles(parseSpends(text, input.today)));
  const result = chooseDrafts([text], input.today, learned);
  if (!result) return fail(422, 'no_amount', `Couldn’t find an amount in “${text.slice(0, 80)}”.`);

  const created = await insertSpends(
    user.id,
    result.drafts.map((s) => ({
      amount: s.amount,
      title: s.title,
      note: s.note,
      category: s.category,
      date: s.date,
      heard: text,
      source: input.source,
    })),
  );
  return json({ created }, 201);
});

const Remove = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  const { ids } = await body(req, Remove);
  return json({ deleted: await deleteSpends(user.id, ids) });
});
