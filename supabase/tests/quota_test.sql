-- Behavioural tests for claim_analysis_slot. Run against a database that has
-- had harness.sql and the migrations applied.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

truncate public.analysis_quota;
truncate public.analysis_spend;

-- A fresh caller is allowed.
do $$
declare r record;
begin
  select * into r from public.claim_analysis_slot('caller-a', 3, 100, '1 hour');
  perform pg_temp.check('a fresh caller is allowed', r.allowed);
  perform pg_temp.check('and the reason is ok', r.reason = 'ok');
end $$;

-- The allowance is spent exactly, then refused.
do $$
declare r record; i integer;
begin
  for i in 1..2 loop
    select * into r from public.claim_analysis_slot('caller-a', 3, 100, '1 hour');
    perform pg_temp.check('call ' || i + 1 || ' of 3 is allowed', r.allowed);
  end loop;

  select * into r from public.claim_analysis_slot('caller-a', 3, 100, '1 hour');
  perform pg_temp.check('the fourth call is refused', not r.allowed);
  perform pg_temp.check('and names the caller ceiling', r.reason = 'caller_ceiling');
  perform pg_temp.check('and says when to come back', r.retry_after_seconds > 0);
end $$;

-- One caller sitting on the button does not exhaust another.
do $$
declare r record;
begin
  select * into r from public.claim_analysis_slot('caller-b', 3, 100, '1 hour');
  perform pg_temp.check('a different caller is unaffected', r.allowed);
end $$;

-- The window expiring resets the allowance.
do $$
declare r record;
begin
  update public.analysis_quota
  set window_started_at = now() - interval '2 hours'
  where fingerprint = 'caller-a';

  select * into r from public.claim_analysis_slot('caller-a', 3, 100, '1 hour');
  perform pg_temp.check('an expired window resets the allowance', r.allowed);
end $$;

-- The global ceiling refuses everyone, including a caller with allowance left.
do $$
declare r record;
begin
  update public.analysis_spend set analyses = 100 where day = current_date;

  select * into r from public.claim_analysis_slot('caller-fresh', 50, 100, '1 hour');
  perform pg_temp.check('the daily ceiling refuses a fresh caller', not r.allowed);
  perform pg_temp.check('and names the daily ceiling', r.reason = 'daily_ceiling');
end $$;

-- The ordering claim in the migration's comment: a caller refused by the global
-- ceiling must not have their own allowance charged for it.
do $$
declare r record; v_used integer;
begin
  truncate public.analysis_quota;
  update public.analysis_spend set analyses = 100 where day = current_date;

  select * into r from public.claim_analysis_slot('caller-c', 5, 100, '1 hour');
  perform pg_temp.check('refused at the daily ceiling', not r.allowed);

  select count(*) into v_used from public.analysis_quota where fingerprint = 'caller-c';
  perform pg_temp.check(
    'a caller refused by the global ceiling is not charged for it',
    v_used = 0
  );
end $$;

-- Negative controls. If these pass, the suite above proves nothing.
do $$
declare r record;
begin
  update public.analysis_spend set analyses = 0 where day = current_date;
  truncate public.analysis_quota;

  select * into r from public.claim_analysis_slot('caller-d', 1, 100, '1 hour');
  perform pg_temp.check('control: first call allowed', r.allowed);

  select * into r from public.claim_analysis_slot('caller-d', 1, 100, '1 hour');
  begin
    perform pg_temp.check('control: this assertion must fail', r.allowed);
    raise exception 'NEGATIVE CONTROL FAILED: a refused call reported as allowed';
  exception
    when others then
      if position('NEGATIVE CONTROL FAILED' in sqlerrm) > 0 then raise; end if;
      raise notice 'ok: the harness can fail (%)', left(sqlerrm, 40);
  end;
end $$;

rollback;
