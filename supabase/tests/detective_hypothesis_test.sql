-- Competing explanations. Run after harness.sql and the migrations.
--
-- The assertions worth reading first are the two absences: a hypothesis cannot
-- exist without a falsifier, and there is no column anywhere that ranks one
-- explanation above another. Both are refusals the specification asks for and
-- both are the kind a later migration adds back without meaning to.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'investigator@example.org'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'outsider@example.org')
on conflict (id) do nothing;

do $$
declare
  v_me     uuid := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  v_case   uuid;
  v_other  uuid;
  v_source uuid;
  v_alien  uuid;
  v_h1     uuid;
  v_h2     uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.cases (owner_id, title) values (v_me, 'The depot') returning id into v_case;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'testimony', 'Depot supervisor', 'https://example.org/a', v_me)
  returning id into v_source;

  insert into public.hypotheses (case_id, statement, falsifier, created_by)
  values (v_case, 'The driver left before 21:00.', 'A gate log placing the van inside after 21:00.', v_me)
  returning id into v_h1;
  perform pg_temp.check('a hypothesis can be stated and read back', v_h1 is not null);

  insert into public.hypotheses (case_id, statement, falsifier, assumptions, created_by)
  values (v_case, 'The driver never left.', 'Any independent sighting on the road.',
          array['The depot clock was accurate.'], v_me)
  returning id into v_h2;
  perform pg_temp.check('and it carries its stated assumptions',
    (select assumptions[1] from public.hypotheses where id = v_h2) = 'The depot clock was accurate.');
  perform pg_temp.check('an unstated assumption list is empty, not null',
    (select assumptions from public.hypotheses where id = v_h1) = '{}');

  -- The rule the table exists for.
  begin
    insert into public.hypotheses (case_id, statement, falsifier)
    values (v_case, 'A third party did it.', '   ') returning id into v_row;
    perform pg_temp.check('a hypothesis with no falsifier must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a hypothesis with a blank falsifier is refused', true);
  end;

  -- The same record bearing on two explanations, differently. This is why the
  -- link is its own table rather than a column on evidence.
  insert into public.hypothesis_evidence (case_id, hypothesis_id, source_id, classification, summary, created_by)
  values (v_case, v_h1, v_source, 'supports', 'Says the van went out about a quarter to nine.', v_me);
  insert into public.hypothesis_evidence (case_id, hypothesis_id, source_id, classification, summary, created_by)
  values (v_case, v_h2, v_source, 'contradicts', 'Says the van went out about a quarter to nine.', v_me);
  perform pg_temp.check('one record may support one explanation and contradict another',
    (select count(*) from public.hypothesis_evidence where source_id = v_source) = 2);

  -- Three statements from one witness are three records.
  insert into public.hypothesis_evidence (case_id, hypothesis_id, source_id, classification, summary, created_by)
  values (v_case, v_h1, v_source, 'supports', 'Names the driver by sight.', v_me);
  perform pg_temp.check('one source may bear on one hypothesis more than once',
    (select count(*) from public.hypothesis_evidence
     where hypothesis_id = v_h1 and source_id = v_source) = 2);

  -- But not identically twice, which is a double entry rather than corroboration.
  begin
    insert into public.hypothesis_evidence (case_id, hypothesis_id, source_id, classification, summary)
    values (v_case, v_h1, v_source, 'supports', 'Names the driver by sight.');
    perform pg_temp.check('the same record entered twice must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('the same record cannot be entered against one hypothesis twice', true);
  end;

  -- Isolation, the same as claim evidence carries.
  insert into public.cases (owner_id, title) values (v_me, 'Elsewhere') returning id into v_other;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_other, 'reporting', 'Another case entirely', 'https://example.org/z', v_me)
  returning id into v_alien;
  begin
    insert into public.hypothesis_evidence (case_id, hypothesis_id, source_id, classification, summary)
    values (v_case, v_h1, v_alien, 'supports', 'From a different investigation.');
    perform pg_temp.check('evidence from another case must be refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check('a source from another investigation cannot bear on this hypothesis', true);
  end;

  -- Deleting a hypothesis takes its links with it.
  delete from public.hypotheses where id = v_h2;
  perform pg_temp.check('deleting a hypothesis deletes what was linked to it',
    (select count(*) from public.hypothesis_evidence where hypothesis_id = v_h2) = 0);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls
-- ---------------------------------------------------------------------------

do $$
declare
  v_me     uuid := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  v_them   uuid := 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
  v_case   uuid;
  v_source uuid;
  v_h1     uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.cases (owner_id, title) values (v_me, 'Private') returning id into v_case;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'testimony', 'A witness', 'https://example.org/a', v_me) returning id into v_source;
  insert into public.hypotheses (case_id, statement, falsifier, created_by)
  values (v_case, 'Mine alone.', 'Something that would end it.', v_me) returning id into v_h1;

  perform set_config('request.jwt.claim.sub', v_them::text, true);

  perform pg_temp.check('a stranger sees no hypotheses of a private case',
    (select count(*) from public.hypotheses where case_id = v_case) = 0);
  perform pg_temp.check('nor what bears on them',
    (select count(*) from public.hypothesis_evidence where case_id = v_case) = 0);

  begin
    insert into public.hypotheses (case_id, statement, falsifier)
    values (v_case, 'Theirs.', 'Something.') returning id into v_row;
    perform pg_temp.check('a stranger stating a hypothesis must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot state a hypothesis in somebody else''s case', true);
  end;

  begin
    insert into public.hypothesis_evidence (case_id, hypothesis_id, source_id, classification, summary)
    values (v_case, v_h1, v_source, 'supports', 'Slipped in.') returning id into v_row;
    perform pg_temp.check('a stranger linking evidence must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot link evidence to a hypothesis', true);
  end;

  reset role;
end $$;

-- The absences, asserted so a later migration cannot reintroduce them quietly.
do $$
begin
  perform pg_temp.check('a falsifier is required, in the schema and not in the client',
    exists (select 1 from information_schema.columns
            where table_name = 'hypotheses' and column_name = 'falsifier'
              and is_nullable = 'NO'));

  -- No score, no confidence, no "leading" flag. A leaderboard of theories is
  -- the collapse into truth the epistemic model exists to prevent.
  perform pg_temp.check('nothing ranks one explanation above another',
    not exists (select 1 from information_schema.columns
                where table_name = 'hypotheses'
                  and column_name in ('score', 'rank', 'confidence', 'likelihood',
                                      'probability', 'is_leading', 'preferred')));

  perform pg_temp.check('the link has no update policy, so a reclassification is a new record',
    not exists (select 1 from pg_policies
                where tablename = 'hypothesis_evidence' and cmd = 'UPDATE'));

  perform pg_temp.check('hypotheses has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'hypotheses'));
  perform pg_temp.check('and does not force it',
    (select not relforcerowsecurity from pg_class where relname = 'hypotheses'));
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
