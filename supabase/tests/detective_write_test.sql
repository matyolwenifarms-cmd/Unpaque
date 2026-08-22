-- Can the app actually write? Run after harness.sql and the migrations.
--
-- This suite exists because detective_privacy_test.sql only ever asserted
-- refusals, and a policy that refuses everybody passes every one of them. It
-- proved a stranger could not create a case in somebody else's name. It never
-- proved the owner could create one in their own — and for a while nobody
-- could, because `insert ... returning` also applies the *select* policy to the
-- row it hands back, and the select policy resolved ownership by looking the
-- case up in `cases`, where the row being inserted was not yet visible.
--
-- Postgres reports that as `new row violates row-level security policy`, the
-- same message a with-check failure gets, so the error named the wrong policy
-- and the insert policy was rewritten twice before the returning clause was
-- suspected.
--
-- So: every table the app writes to is inserted into here with `returning`,
-- because `returning` is what supabase-js sends and it is a stricter test than
-- a bare insert. A suite of negative controls follows, since a check that
-- cannot fail is not evidence.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'writer@example.org'),
  ('88888888-8888-8888-8888-888888888888', 'stranger@example.org')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The whole write path, as the browser performs it
-- ---------------------------------------------------------------------------

do $$
declare
  v_me       uuid := '77777777-7777-7777-7777-777777777777';
  v_case     uuid;
  v_source_a uuid;
  v_source_b uuid;
  v_claim    uuid;
  v_row      uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  -- The regression. `returning id` is the whole point: without it this insert
  -- succeeded throughout the period when the app could not create a case.
  insert into public.cases (owner_id, title, question)
  values (v_me, 'Zolani Tete Shooting', 'Who did it?')
  returning id into v_case;
  perform pg_temp.check('an owner can create their own case and read it back', v_case is not null);

  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'reporting', 'First report', 'https://example.org/a', v_me)
  returning id into v_source_a;
  perform pg_temp.check('a source can be added and read back', v_source_a is not null);

  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'testimony', 'A witness account', 'interview', v_me)
  returning id into v_source_b;
  perform pg_temp.check('a second source can be added', v_source_b is not null);

  insert into public.claims (case_id, statement, status, created_by)
  values (v_case, 'A shot was fired at 21:15.', 'claim', v_me)
  returning id into v_claim;
  perform pg_temp.check('a claim can be added and read back', v_claim is not null);

  insert into public.evidence (case_id, claim_id, source_id, classification, excerpt, created_by)
  values (v_case, v_claim, v_source_a, 'supports', 'heard a bang', v_me)
  returning id into v_row;
  perform pg_temp.check('evidence can be linked and read back', v_row is not null);

  insert into public.events (case_id, source_id, label, occurred_at, certainty, origin, created_by)
  values (v_case, v_source_a, 'The shot', now(), 'claimed', 'account', v_me)
  returning id into v_row;
  perform pg_temp.check('an event can be added and read back', v_row is not null);

  insert into public.contradictions
    (case_id, type, source_a, source_b, difference, explanations, significance)
  values (
    v_case, 'temporal', v_source_a, v_source_b,
    'One account says 21:15, the other 21:45.',
    '[{"summary":"One clock was wrong.","distinguishedBy":"A timestamped recording."},
      {"summary":"An account is inaccurate.","distinguishedBy":"A second witness."}]'::jsonb,
    'Thirty minutes decides who was present.')
  returning id into v_row;
  perform pg_temp.check('a contradiction can be recorded and read back', v_row is not null);

  -- The owner can still list what they wrote.
  perform pg_temp.check('the case is visible to its owner afterwards',
    (select count(*) from public.cases where id = v_case) = 1);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls. Nothing above is evidence unless these refuse.
-- ---------------------------------------------------------------------------

do $$
declare
  v_me    uuid := '77777777-7777-7777-7777-777777777777';
  v_them  uuid := '88888888-8888-8888-8888-888888888888';
  v_case  uuid;
  v_row   uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.cases (owner_id, title) values (v_me, 'Mine alone') returning id into v_case;

  -- Now somebody else entirely.
  perform set_config('request.jwt.claim.sub', v_them::text, true);

  -- Named exception classes, not `when others`. Catching everything would let
  -- a typo in a column name pass as a refusal.
  begin
    insert into public.cases (owner_id, title) values (v_me, 'A case in another name')
    returning id into v_row;
    perform pg_temp.check('a case owned by somebody else must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a case cannot be created in somebody else''s name', true);
  end;

  begin
    insert into public.sources (case_id, kind, title, retrieved_from)
    values (v_case, 'reporting', 'Slipped in', 'https://example.org/x')
    returning id into v_row;
    perform pg_temp.check('a source in a stranger''s case must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot add a source to a case', true);
  end;

  begin
    insert into public.claims (case_id, statement) values (v_case, 'Slipped in')
    returning id into v_row;
    perform pg_temp.check('a claim in a stranger''s case must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot add a claim to a case', true);
  end;

  perform pg_temp.check('a stranger cannot even see the case',
    (select count(*) from public.cases where id = v_case) = 0);

  reset role;
end $$;

-- The harness itself must be able to fail.
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
