import { z } from 'zod';
import { body, json, requireUser, route, tooMany } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { insertSpends, SpendInput } from '@/lib/server/spends';

// One-time import of spends kept on the device by the previous (offline-only) version.
const Input = z.object({
  items: z.array(SpendInput.extend({ heard: z.string().max(300).optional() })).min(1).max(5000),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const limit = await hit(`import:${user.id}`, 5, 3600);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const { items } = await body(req, Input, 1024 * 1024);
  let imported = 0;
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500).map((s) => ({ ...s, source: 'import' }));
    imported += (await insertSpends(user.id, chunk)).length;
  }
  return json({ imported }, 201);
});
