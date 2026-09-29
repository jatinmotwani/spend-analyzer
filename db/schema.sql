-- Spend schema. Idempotent: safe to run on every deploy.

create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  pin_hash        text not null,
  currency        text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  monthly_budget  numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  failed_logins   integer not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

-- Opaque session tokens; only the SHA-256 of the token is stored.
create table if not exists sessions (
  token_hash  text primary key,
  user_id     uuid not null references users (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expiry_idx on sessions (expires_at);

create table if not exists spends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  title       text not null check (char_length(title) between 1 and 60),
  note        text not null default '' check (char_length(note) <= 120),
  category    text not null check (category in ('food', 'travel', 'groceries', 'shopping', 'bills', 'health', 'fun', 'other')),
  spent_on    date not null,
  heard       text not null default '' check (char_length(heard) <= 300),
  source      text not null default 'text' check (source in ('voice', 'text', 'manual', 'import')),
  created_at  timestamptz not null default now()
);
create index if not exists spends_user_date_idx on spends (user_id, spent_on desc, created_at desc);
-- "remember my category" lookups by place/item name
create index if not exists spends_user_title_idx on spends (user_id, lower(title));

-- Fixed-window counters for rate limits (no Redis needed).
create table if not exists rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          integer not null
);
create index if not exists rate_limits_window_idx on rate_limits (window_start);
