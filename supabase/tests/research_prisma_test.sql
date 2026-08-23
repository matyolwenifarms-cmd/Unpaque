-- Screening decisions, and the refusals that keep a PRISMA diagram honest.
-- Run after harness.sql and the migrations.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'reviewer@example.org')
on conflict (id) do nothing;

do $$
declare
  v_me    uuid := 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
  v_study uuid;
  v_row   uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.studies (owner_id, title) values (v_me, 'A review') returning id into v_study;

  insert into public.study_screening (study_id, label, found_via)
  values (v_study, 'Framing the student movement', 'OpenAlex') returning id into v_row;
  perform pg_temp.check('a record enters the review undecided', v_row is not null);
  perform pg_temp.check('and carries no decider or time until it is decided',
    (select decided_at is null from public.study_screening where id = v_row));

  -- A title screen needs no reason. PRISMA does not ask for one.
  update public.study_screening
  set state = 'excluded_on_title', decided_at = now(), decided_by = v_me
  where id = v_row;
  perform pg_temp.check('a title exclusion needs no reason',
    (select state = 'excluded_on_title' from public.study_screening where id = v_row));

  -- A full-text exclusion does.
  begin
    update public.study_screening
    set state = 'excluded_on_full_text', reason = null, decided_at = now()
    where id = v_row;
    perform pg_temp.check('a full-text exclusion with no reason must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a full-text exclusion cannot be recorded without a reason', true);
  end;

  update public.study_screening
  set state = 'excluded_on_full_text', reason = 'Wrong population', decided_at = now()
  where id = v_row;
  perform pg_temp.check('with a reason, it can',
    (select reason = 'Wrong population' from public.study_screening where id = v_row));

  -- The same refusal on the way in, not only on the way past.
  begin
    insert into public.study_screening (study_id, label, state, decided_at)
    values (v_study, 'Another paper', 'excluded_on_full_text', now());
    perform pg_temp.check('an inserted full-text exclusion with no reason must be refused', false);
  exception when check_violation then
    perform pg_temp.check('the same refusal holds however the row is written', true);
  end;

  -- A decision has a decider and a time, or it is not a decision.
  begin
    insert into public.study_screening (study_id, label, state)
    values (v_study, 'Undated decision', 'included');
    perform pg_temp.check('a decision with no time must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a decision without a time is not a decision', true);
  end;

  begin
    insert into public.study_screening (study_id, label, state, decided_at)
    values (v_study, 'Dated non-decision', 'identified', now());
    perform pg_temp.check('an undecided record with a decision time must be refused', false);
  exception when check_violation then
    perform pg_temp.check('nor is a record nobody has looked at yet', true);
  end;

  reset role;
end $$;

-- The absence that is the whole design: nowhere to store a total.
do $$
begin
  perform pg_temp.check('there is no table of PRISMA counts, so none can disagree with the records',
    not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name like '%prisma%'
    ));
  perform pg_temp.check('and no column holding one either',
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and column_name in ('identified', 'screened', 'assessed', 'included_count', 'total_identified')
    ));
  perform pg_temp.check('the screening vocabulary is the six boxes PRISMA draws',
    (select array_agg(enumlabel::text order by enumsortorder)
     from pg_enum where enumtypid = 'public.screening_state'::regtype)
      = array['identified', 'duplicate', 'excluded_on_title', 'assessed',
              'excluded_on_full_text', 'included']);
  perform pg_temp.check('study_screening has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'study_screening'));
end $$;

do $$
begin
  begin
    perform pg_temp.check('control: this assertion must fail', false);
    raise exception 'NEGATIVE CONTROL FAILED: a false assertion was accepted';
  exception when others then
    if sqlerrm like 'NEGATIVE CONTROL FAILED%' then raise; end if;
    raise notice 'ok: the harness can fail (%)', sqlerrm;
  end;
end $$;

rollback;
