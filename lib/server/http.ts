import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getUser, type SessionUser } from './auth';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (data: unknown, status = 200, extra?: Record<string, string>) =>
  NextResponse.json(data, { status, headers: { ...NO_STORE, ...extra } });

export const fail = (status: number, error: string, message: string, extra?: Record<string, string>) =>
  json({ error, message }, status, extra);

export const tooMany = (retryAfter: number, message = 'Too many attempts. Try again later.') =>
  fail(429, 'rate_limited', message, { 'Retry-After': String(retryAfter) });

export class HttpError extends Error {
  constructor(public response: Response) {
    super('http');
  }
}

/** Parse and validate a JSON body with a hard size cap. */
export async function body<S extends z.ZodType>(req: Request, schema: S, maxBytes = 8 * 1024): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(fail(413, 'too_large', 'Request is too large.'));
  let data: unknown;
  try {
    data = JSON.parse(text || '{}');
  } catch {
    throw new HttpError(fail(400, 'bad_json', 'Malformed request.'));
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(fail(400, 'invalid', issue?.message ?? 'Invalid request.'));
  }
  return parsed.data;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new HttpError(fail(401, 'unauthorized', 'Please log in.'));
  return user;
}

/** Wrap a route handler: typed errors become responses, anything else a generic 500 (no internals leak). */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof HttpError) return e.response;
      console.error(e);
      return fail(500, 'server_error', 'Something went wrong. Please try again.');
    }
  };
}
