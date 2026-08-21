-- Behavioural tests for case privacy. Run after harness.sql and the migrations.
--
-- These assert refusals, not features. §18 requires that a private case stay
-- inaccessible even to somebody who knows its id, and the only way to believe
-- that is to have a test that goes and tries it.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- Four people. The ids are fixed so the assertions can name them.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.org'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@example.org'),
  ('33333333-3333-3333-3333-333333333333', 'editor@example.org'),
  ('44444444-4444-4444-4444-444444444444', 'stranger@example.org')
on conflict (id) do nothing;

insert into public.cases (id, owner_id, title, visibility) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'A private investigation', 'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '11111111-1111-1111-1111-111111111111', 'A published dossier', 'published');

insert into public.case_collaborators (case_id, user_id, role, accepted_at, invited_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
   'viewer', now(), '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'editor', now(), '11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------

do $$
declare v_count integer;
begin
  -- The headline requirement of §18, tested by a caller who has the id in hand.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

  select count(*) into v_count from public.cases
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform pg_temp.check(
    'a stranger holding the id of a private case sees nothing',
    v_count = 0
  );

  select count(*) into v_count from public.cases;
  perform pg_temp.check('and sees only the published case in a bare listing', v_count = 1);

  reset role;
end $$;

do $$
declare v_count integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

  select count(*) into v_count from public.cases
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform pg_temp.check('an accepted viewer can read the private case', v_count = 1);

  -- Read is not write. A viewer who can rename the investigation is not a
  -- viewer.
  update public.cases set title = 'Renamed by a viewer'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics v_count = row_count;
  perform pg_temp.check('a viewer cannot write to it', v_count = 0);

  reset role;
end $$;

do $$
declare v_count integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  update public.cases set question = 'What does the record allow us to say?'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics v_count = row_count;
  perform pg_temp.check('an editor can write', v_count = 1);

  -- §18 gives the owner case control. An editor may rewrite the dossier and
  -- may not destroy the investigation.
  delete from public.cases where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics v_count = row_count;
  perform pg_temp.check('an editor cannot delete the case', v_count = 0);

  reset role;
end $$;

do $$
declare v_count integer;
begin
  -- An invitation is not access. §18: invitation, acceptance, then access.
  insert into public.case_collaborators (case_id, user_id, role, invited_by)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '44444444-4444-4444-4444-444444444444', 'investigator',
          '11111111-1111-1111-1111-111111111111');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

  select count(*) into v_count from public.cases
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform pg_temp.check('an unaccepted invitation grants nothing', v_count = 0);

  reset role;

  update public.case_collaborators set accepted_at = now()
  where case_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '44444444-4444-4444-4444-444444444444';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  select count(*) into v_count from public.cases
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform pg_temp.check('accepting it grants access', v_count = 1);
  reset role;
end $$;

do $$
declare v_count integer;
begin
  -- Revocation has to bite immediately, not at the next login.
  delete from public.case_collaborators
  where case_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '22222222-2222-2222-2222-222222222222';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  select count(*) into v_count from public.cases
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform pg_temp.check('revoking a collaborator takes effect at once', v_count = 0);
  reset role;
end $$;

do $$
declare v_count integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

  -- Nobody may create a case owned by somebody else.
  begin
    insert into public.cases (owner_id, title)
    values ('11111111-1111-1111-1111-111111111111', 'A case in another name');
    perform pg_temp.check('inserting a case owned by another user must fail', false);
  exception when insufficient_privilege or others then
    perform pg_temp.check('a user cannot create a case owned by somebody else', true);
  end;

  reset role;
end $$;

do $$
declare v_count integer;
begin
  -- anon reaches the published case and nothing else.
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  select count(*) into v_count from public.cases;
  perform pg_temp.check('an anonymous caller sees only published cases', v_count = 1);

  select count(*) into v_count from public.cases
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  perform pg_temp.check('and can read the published one', v_count = 1);

  reset role;
end $$;

-- A structural assertion, because the behavioural one cannot be written here.
--
-- `force row level security` subjects the table owner to its own policies, and
-- a security definer function runs as the owner — so forcing it on a table that
-- case_role_of reads filters that function's own query to nothing, and the
-- failure presents as "the case does not exist" for everybody including the
-- owner.
--
-- That cannot be tested behaviourally in this harness: FORCE does not apply to
-- superusers, and these suites run as one. Supabase's postgres role is not a
-- superuser, so the trap is real there and invisible here. Asserting the schema
-- property directly is the honest substitute — it catches the mistake being
-- made, even though it cannot demonstrate the consequence.
do $$
declare r record;
begin
  for r in
    select relname, relrowsecurity, relforcerowsecurity
    from pg_class
    where relname in ('cases', 'case_collaborators')
      and relnamespace = 'public'::regnamespace
  loop
    perform pg_temp.check(
      format('%s has row level security enabled', r.relname),
      r.relrowsecurity
    );
    perform pg_temp.check(
      format('%s does NOT force it — a definer function reads this table', r.relname),
      not r.relforcerowsecurity
    );
  end loop;
end $$;

-- Negative controls. Without these the suite above proves only that queries run.
do $$
declare v_count integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  select count(*) into v_count from public.cases;
  perform pg_temp.check('control: the owner really can see both cases', v_count = 2);
  reset role;
end $$;

do $$
begin
  begin
    perform pg_temp.check('control: this assertion must fail', false);
    raise exception 'NEGATIVE CONTROL FAILED: a false assertion reported as passing';
  exception when others then
    if position('NEGATIVE CONTROL FAILED' in sqlerrm) > 0 then raise; end if;
    raise notice 'ok: the harness can fail (%)', left(sqlerrm, 42);
  end;
end $$;

rollback;
