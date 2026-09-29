import { z } from 'zod';
import { endSession, getUser } from '@/lib/server/auth';
import { body, json, route } from '@/lib/server/http';

export const POST = route(async (req: Request) => {
  const { everywhere } = await body(req, z.object({ everywhere: z.boolean().optional() }));
  const user = await getUser();
  await endSession({ everywhere: Boolean(everywhere), userId: user?.id });
  return json({ ok: true });
});
