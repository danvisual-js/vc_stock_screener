-- AI Market Screener: daily email subscriptions + rate limiting.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Row Level Security is ON with no policies, so the public (anon) key can read nothing.
-- Only the server (service role key, kept in Vercel env vars) can touch these tables.

create table if not exists public.subscriptions (
  id            text primary key,
  email         text not null,
  symbols       text[] not null default '{}',
  confirmed     boolean not null default false,
  unsub         text not null,
  pending       jsonb,
  last_sent     date,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index if not exists subscriptions_confirmed_idx on public.subscriptions (confirmed);

create table if not exists public.rate_limits (
  key       text primary key,
  n         integer not null,
  reset_at  timestamptz not null
);

alter table public.subscriptions enable row level security;
alter table public.rate_limits  enable row level security;

create or replace function public.rl_hit(k text, max_n integer, win_s integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare c integer;
begin
  insert into public.rate_limits as r (key, n, reset_at)
  values (k, 1, now() + make_interval(secs => win_s))
  on conflict (key) do update
    set n        = case when r.reset_at < now() then 1 else r.n + 1 end,
        reset_at = case when r.reset_at < now() then now() + make_interval(secs => win_s) else r.reset_at end
  returning n into c;
  return c <= max_n;
end $$;

revoke all on function public.rl_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rl_hit(text, integer, integer) to service_role;

-- ── Beta members, waitlist and tiers (added with the lander) ─────────────────
-- tier: 'waitlist' (no access code yet), 'beta', 'supporter'. Change a row's tier in the Table Editor to upgrade someone.
create table if not exists public.members (
  id          text primary key,            -- sha-256 of lowercased email (first 24 hex)
  email       text not null,
  name        text,
  interest    text,
  source      text,
  code        text unique,                 -- 8-character access code, null while on the waitlist
  tier        text not null default 'waitlist' check (tier in ('waitlist','beta','supporter')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists members_tier_idx on public.members (tier);
alter table public.members enable row level security;

-- Like rl_hit but also returns the running count, so the app can show "N left today".
create or replace function public.rl_take(k text, max_n integer, win_s integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c integer;
begin
  insert into public.rate_limits as r (key, n, reset_at)
  values (k, 1, now() + make_interval(secs => win_s))
  on conflict (key) do update
    set n        = case when r.reset_at < now() then 1 else r.n + 1 end,
        reset_at = case when r.reset_at < now() then now() + make_interval(secs => win_s) else r.reset_at end
  returning n into c;
  return jsonb_build_object('ok', c <= max_n, 'n', c);
end $$;
revoke all on function public.rl_take(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rl_take(text, integer, integer) to service_role;
