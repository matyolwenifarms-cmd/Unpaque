-- Sources, claims and evidence: isolation and provenance.
--
-- The assertions that matter here are about what cannot be done. A schema that
-- merely discourages a cross-case link is not the same as one where the link
-- cannot be inserted, and only the second is worth relying on.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.org'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@example.org'),
  ('44444444-4444-4444-4444-444444444444', 'stranger@example.org')
on conflict (id) do nothing;

-- Two separate investigations, owned by the same person. Same owner on purpose:
-- if isolation only held between users it would not be isolation, it would be
-- ownership.
insert into public.cases (id, owner_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Case A'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Case B');

insert into public.sources (id, case_id, kind, title, retrieved_from) values
  ('a5a5a5a5-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'official_record', 'A gazette notice', 'https://gazette.example.org/2026/114'),
  ('c5c5c5c5-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'reporting', 'A newspaper report', 'https://paper.example.org/story');

insert into public.claims (id, case_id, statement, asserted_by) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'The tender was awarded in March.', 'The gazette'),
  ('c1c1c1c1-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'A different matter entirely.', 'The paper');

-- ---------------------------------------------------------------------------

do $$
begin
  -- The isolation property, tried directly. This is the shape a private-case
  -- leak would take: evidence in one investigation reaching into another.
  begin
    insert into public.evidence (case_id, claim_id, source_id, classification)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'a1a1a1a1-0000-0000-0000-000000000001',
            'c5c5c5c5-0000-0000-0000-000000000001', 'supports');
    perform pg_temp.check('evidence must not reach a source in another case', false);
  exception when foreign_key_violation then
    perform pg_temp.check('evidence cannot cite a source belonging to another case', true);
  end;

  begin
    insert into public.evidence (case_id, claim_id, source_id, classification)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'c1c1c1c1-0000-0000-0000-000000000001',
            'a5a5a5a5-0000-0000-0000-000000000001', 'supports');
    perform pg_temp.check('evidence must not attach to a claim in another case', false);
  exception when foreign_key_violation then
    perform pg_temp.check('evidence cannot attach to a claim belonging to another case', true);
  end;

  -- And the same link within one case is fine, so the constraint is isolating
  -- rather than simply refusing everything.
  insert into public.evidence (case_id, claim_id, source_id, classification, excerpt)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'a1a1a1a1-0000-0000-0000-000000000001',
          'a5a5a5a5-0000-0000-0000-000000000001', 'supports',
          'Award published 14 March 2026.');
  perform pg_temp.check('evidence within one case is accepted', true);
end $$;

do $$
begin
  -- §6: a source whose origin is unrecorded is not evidence of anything.
  begin
    insert into public.sources (case_id, kind, title, retrieved_from)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'other', 'Unsourced', '   ');
    perform pg_temp.check('a source with blank provenance must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a source cannot be created with blank provenance', true);
  end;

  begin
    insert into public.sources (case_id, kind, title)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'other', 'Unsourced');
    perform pg_temp.check('a source with no provenance must be refused', false);
  exception when not_null_violation then
    perform pg_temp.check('a source cannot be created with no provenance at all', true);
  end;
end $$;

do $$
declare v_status public.epistemic_status;
begin
  -- §3: claims are not facts. A claim nobody has assessed must not read as one
  -- that has been.
  select status into v_status from public.claims
  where id = 'a1a1a1a1-0000-0000-0000-000000000001';
  perform pg_temp.check('a new claim defaults to unknown, not to anything settled', v_status = 'unknown');
end $$;

do $$
begin
  -- §3: repeated copying is not independent corroboration. The same source
  -- supporting the same claim twice would make one source look like two.
  begin
    insert into public.evidence (case_id, claim_id, source_id, classification)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'a1a1a1a1-0000-0000-0000-000000000001',
            'a5a5a5a5-0000-0000-0000-000000000001', 'supports');
    perform pg_temp.check('a duplicate support row must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('one source cannot support one claim twice', true);
  end;

  -- The same source contradicting what it elsewhere supports is a real and
  -- interesting state, so it is allowed.
  insert into public.evidence (case_id, claim_id, source_id, classification)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'a1a1a1a1-0000-0000-0000-000000000001',
          'a5a5a5a5-0000-0000-0000-000000000001', 'contradicts');
  perform pg_temp.check('but it may both support and contradict, which is a finding', true);
end $$;

do $$
declare v_count integer;
begin
  -- Access is derived from the case, so a stranger sees no sources, claims or
  -- evidence of a private one.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

  select count(*) into v_count from public.sources;
  perform pg_temp.check('a stranger sees no sources of a private case', v_count = 0);
  select count(*) into v_count from public.claims;
  perform pg_temp.check('a stranger sees no claims of a private case', v_count = 0);
  select count(*) into v_count from public.evidence;
  perform pg_temp.check('a stranger sees no evidence of a private case', v_count = 0);

  reset role;
end $$;

do $$
declare v_count integer;
begin
  insert into public.case_collaborators (case_id, user_id, role, accepted_at)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '22222222-2222-2222-2222-222222222222', 'viewer', now());

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

  select count(*) into v_count from public.sources;
  perform pg_temp.check('a viewer on case A sees only case A''s sources', v_count = 1);

  -- Read is not write, here as on the case itself.
  insert into public.claims (case_id, statement)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A claim added by a viewer');
  perform pg_temp.check('a viewer must not be able to add a claim', false);
exception
  when insufficient_privilege then
    perform pg_temp.check('a viewer cannot add a claim', true);
  when others then
    perform pg_temp.check('a viewer cannot add a claim', sqlstate = '42501');
end $$;

reset role;

-- Structural assertion, for the reason recorded in harness.sql: FORCE cannot be
-- tested behaviourally by a superuser, and forcing it here would break the case
-- access predicates these policies call.
do $$
declare r record;
begin
  for r in
    select relname, relrowsecurity, relforcerowsecurity from pg_class
    where relname in ('sources', 'claims', 'evidence')
      and relnamespace = 'public'::regnamespace
  loop
    perform pg_temp.check(format('%s has RLS enabled', r.relname), r.relrowsecurity);
    perform pg_temp.check(format('%s does not force RLS', r.relname), not r.relforcerowsecurity);
  end loop;
end $$;

do $$
begin
  begin
    perform pg_temp.check('control: this assertion must fail', false);
    raise exception 'NEGATIVE CONTROL FAILED';
  exception when others then
    if position('NEGATIVE CONTROL FAILED' in sqlerrm) > 0 then raise; end if;
    raise notice 'ok: the harness can fail';
  end;
end $$;

rollback;
