import { z } from 'zod';
import { isPlausibleToday } from '@/lib/dates';
import { buildDashboard, dashboardRange } from '@/lib/insights';
import { fail, json, requireUser, route } from '@/lib/server/http';
import { listSpends } from '@/lib/server/spends';

const Query = z.object({
  kind: z.enum(['week', 'month', 'year']),
  offset: z.coerce.number().int().min(-240).max(0),
  today: z.string(),
});

// BFF endpoint: one request returns everything the overview screen renders.
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success || !isPlausibleToday(parsed.data.today)) return fail(400, 'invalid', 'Invalid period.');
  const { kind, offset, today } = parsed.data;
  const { from, to } = dashboardRange(kind, offset, today);
  const spends = await listSpends(user.id, from, to, 20_000);
  return json(buildDashboard(spends, { kind, offset, today, monthlyBudget: user.monthlyBudget }));
});
