import { z } from 'zod';
import { body, fail, json, requireUser, route } from '@/lib/server/http';
import { deleteSpends, SpendPatch, updateSpend } from '@/lib/server/spends';

type Ctx = { params: Promise<{ id: string }> };

const Id = z.uuid();

async function spendId(ctx: Ctx) {
  const parsed = Id.safeParse((await ctx.params).id);
  return parsed.success ? parsed.data : null;
}

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = await spendId(ctx);
  if (!id) return fail(404, 'not_found', 'Spend not found.');
  const patch = await body(req, SpendPatch);
  const spend = await updateSpend(user.id, id, patch);
  return spend ? json({ spend }) : fail(404, 'not_found', 'Spend not found.');
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = await spendId(ctx);
  if (!id) return fail(404, 'not_found', 'Spend not found.');
  const deleted = await deleteSpends(user.id, [id]);
  return deleted ? json({ ok: true }) : fail(404, 'not_found', 'Spend not found.');
});
