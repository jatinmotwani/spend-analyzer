import 'server-only';
import { neon } from '@neondatabase/serverless';
import { env } from './env';

// One tagged-template interface over two drivers:
//  - Neon's HTTP driver in production (no connection pool to manage on serverless),
//  - postgres.js for a local Postgres during development.
// Every value is sent as a bound parameter, never interpolated into SQL.
type Row = Record<string, unknown>;
type Client = (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<Row[]>;

let client: Client | null = null;
let pending: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (client) return client;
  pending ??= (async () => {
    const url = env.databaseUrl;
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const { default: postgres } = await import('postgres');
      client = postgres(url, { max: 5, onnotice: () => {} }) as unknown as Client;
    } else {
      client = neon(url) as unknown as Client;
    }
    return client;
  })();
  return pending;
}

const RAW = Symbol('raw-sql');
type Raw = { [RAW]: string };

/** Splice a constant SQL fragment (e.g. a column list). Never pass user input. */
export const raw = (fragment: string): Raw => ({ [RAW]: fragment });
const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && RAW in v;

export async function sql<T = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const c = await getClient();
  if (!values.some(isRaw)) return (await c(strings, ...values)) as T[];
  // fold raw fragments into the template text; everything else stays a bound parameter
  const parts = [strings[0]];
  const params: unknown[] = [];
  values.forEach((v, i) => {
    if (isRaw(v)) parts[parts.length - 1] += v[RAW] + strings[i + 1];
    else {
      params.push(v);
      parts.push(strings[i + 1]);
    }
  });
  const template = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray;
  return (await c(template, ...params)) as T[];
}
