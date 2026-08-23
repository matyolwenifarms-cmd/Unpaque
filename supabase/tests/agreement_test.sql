-- A second coder, and coding blind. Run after harness.sql and the migrations.
--
-- The assertions worth reading first are the blind ones. Inter-coder agreement
-- measures whether two people applying the same codebook reach the same
-- places; if the second coder can see the first coder's highlights they reach
-- the same places because they were shown them, and kappa measures nothing.
-- So `codings_select` is narrowed while a study is blind, and unblinding is
-- one-way.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'amy@example.org'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ben@example.org'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cleo@example.org')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Inviting, accepting, and coding blind
-- ---------------------------------------------------------------------------

do $$
declare
  v_amy   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_ben   uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_study uuid;
  v_doc   uuid;
  v_code  uuid;
  v_row   uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_amy::text, true);

  insert into public.studies (owner_id, title) values (v_amy, 'Waiting') returning id into v_study;
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P1', 'The cost was the first thing.' || chr(10) || chr(10) || 'Nobody trusted it.', 1)
  returning id into v_doc;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'cost', 'd', 'w', 'n') returning id into v_code;

  perform pg_temp.check('a new study is blind by default',
    (select blind_coding from public.studies where id = v_study));

  perform public.apply_code(v_doc, v_code, 4, 8, null);

  -- Case matters here: an owner who types Ben@Example.org must invite the same
  -- person the token later resolves to.
  perform public.invite_coder(v_study, '  Ben@Example.ORG  ');
  perform pg_temp.check('an invitation is recorded lower-cased and trimmed',
    (select count(*) from public.study_coders
     where study_id = v_study and email = 'ben@example.org') = 1);
  perform pg_temp.check('and grants nothing until it is accepted',
    (select accepted_at is null and user_id is null from public.study_coders
     where study_id = v_study and email = 'ben@example.org'));

  -- Ben, before accepting.
  perform set_config('request.jwt.claim.sub', v_ben::text, true);
  perform pg_temp.check('an invited coder cannot see the study yet',
    (select count(*) from public.studies where id = v_study) = 0);
  perform pg_temp.check('but can see that they were invited',
    (select count(*) from public.study_coders where study_id = v_study) = 1);
  perform pg_temp.check('and can see which study it is, by name',
    (select title from public.pending_invitations() where study_id = v_study) = 'Waiting');
  perform pg_temp.check('and who invited them',
    (select invited_by_email from public.pending_invitations() where study_id = v_study)
      = 'amy@example.org');

  perform pg_temp.check('accepting says it did something',
    public.accept_coder_invitation(v_study));
  perform pg_temp.check('and now the study is readable',
    (select count(*) from public.studies where id = v_study) = 1);
  perform pg_temp.check('with its transcripts and its codebook',
    (select count(*) from public.study_documents where study_id = v_study) = 1
    and (select count(*) from public.codes where study_id = v_study) = 1);

  -- The rule the whole migration is for.
  perform pg_temp.check('a second coder cannot see the first coder''s codings while blind',
    (select count(*) from public.codings where study_id = v_study) = 0);

  v_row := public.apply_code(v_doc, v_code, 31, 37, null);
  perform pg_temp.check('but can code the same transcript', v_row is not null);
  perform pg_temp.check('and sees their own coding',
    (select count(*) from public.codings where study_id = v_study) = 1);
  perform pg_temp.check('which is attributed to them, not to the owner',
    (select coder_id from public.codings where id = v_row) = v_ben);

  -- The owner is a coder too, and is equally blind.
  perform set_config('request.jwt.claim.sub', v_amy::text, true);
  perform pg_temp.check('the owner is blind to the second coder as well',
    (select count(*) from public.codings where study_id = v_study) = 1);

  perform public.unblind_study(v_study);
  perform pg_temp.check('unblinding shows both sets',
    (select count(*) from public.codings where study_id = v_study) = 2);
  perform set_config('request.jwt.claim.sub', v_ben::text, true);
  perform pg_temp.check('to the second coder as well',
    (select count(*) from public.codings where study_id = v_study) = 2);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- What a second coder may not do
-- ---------------------------------------------------------------------------

do $$
declare
  v_amy   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_ben   uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_study uuid;
  v_doc   uuid;
  v_code  uuid;
  v_amys  uuid;
  v_row   uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_amy::text, true);
  insert into public.studies (owner_id, title) values (v_amy, 'Second') returning id into v_study;
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P1', 'The cost was the first thing.', 1) returning id into v_doc;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'cost', 'd', 'w', 'n') returning id into v_code;
  v_amys := public.apply_code(v_doc, v_code, 4, 8, null);
  perform public.invite_coder(v_study, 'ben@example.org');

  perform set_config('request.jwt.claim.sub', v_ben::text, true);
  perform public.accept_coder_invitation(v_study);

  -- A coder applies the codebook. A coder who can rewrite it while coding is
  -- not a second coder, and the agreement figure measures a moving target.
  begin
    insert into public.codes (study_id, label, definition, apply_when, not_when)
    values (v_study, 'mine', 'd', 'w', 'n') returning id into v_row;
    perform pg_temp.check('a second coder adding a code must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a second coder cannot add to the codebook', true);
  end;

  -- Nothing is raised here, and that is worth stating rather than discovering:
  -- an update whose USING clause matches no rows is a no-op, not an error. The
  -- assertion has to be that the codebook did not change.
  update public.codes set label = 'renamed' where id = v_code;
  perform pg_temp.check('a second coder cannot edit the codebook',
    (select label from public.codes where id = v_code) = 'cost');

  begin
    insert into public.study_documents (study_id, name, body, coding_position)
    values (v_study, 'P2', 'more text', 2) returning id into v_row;
    perform pg_temp.check('a second coder adding a transcript must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a second coder cannot add a transcript', true);
  end;

  begin
    perform public.unblind_study(v_study);
    perform pg_temp.check('a second coder unblinding must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a second coder cannot unblind the study', true);
  end;

  begin
    perform public.invite_coder(v_study, 'cleo@example.org');
    perform pg_temp.check('a second coder inviting must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a second coder cannot invite a third', true);
  end;

  -- Deleting somebody else's coding, which would be tidying the data the
  -- agreement figure is computed from. Nothing is deleted rather than an
  -- exception raised: a delete filtered to no rows by RLS is a no-op.
  delete from public.codings where id = v_amys;
  perform set_config('request.jwt.claim.sub', v_amy::text, true);
  perform pg_temp.check('a coder cannot delete another coder''s coding',
    (select count(*) from public.codings where id = v_amys) = 1);

  -- And nor can the owner.
  perform public.unblind_study(v_study);
  perform set_config('request.jwt.claim.sub', v_ben::text, true);
  v_row := public.apply_code(v_doc, v_code, 0, 3, null);
  perform set_config('request.jwt.claim.sub', v_amy::text, true);
  delete from public.codings where id = v_row;
  perform pg_temp.check('nor may the owner delete the second coder''s work',
    (select count(*) from public.codings where id = v_row) = 1);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Unblinding is one-way
-- ---------------------------------------------------------------------------

do $$
declare
  v_amy   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_study uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_amy::text, true);
  insert into public.studies (owner_id, title) values (v_amy, 'One way') returning id into v_study;
  perform public.unblind_study(v_study);

  begin
    update public.studies set blind_coding = true where id = v_study;
    perform pg_temp.check('re-blinding must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a study cannot be re-blinded once it has been unblinded', true);
  end;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls. Nothing above is evidence unless these refuse.
-- ---------------------------------------------------------------------------

do $$
declare
  v_amy   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_cleo  uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_study uuid;
  v_doc   uuid;
  v_code  uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_amy::text, true);
  insert into public.studies (owner_id, title) values (v_amy, 'Not for Cleo') returning id into v_study;
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P1', 'The cost was the first thing.', 1) returning id into v_doc;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'cost', 'd', 'w', 'n') returning id into v_code;
  perform public.invite_coder(v_study, 'ben@example.org');

  -- Cleo was never invited.
  perform set_config('request.jwt.claim.sub', v_cleo::text, true);

  perform pg_temp.check('an uninvited person sees nothing of the study',
    (select count(*) from public.studies where id = v_study) = 0);
  perform pg_temp.check('and cannot see who was invited to it',
    (select count(*) from public.study_coders where study_id = v_study) = 0);
  perform pg_temp.check('accepting an invitation addressed to somebody else does nothing',
    public.accept_coder_invitation(v_study) = false);
  perform pg_temp.check('and no invitation is listed for them',
    (select count(*) from public.pending_invitations()) = 0);
  perform pg_temp.check('and grants nothing',
    (select count(*) from public.studies where id = v_study) = 0);

  begin
    perform public.apply_code(v_doc, v_code, 4, 8, null);
    perform pg_temp.check('an uninvited person coding must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('an uninvited person cannot code the transcript', true);
  end;

  reset role;
end $$;

-- The rules that are absences rather than statements, asserted so a later
-- migration cannot quietly reintroduce them.
do $$
begin
  perform pg_temp.check('study_coders has no insert policy, so invite_coder() is the only way in',
    not exists (select 1 from pg_policies where tablename = 'study_coders' and cmd = 'INSERT'));
  perform pg_temp.check('study_coders has no update policy, so an acceptance cannot be forged',
    not exists (select 1 from pg_policies where tablename = 'study_coders' and cmd = 'UPDATE'));

  -- What actually stops an unaccepted invitation granting anything.
  --
  -- The `accepted_at is not null` clause in can_read_study reads like the
  -- guard and is not: user_id is null until acceptance, so the join fails
  -- first. Removing that clause leaves every assertion in this suite green,
  -- which is how a check stops being evidence. The constraint below is the
  -- mechanism, so it is what gets asserted — an invitation carrying a user_id
  -- but no acceptance is not a representable row.
  begin
    insert into public.study_coders (study_id, email, user_id, accepted_at)
    values (
      (select id from public.studies limit 1),
      'forged@example.org',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      null
    );
    perform pg_temp.check('a half-accepted invitation must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an invitation cannot carry a user without an acceptance', true);
  end;

  begin
    insert into public.study_coders (study_id, email, user_id, accepted_at)
    values ((select id from public.studies limit 1), 'forged@example.org', null, now());
    perform pg_temp.check('an acceptance by nobody must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an acceptance cannot be recorded without a user', true);
  end;
  perform pg_temp.check('studies has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'studies'));
  perform pg_temp.check('studies does NOT force it — definer functions read this table',
    (select not relforcerowsecurity from pg_class where relname = 'studies'));
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
