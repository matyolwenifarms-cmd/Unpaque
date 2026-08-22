-- The qualitative workspace, written and refused. Run after harness.sql and
-- the migrations.
--
-- Two things here are not ordinary CRUD checks and are the reason the suite
-- exists at all:
--
--   * `codings` has no insert policy. Every coding goes through apply_code(),
--     which is where the offsets are checked against the document they point
--     into. A test that only proved codings can be written would pass against
--     an insert policy that let any offset through.
--   * The bound is in UTF-16 code units, because the offsets are JavaScript's.
--     The emoji case is a real transcript problem and doubles as an encoding
--     canary: under a SQL_ASCII database the escape range in apply_code()
--     silently matches nothing and the last valid offset is refused.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'coder@example.org'),
  ('22222222-2222-2222-2222-222222222222', 'outsider@example.org')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The whole write path, as the browser performs it
-- ---------------------------------------------------------------------------

do $$
declare
  v_me       uuid := '11111111-1111-1111-1111-111111111111';
  v_study    uuid;
  v_doc_a    uuid;
  v_doc_b    uuid;
  v_category uuid;
  v_cost     uuid;
  v_trust    uuid;
  v_coding   uuid;
  v_theme    uuid;
  v_body     text := 'The cost was the first thing everyone mentioned, and nobody trusted the process.';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  -- `returning id` throughout: it is what supabase-js sends, and it also
  -- applies the select policy to the row handed back, which is a stricter test
  -- than a bare insert and is exactly where Detect's case creation broke.
  insert into public.studies (owner_id, title, question)
  values (v_me, 'How people talk about waiting', 'What makes a wait feel unfair?')
  returning id into v_study;
  perform pg_temp.check('an owner can create a study and read it back', v_study is not null);

  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P1', v_body, 1) returning id into v_doc_a;
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P2', 'Cost came up again, though the process seemed fine.', 2)
  returning id into v_doc_b;
  perform pg_temp.check('transcripts can be added', v_doc_a is not null and v_doc_b is not null);

  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'Barriers', 'Things that got in the way.', 'Any obstacle.', 'Not a preference.')
  returning id into v_category;
  insert into public.codes (study_id, label, definition, apply_when, not_when, parent_id)
  values (v_study, 'cost', 'What it costs them.', 'Money or effort.', 'Not a passing mention.', v_category)
  returning id into v_cost;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'trust', 'Confidence in the process.', 'Trust in the process.', 'Not trust in a person.')
  returning id into v_trust;
  perform pg_temp.check('a codebook can be written, with one level of grouping',
    v_cost is not null and v_trust is not null);

  v_coding := public.apply_code(v_doc_a, v_cost, 4, 8, 'the first thing said');
  perform pg_temp.check('a code can be applied to a passage', v_coding is not null);
  perform pg_temp.check('and it is stored as offsets, not as a copy of the text',
    (select start_offset = 4 and end_offset = 8 from public.codings where id = v_coding));
  perform pg_temp.check('the extract is sliced back out of the document',
    (select substr(d.body, c.start_offset + 1, c.end_offset - c.start_offset)
     from public.codings c join public.study_documents d on d.id = c.document_id
     where c.id = v_coding) = 'cost');
  perform pg_temp.check('and it records who applied it',
    (select coder_id from public.codings where id = v_coding) = v_me);

  -- Overlap is ordinary here, unlike the diagnostic's annotations: two codes
  -- over one sentence is a researcher saying it is both.
  perform public.apply_code(v_doc_a, v_trust, 0, 20, null);
  perform pg_temp.check('two codes may cover the same stretch',
    (select count(*) from public.codings where document_id = v_doc_a) = 2);

  insert into public.theme_drafts (study_id, label, statement)
  values (v_study, 'What it costs you', 'Money comes first.') returning id into v_theme;
  insert into public.theme_draft_codes (theme_id, code_id) values (v_theme, v_cost);
  perform pg_temp.check('a theme draft gathers codes',
    (select count(*) from public.theme_draft_codes where theme_id = v_theme) = 1);

  -- The order is a claim about the analysis, so it is set rather than inferred.
  perform public.set_coding_order(v_study, array[v_doc_b, v_doc_a]);
  perform pg_temp.check('the coding order can be rewritten',
    (select coding_position from public.study_documents where id = v_doc_b) = 1
    and (select coding_position from public.study_documents where id = v_doc_a) = 2);

  -- Removing a code takes its codings with it. Extracts on screen under a code
  -- with no definition is the state the codebook exists to prevent.
  delete from public.codes where id = v_trust;
  perform pg_temp.check('deleting a code deletes what was coded to it',
    (select count(*) from public.codings where document_id = v_doc_a) = 1);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Offsets. The reason apply_code() exists.
-- ---------------------------------------------------------------------------

do $$
declare
  v_me     uuid := '11111111-1111-1111-1111-111111111111';
  v_study  uuid;
  v_other  uuid;
  v_doc    uuid;
  v_code   uuid;
  v_alien  uuid;
  v_emoji  uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.studies (owner_id, title) values (v_me, 'Bounds') returning id into v_study;
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P1', '0123456789', 1) returning id into v_doc;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'c', 'd', 'w', 'n') returning id into v_code;

  perform pg_temp.check('the last character of a document can be coded',
    public.apply_code(v_doc, v_code, 9, 10, null) is not null);

  begin
    v_row := public.apply_code(v_doc, v_code, 9, 11, null);
    perform pg_temp.check('an offset past the end must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an offset past the end of the document is refused', true);
  end;

  begin
    v_row := public.apply_code(v_doc, v_code, -1, 4, null);
    perform pg_temp.check('a negative offset must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a negative offset is refused', true);
  end;

  begin
    v_row := public.apply_code(v_doc, v_code, 5, 5, null);
    perform pg_temp.check('an empty selection must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an empty selection is refused', true);
  end;

  begin
    v_row := public.apply_code(v_doc, v_code, 8, 4, null);
    perform pg_temp.check('a backwards selection must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a backwards selection is refused', true);
  end;

  -- The offsets are JavaScript's, and JavaScript counts an astral character as
  -- two. 'ab' + emoji + 'cd' is length 6 there and char_length 5 here, so a
  -- bound taken from char_length() would refuse the last character. If this
  -- assertion fails, suspect the database encoding before the arithmetic.
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P2', 'ab' || U&'\+01F600' || 'cd', 2) returning id into v_emoji;
  perform pg_temp.check('an offset counted the way JavaScript counts it is accepted',
    public.apply_code(v_emoji, v_code, 4, 6, null) is not null);
  begin
    v_row := public.apply_code(v_emoji, v_code, 4, 7, null);
    perform pg_temp.check('and one past even that must be refused', false);
  exception when check_violation then
    perform pg_temp.check('and one past even that is refused', true);
  end;

  -- A code from a different study pointed at this document would produce an
  -- extract nobody ever coded, from a codebook nobody wrote.
  insert into public.studies (owner_id, title) values (v_me, 'Elsewhere') returning id into v_other;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_other, 'alien', 'd', 'w', 'n') returning id into v_alien;
  begin
    v_row := public.apply_code(v_doc, v_alien, 0, 4, null);
    perform pg_temp.check('a code from another study must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a code from another study cannot be applied here', true);
  end;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- The rules the codebook is shaped around
-- ---------------------------------------------------------------------------

do $$
declare
  v_me       uuid := '11111111-1111-1111-1111-111111111111';
  v_study    uuid;
  v_category uuid;
  v_child    uuid;
  v_row      uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.studies (owner_id, title) values (v_me, 'Codebook rules') returning id into v_study;

  -- The one departure from how most tools do this. An optional exclusion field
  -- is an empty exclusion field, and then two coders disagreeing have nothing
  -- in the codebook to settle it.
  begin
    insert into public.codes (study_id, label, definition, apply_when, not_when)
    values (v_study, 'cost', 'What it costs.', 'Money.', '   ') returning id into v_row;
    perform pg_temp.check('a code with no exclusion must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a code with a blank "not when" is refused', true);
  end;

  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'Barriers', 'd', 'w', 'n') returning id into v_category;
  insert into public.codes (study_id, label, definition, apply_when, not_when, parent_id)
  values (v_study, 'cost', 'd', 'w', 'n', v_category) returning id into v_child;

  -- Depth. A tree deeper than one level is a filing system, not an analysis.
  begin
    insert into public.codes (study_id, label, definition, apply_when, not_when, parent_id)
    values (v_study, 'hidden cost', 'd', 'w', 'n', v_child) returning id into v_row;
    perform pg_temp.check('a grandchild code must be refused', false);
  exception when check_violation then
    perform pg_temp.check('codes group one level deep', true);
  end;

  -- The other direction, which is the one that gets forgotten: the depth rule
  -- must hold on update, not only on insert.
  begin
    update public.codes set parent_id = v_child where id = v_category;
    perform pg_temp.check('filing a category under its own child must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a code with children cannot itself be filed inside one', true);
  end;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls. Nothing above is evidence unless these refuse.
-- ---------------------------------------------------------------------------

do $$
declare
  v_me     uuid := '11111111-1111-1111-1111-111111111111';
  v_them   uuid := '22222222-2222-2222-2222-222222222222';
  v_study  uuid;
  v_doc    uuid;
  v_code   uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.studies (owner_id, title) values (v_me, 'Mine alone') returning id into v_study;
  insert into public.study_documents (study_id, name, body, coding_position)
  values (v_study, 'P1', 'The cost was the first thing.', 1) returning id into v_doc;
  insert into public.codes (study_id, label, definition, apply_when, not_when)
  values (v_study, 'cost', 'd', 'w', 'n') returning id into v_code;

  -- Somebody else entirely.
  perform set_config('request.jwt.claim.sub', v_them::text, true);

  -- Named exception classes, not `when others`: catching everything would let
  -- a typo in a column name pass as a refusal.
  begin
    insert into public.studies (owner_id, title) values (v_me, 'A study in another name')
    returning id into v_row;
    perform pg_temp.check('a study owned by somebody else must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a study cannot be created in somebody else''s name', true);
  end;

  begin
    insert into public.study_documents (study_id, name, body, coding_position)
    values (v_study, 'Slipped in', 'text', 9) returning id into v_row;
    perform pg_temp.check('a transcript in a stranger''s study must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot add a transcript', true);
  end;

  begin
    v_row := public.apply_code(v_doc, v_code, 4, 8, null);
    perform pg_temp.check('coding a stranger''s transcript must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot code somebody else''s transcript', true);
  end;

  begin
    perform public.set_coding_order(v_study, array[v_doc]);
    perform pg_temp.check('reordering a stranger''s study must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot rewrite the coding order', true);
  end;

  perform pg_temp.check('a stranger cannot even see the study',
    (select count(*) from public.studies where id = v_study) = 0);
  perform pg_temp.check('nor its transcripts',
    (select count(*) from public.study_documents where study_id = v_study) = 0);
  perform pg_temp.check('nor its codebook',
    (select count(*) from public.codes where study_id = v_study) = 0);

  reset role;
end $$;

-- There is no insert policy on codings, and that is load-bearing rather than
-- an oversight: it is what forces every coding through the bound check.
do $$
begin
  perform pg_temp.check('codings has a select policy',
    exists (select 1 from pg_policies where tablename = 'codings' and cmd = 'SELECT'));
  perform pg_temp.check('and no insert policy, so apply_code() is the only way in',
    not exists (select 1 from pg_policies where tablename = 'codings' and cmd = 'INSERT'));
  perform pg_temp.check('and no update policy, so an offset is never moved',
    not exists (select 1 from pg_policies where tablename = 'codings' and cmd = 'UPDATE'));
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
