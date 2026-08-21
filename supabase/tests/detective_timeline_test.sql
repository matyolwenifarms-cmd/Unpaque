-- Timeline events and contradiction records: §9 and §10 as constraints.
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
  ('44444444-4444-4444-4444-444444444444', 'stranger@example.org')
on conflict (id) do nothing;

insert into public.cases (id, owner_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Case A'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Case B');

insert into public.sources (id, case_id, kind, title, retrieved_from) values
  ('a5a5a5a5-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'testimony', 'A statement', 'interview transcript, 14 June'),
  ('a5a5a5a5-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'video', 'CCTV footage', 'operator export, camera 4'),
  ('c5c5c5c5-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'reporting', 'A report in another case', 'https://paper.example.org/story');

-- ---------------------------------------------------------------------------

do $$
begin
  -- §9: an unknown date is a legitimate timeline entry, and must carry no
  -- placeholder. A placeholder sorts to the epoch and reads as a finding.
  insert into public.events (case_id, source_id, label, certainty, origin)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a5a5a5a5-0000-0000-0000-000000000001',
          'A meeting nobody can date', 'unknown', 'account');
  perform pg_temp.check('an event with an unknown date is accepted with no time', true);

  begin
    insert into public.events (case_id, source_id, label, certainty, origin, occurred_at)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a5a5a5a5-0000-0000-0000-000000000001',
            'Claims to be undated while carrying a date', 'unknown', 'account', now());
    perform pg_temp.check('an unknown-certainty event with a date must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an event cannot claim unknown while carrying a date', true);
  end;

  begin
    insert into public.events (case_id, source_id, label, certainty, origin)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a5a5a5a5-0000-0000-0000-000000000001',
            'Confirmed but undated', 'confirmed', 'recording');
    perform pg_temp.check('a confirmed event with no date must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an event cannot be confirmed with no date at all', true);
  end;

  begin
    insert into public.events (case_id, source_id, label, certainty, origin, occurred_at, tolerance_minutes)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a5a5a5a5-0000-0000-0000-000000000001',
            'Confirmed with a tolerance', 'confirmed', 'recording', now(), 60);
    perform pg_temp.check('a tolerance on a confirmed time must be refused', false);
  exception when check_violation then
    perform pg_temp.check('only an approximate time may carry a tolerance', true);
  end;
end $$;

do $$
begin
  -- The isolation property again, on a different table.
  begin
    insert into public.events (case_id, source_id, label, certainty, origin, occurred_at)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c5c5c5c5-0000-0000-0000-000000000001',
            'An event citing another case''s source', 'confirmed', 'document', now());
    perform pg_temp.check('an event citing another case must be refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check('an event cannot cite a source in another case', true);
  end;
end $$;

do $$
declare v_explanations jsonb := jsonb_build_array(
  jsonb_build_object('summary', 'The clock is wrong.', 'distinguishedBy', 'The system time source.'),
  jsonb_build_object('summary', 'Both are accurate and describe different moments.',
                     'distinguishedBy', 'Continuous coverage between the two times.')
);
begin
  insert into public.contradictions
    (case_id, type, source_a, source_b, difference, explanations, significance)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'temporal',
          'a5a5a5a5-0000-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-000000000002',
          '20:00 against 20:37 — 37 minutes apart', v_explanations,
          'Which is right determines what else was possible.');
  perform pg_temp.check('a complete contradiction record is accepted', true);

  -- §10, and the same rule the engine applies in recordProblems(): a single
  -- explanation is a conclusion with extra steps.
  begin
    insert into public.contradictions
      (case_id, type, source_a, source_b, difference, explanations, significance)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direct',
            'a5a5a5a5-0000-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-000000000002',
            'A against B', jsonb_build_array(v_explanations -> 0), 'It matters.');
    perform pg_temp.check('a single-explanation record must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a contradiction with one explanation cannot be stored', true);
  end;

  begin
    insert into public.contradictions
      (case_id, type, source_a, source_b, difference, explanations, significance)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direct',
            'a5a5a5a5-0000-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-000000000002',
            'A against B',
            jsonb_build_array(
              jsonb_build_object('summary', 'Something.', 'distinguishedBy', ''),
              v_explanations -> 1),
            'It matters.');
    perform pg_temp.check('an unsettleable explanation must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an explanation nothing could settle cannot be stored', true);
  end;

  begin
    insert into public.contradictions
      (case_id, type, source_a, source_b, difference, explanations, significance)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direct',
            'a5a5a5a5-0000-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-000000000001',
            'A against itself', v_explanations, 'It matters.');
    perform pg_temp.check('a source contradicting itself must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a source cannot contradict itself', true);
  end;

  -- §10 makes verification a human act. A verified record with nobody attached
  -- is an assertion about an assertion.
  begin
    insert into public.contradictions
      (case_id, type, source_a, source_b, difference, explanations, significance, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direct',
            'a5a5a5a5-0000-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-000000000002',
            'A against B', v_explanations, 'It matters.', 'verified');
    perform pg_temp.check('an unattributed verification must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a contradiction cannot be verified by nobody', true);
  end;

  insert into public.contradictions
    (case_id, type, source_a, source_b, difference, explanations, significance,
     status, verified_by, verified_at)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direct',
          'a5a5a5a5-0000-0000-0000-000000000001', 'a5a5a5a5-0000-0000-0000-000000000002',
          'A against B, verified', v_explanations, 'It matters.',
          'verified', '11111111-1111-1111-1111-111111111111', now());
  perform pg_temp.check('a verification attributed to a person is accepted', true);
end $$;

do $$
declare v_status public.contradiction_status;
begin
  select status into v_status from public.contradictions
  where difference = '20:00 against 20:37 — 37 minutes apart';
  perform pg_temp.check('a new contradiction defaults to potential', v_status = 'potential');
end $$;

do $$
declare v_count integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  select count(*) into v_count from public.events;
  perform pg_temp.check('a stranger sees no events of a private case', v_count = 0);
  select count(*) into v_count from public.contradictions;
  perform pg_temp.check('a stranger sees no contradictions of a private case', v_count = 0);
  reset role;
end $$;

do $$
declare r record;
begin
  for r in
    select relname, relrowsecurity, relforcerowsecurity from pg_class
    where relname in ('events', 'contradictions') and relnamespace = 'public'::regnamespace
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
