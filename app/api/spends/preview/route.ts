import { z } from 'zod';
import { isPlausibleToday } from '@/lib/dates';
import { chooseDrafts, lookupTitles } from '@/lib/drafts';
import { parseSpends } from '@/lib/parser';
import { body, fail, json, requireUser, route, tooMany } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { learnedCategories, MAX_TRANSCRIPT } from '@/lib/server/spends';

const Input = z.object({
  today: z.string(),
  // the speech engine's guesses, best first (a typed entry is a single "guess")
  alternatives: z.array(z.string().trim().min(1).max(MAX_TRANSCRIPT)).min(1).max(5),
});

/** Parse without saving: the client shows these drafts on the confirm card. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const limit = await hit(`write:${user.id}`, 60, 60);
  if (!limit.ok) return tooMany(limit.retryAfter, 'Slow down a little.');

  const { today, alternatives } = await body(req, Input);
  if (!isPlausibleToday(today)) return fail(400, 'bad_date', 'Your device date looks off.');

  const titles = alternatives.flatMap((a) => lookupTitles(parseSpends(a, today)));
  const learned = await learnedCategories(user.id, titles);
  const result = chooseDrafts(alternatives, today, learned);
  if (!result) return fail(422, 'no_amount', `Couldn’t find an amount in “${alternatives[0].slice(0, 80)}”.`);
  return json(result);
});
