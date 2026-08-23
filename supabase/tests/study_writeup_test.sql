-- What a study keeps for its write-up. Run after harness.sql and the migrations.
--
-- Three tables' worth of jsonb, and the assertions that matter are the ones
-- about who may write it and about the same work not being addable twice. The
-- shape of the jsonb is checked in TypeScript, on read, because that is where
-- the types that define it live — see writeup/stored.ts.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'author@example.org'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'coder@example.org'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'stranger@example.org')
on conflict (id) do nothing;

do $$
declare
  v_me     uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_coder  uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_study  uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.studies (owner_id, title) values (v_me, 'Waiting') returning id into v_study;

  -- The declaration lives on the study. The statement is derived from it and
  -- deliberately not stored: a stored copy drifts from the declaration it
  -- claims to describe.
  update public.studies
  set method_declaration = '{"paradigm":"interpretivism","sampling":"purposive"}'::jsonb
  where id = v_study;
  perform pg_temp.check('a method declaration is kept on the study',
    (select method_declaration->>'paradigm' from public.studies where id = v_study)
      = 'interpretivism');

  insert into public.study_findings (study_id, finding, dataset_name, position)
  values (v_study, '{"test":"Welch''s t-test","p":0.041,"n":40}'::jsonb, 'cohort.csv', 1)
  returning id into v_row;
  perform pg_temp.check('an analysis is kept, with the file it was run on', v_row is not null);
  perform pg_temp.check('and the dataset itself is not stored anywhere',
    not exists (select 1 from information_schema.columns
                where table_name = 'study_findings' and column_name in ('rows', 'data', 'csv')));

  insert into public.study_references (study_id, reference, doi)
  values (v_study, '{"title":"Waiting and trust"}'::jsonb, '10.1234/abc')
  returning id into v_row;
  perform pg_temp.check('a reference is kept for the study', v_row is not null);

  -- One work, once.
  begin
    insert into public.study_references (study_id, reference, doi)
    values (v_study, '{"title":"Waiting and trust, again"}'::jsonb, '10.1234/abc')
    returning id into v_row;
    perform pg_temp.check('the same DOI twice must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('the same work cannot be added to a study twice by DOI', true);
  end;

  begin
    insert into public.study_references (study_id, reference, provider_id) values
      (v_study, '{"title":"A"}'::jsonb, 'W123'),
      (v_study, '{"title":"A again"}'::jsonb, 'W123');
    perform pg_temp.check('the same provider id twice must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('nor twice by provider id', true);
  end;

  -- A record with neither identifier is legitimate and must still be storable.
  insert into public.study_references (study_id, reference) values
    (v_study, '{"title":"No identifiers at all"}'::jsonb),
    (v_study, '{"title":"Nor here"}'::jsonb);
  perform pg_temp.check('two records with no identifiers are both kept',
    (select count(*) from public.study_references
     where study_id = v_study and doi is null and provider_id is null) = 2);

  -- A second coder reads, and does not write. The same division as the
  -- codebook: they apply a codebook, they do not run the author's analyses.
  perform public.invite_coder(v_study, 'coder@example.org');
  perform set_config('request.jwt.claim.sub', v_coder::text, true);
  perform public.accept_coder_invitation(v_study);

  perform pg_temp.check('a second coder can read the analyses',
    (select count(*) from public.study_findings where study_id = v_study) = 1);
  begin
    insert into public.study_findings (study_id, finding, position)
    values (v_study, '{"test":"mine"}'::jsonb, 2) returning id into v_row;
    perform pg_temp.check('a second coder adding an analysis must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a second coder cannot add an analysis', true);
  end;
  begin
    insert into public.study_references (study_id, reference)
    values (v_study, '{"title":"mine"}'::jsonb) returning id into v_row;
    perform pg_temp.check('a second coder adding a reference must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a second coder cannot add a reference', true);
  end;

  -- An update whose USING clause matches nothing is a no-op rather than an
  -- error, so the assertion is that nothing changed.
  update public.studies set method_declaration = '{"paradigm":"positivism"}'::jsonb
  where id = v_study;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  perform pg_temp.check('a second coder cannot rewrite the method declaration',
    (select method_declaration->>'paradigm' from public.studies where id = v_study)
      = 'interpretivism');

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls
-- ---------------------------------------------------------------------------

do $$
declare
  v_me       uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_stranger uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_study    uuid;
  v_row      uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.studies (owner_id, title) values (v_me, 'Private') returning id into v_study;
  insert into public.study_findings (study_id, finding, position)
  values (v_study, '{"test":"t"}'::jsonb, 1);
  insert into public.study_references (study_id, reference, doi)
  values (v_study, '{"title":"x"}'::jsonb, '10.9/z');

  perform set_config('request.jwt.claim.sub', v_stranger::text, true);
  perform pg_temp.check('a stranger sees none of the analyses',
    (select count(*) from public.study_findings where study_id = v_study) = 0);
  perform pg_temp.check('nor any of the references',
    (select count(*) from public.study_references where study_id = v_study) = 0);
  perform pg_temp.check('nor the method declaration',
    (select count(*) from public.studies where id = v_study) = 0);

  begin
    insert into public.study_findings (study_id, finding, position)
    values (v_study, '{"test":"theirs"}'::jsonb, 9) returning id into v_row;
    perform pg_temp.check('a stranger writing an analysis must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot write an analysis into somebody else''s study', true);
  end;

  reset role;
end $$;

-- Absences, asserted so a later migration cannot quietly reintroduce them.
do $$
begin
  perform pg_temp.check('study_findings has no update policy — a finding is re-run, not edited',
    not exists (select 1 from pg_policies where tablename = 'study_findings' and cmd = 'UPDATE'));
  perform pg_temp.check('study_references has no update policy — a reference is what the provider returned',
    not exists (select 1 from pg_policies where tablename = 'study_references' and cmd = 'UPDATE'));
  perform pg_temp.check('study_findings has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'study_findings'));
  perform pg_temp.check('and does not force it',
    (select not relforcerowsecurity from pg_class where relname = 'study_findings'));
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
