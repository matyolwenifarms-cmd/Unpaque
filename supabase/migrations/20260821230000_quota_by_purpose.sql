-- The rate limiter was written for one caller: the analysis endpoint, whose
-- ceiling exists because every request spends money at a vendor. Literature
-- search has the opposite shape — it calls OpenAlex and Crossref, which are
-- free public services — so it needs a limit for politeness and abuse, not for
-- spend, and at a completely different order of magnitude.
--
-- Sharing one counter would let a burst of free searches exhaust the paid
-- analysis budget for the day, which is precisely backwards.
--
-- So both tables gain a purpose, and the ceilings are per purpose.

alter table public.analysis_quota add column if not exists purpose text not null default 'analysis';
alter table public.analysis_spend add column if not exists purpose text not null default 'analysis';

comment on column public.analysis_quota.purpose is
  'Which endpoint the allowance belongs to. Ceilings are per purpose: free work must not be able to exhaust paid work.';

-- Repointing a primary key replay-safely. `add constraint` has no IF NOT
-- EXISTS, so the guard is explicit rather than implied.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.analysis_quota'::regclass and conname = 'analysis_quota_pkey'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (fingerprint)'
  ) then
    alter table public.analysis_quota drop constraint analysis_quota_pkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.analysis_quota'::regclass and conname = 'analysis_quota_pkey'
  ) then
    alter table public.analysis_quota add constraint analysis_quota_pkey primary key (purpose, fingerprint);
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.analysis_spend'::regclass and conname = 'analysis_spend_pkey'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (day)'
  ) then
    alter table public.analysis_spend drop constraint analysis_spend_pkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.analysis_spend'::regclass and conname = 'analysis_spend_pkey'
  ) then
    alter table public.analysis_spend add constraint analysis_spend_pkey primary key (purpose, day);
  end if;
end $$;

-- Set the output shape before defining it. `create or replace function` cannot
-- change a set-returning function's return type in either direction, so a
-- later migration widening this one would be unreplayable without the drop.
drop function if exists public.claim_quota_slot(text, text, integer, integer, interval);

create or replace function public.claim_quota_slot(
  p_purpose text,
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
  insert into public.analysis_spend (purpose, day, analyses)
  values (p_purpose, current_date, 0)
  on conflict (purpose, day) do nothing;

  select analyses into v_today
  from public.analysis_spend
  where purpose = p_purpose and day = current_date
  for update;

  -- The global ceiling is checked first and separately: when it is reached the
  -- caller has done nothing wrong, and burning their personal allowance for a
  -- refusal they did not cause would be the wrong answer.
  if v_today >= p_per_day then
    return query select false, 'daily_ceiling', 3600;
    return;
  end if;

  insert into public.analysis_quota (purpose, fingerprint, window_started_at, used)
  values (p_purpose, p_fingerprint, now(), 0)
  on conflict (purpose, fingerprint) do nothing;

  select used, window_started_at into v_used, v_started
  from public.analysis_quota
  where purpose = p_purpose and fingerprint = p_fingerprint
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
  where purpose = p_purpose and fingerprint = p_fingerprint;

  update public.analysis_spend
  set analyses = analyses + 1
  where purpose = p_purpose and day = current_date;

  return query select true, 'ok'::text, 0;
end;
$$;

revoke all on function public.claim_quota_slot(text, text, integer, integer, interval) from public;
grant execute on function public.claim_quota_slot(text, text, integer, integer, interval) to service_role;

-- The original single-purpose function is gone rather than left as a wrapper.
-- Two doors into one counter is how a limit quietly stops being one.
drop function if exists public.claim_analysis_slot(text, integer, integer, interval);
