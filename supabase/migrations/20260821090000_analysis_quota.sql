-- Phase 1 has no accounts, by design: a user pastes something and gets a
-- report. That leaves the analysis endpoint reachable by anyone, and an
-- endpoint that turns an HTTP request into a model call is an uncapped bill
-- with a URL unless something counts.
--
-- Two ceilings, deliberately different in kind:
--   * per-fingerprint, so one visitor cannot sit on the button;
--   * global per day, so a distributed flood still stops at a number the
--     operator chose rather than at whatever the card allows.
--
-- The rejected alternative was in-memory counting in the Edge Function. Edge
-- instances are per-region and short-lived, so an in-memory counter resets
-- constantly and the limit it advertises is fiction.

create table if not exists public.analysis_quota (
  -- A salted hash of the caller's IP, never the IP. An address is personal
  -- information; a rate limiter needs to recognise a repeat caller, which a
  -- hash does, and does not need to be able to name them, which this cannot.
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  used integer not null default 0
);

comment on table public.analysis_quota is
  'Per-caller rate limit for the anonymous analysis endpoint. Fingerprints are salted hashes of an IP, not addresses.';

create table if not exists public.analysis_spend (
  day date primary key,
  analyses integer not null default 0
);

comment on table public.analysis_spend is
  'Global count of analyses per day, so a distributed flood stops at an operator-chosen number.';

-- Service-role only: nothing in the browser has any business reading either.
-- `force` rather than plain `enable` because these tables are never read by a
-- security definer function acting as owner — see claim_analysis_slot, which
-- writes them as owner but is called only with the service key.
alter table public.analysis_quota enable row level security;
alter table public.analysis_quota force row level security;
alter table public.analysis_spend enable row level security;
alter table public.analysis_spend force row level security;

-- Set the output shape before defining it: `create or replace function` cannot
-- change a function's return type in either direction, so a later migration
-- that widens this one would be unreplayable without the drop.
drop function if exists public.claim_analysis_slot(text, integer, integer, interval);

create or replace function public.claim_analysis_slot(
  p_fingerprint text,
  p_per_caller integer,
  p_per_day integer,
  p_window interval
)
returns table (allowed boolean, reason text, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
  v_started timestamptz;
  v_today integer;
begin
  -- The global ceiling is checked first and separately: when it is reached the
  -- caller has done nothing wrong, and burning their personal allowance for a
  -- refusal they did not cause would be the wrong answer.
  insert into public.analysis_spend (day, analyses)
  values (current_date, 0)
  on conflict (day) do nothing;

  select analyses into v_today
  from public.analysis_spend
  where day = current_date
  for update;

  if v_today >= p_per_day then
    return query select false, 'daily_ceiling', 3600;
    return;
  end if;

  insert into public.analysis_quota (fingerprint, window_started_at, used)
  values (p_fingerprint, now(), 0)
  on conflict (fingerprint) do nothing;

  select used, window_started_at into v_used, v_started
  from public.analysis_quota
  where fingerprint = p_fingerprint
  for update;

  if now() - v_started >= p_window then
    v_used := 0;
    v_started := now();
  end if;

  if v_used >= p_per_caller then
    return query
      select false,
             'caller_ceiling',
             greatest(1, ceil(extract(epoch from (v_started + p_window - now())))::integer);
    return;
  end if;

  update public.analysis_quota
  set used = v_used + 1, window_started_at = v_started
  where fingerprint = p_fingerprint;

  update public.analysis_spend
  set analyses = analyses + 1
  where day = current_date;

  return query select true, 'ok'::text, 0;
end;
$$;

revoke all on function public.claim_analysis_slot(text, integer, integer, interval) from public;
grant execute on function public.claim_analysis_slot(text, integer, integer, interval) to service_role;
