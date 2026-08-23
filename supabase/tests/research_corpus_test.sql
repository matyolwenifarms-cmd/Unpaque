-- The papers a study holds, and one paper set against another.
-- Run after harness.sql and the migrations.
--
-- The assertions that matter are the refusals: a page nobody can edit, a
-- relation with no reason behind it, a relation whose direction was quietly
-- normalised, and a locator that names a page without saying where on it.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'reviewer@example.org'),
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'stranger@example.org')
on conflict (id) do nothing;

do $$
declare
  v_me      uuid := 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1';
  v_study   uuid;
  v_other   uuid;
  v_a       uuid;
  v_b       uuid;
  v_page    uuid;
  v_row     uuid;
  v_count   integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.studies (owner_id, title) values (v_me, 'Framing') returning id into v_study;
  insert into public.studies (owner_id, title) values (v_me, 'Another') returning id into v_other;

  insert into public.study_sources (study_id, name, kind, doi, content_hash, page_count)
  values (v_study, 'Ndlovu 2019.pdf', 'pdf', '10.1234/jam.2019.45', repeat('a', 64), 12)
  returning id into v_a;
  perform pg_temp.check('a paper is held in the study', v_a is not null);

  insert into public.study_sources (study_id, name, kind, content_hash, page_count)
  values (v_study, 'Smith 2020.pdf', 'pdf', repeat('b', 64), 8)
  returning id into v_b;

  -- A scan with no text layer is a real state, and zero pages is how it says so.
  insert into public.study_sources (study_id, name, kind, content_hash, page_count)
  values (v_study, 'photocopy.pdf', 'pdf', repeat('c', 64), 0) returning id into v_row;
  perform pg_temp.check('a source with no text layer is still a source', v_row is not null);

  -- The same file twice is one paper.
  begin
    insert into public.study_sources (study_id, name, kind, content_hash)
    values (v_study, 'Ndlovu 2019 (copy).pdf', 'pdf', repeat('a', 64));
    perform pg_temp.check('a duplicate upload must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('the same file cannot be held twice in one study', true);
  end;

  -- ...but the same paper in a different study is a different row.
  insert into public.study_sources (study_id, name, kind, content_hash)
  values (v_other, 'Ndlovu 2019.pdf', 'pdf', repeat('a', 64)) returning id into v_row;
  perform pg_temp.check('the same paper may be held by two studies', v_row is not null);

  begin
    insert into public.study_sources (study_id, name, kind, content_hash, doi)
    values (v_study, 'bad.pdf', 'pdf', repeat('d', 64), 'not-a-doi');
    perform pg_temp.check('a malformed DOI must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a malformed DOI is refused by the database, not only the client', true);
  end;

  insert into public.study_source_pages (study_id, source_id, page_number, body)
  values (v_study, v_a, 3, 'Community broadcasters describe their obligations differently.')
  returning id into v_page;
  perform pg_temp.check('a page of extracted text is stored against its paper', v_page is not null);

  begin
    insert into public.study_source_pages (study_id, source_id, page_number, body)
    values (v_study, v_a, 3, 'a second version of page three');
    perform pg_temp.check('a repeated page number must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('one row per page, so page 3 is page 3', true);
  end;

  begin
    insert into public.study_source_pages (study_id, source_id, page_number, body)
    values (v_study, v_a, 0, 'page zero');
    perform pg_temp.check('page zero must be refused', false);
  exception when check_violation then
    perform pg_temp.check('page numbering starts at one, as a printout does', true);
  end;

  -- A page belongs to a paper *in this study*. Attached under another study's
  -- id it would be readable by whoever can read that study while holding the
  -- text of a paper in this one, which is the leak the composite key exists
  -- to close. A plain foreign key on source_id alone does not close it.
  begin
    insert into public.study_source_pages (study_id, source_id, page_number, body)
    values (v_other, v_a, 1, 'a page filed under the wrong study');
    perform pg_temp.check('a page under another study must be refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check('a page cannot be filed under a study its paper is not in', true);
  end;

  -- One paper against another.
  insert into public.study_relations (study_id, relation, source_id, target_id, basis)
  values (v_study, 'contradicts', v_a, v_b,
          'Ndlovu reports 40% and Smith reports 52% for the same 2018 sample.')
  returning id into v_row;
  perform pg_temp.check('a relation is recorded between two papers', v_row is not null);

  -- Direction is preserved. The reverse is a different statement, and both
  -- may be recorded, because A contradicting B is not B contradicting A.
  insert into public.study_relations (study_id, relation, source_id, target_id, basis)
  values (v_study, 'contradicts', v_b, v_a,
          'Smith reads the 2018 figures as superseding Ndlovu''s.')
  returning id into v_row;
  perform pg_temp.check('the reverse direction is a separate statement, not a duplicate',
    v_row is not null);

  select count(*) into v_count from public.study_relations
  where study_id = v_study and relation = 'contradicts';
  perform pg_temp.check('both directions are held, so neither was normalised away', v_count = 2);

  begin
    insert into public.study_relations (study_id, relation, source_id, target_id, basis)
    values (v_study, 'contradicts', v_a, v_b, 'said again');
    perform pg_temp.check('the same relation twice must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('one statement of a relation per direction', true);
  end;

  begin
    insert into public.study_relations (study_id, relation, source_id, target_id, basis)
    values (v_study, 'corroborates', v_a, v_a, 'a paper agreeing with itself');
    perform pg_temp.check('a self-relation must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a paper cannot corroborate itself', true);
  end;

  -- A free triple, and a basis genuinely under the limit. Written against the
  -- pair already used, the unique constraint fired first and the check
  -- constraint was never reached; written as 'they differ' it was eleven
  -- characters and would have been accepted.
  begin
    insert into public.study_relations (study_id, relation, source_id, target_id, basis)
    values (v_study, 'corroborates', v_a, v_b, 'differs');
    perform pg_temp.check('a seven-character basis must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a relation needs a reason, not a gesture at one', true);
  end;

  -- A locator is all three fields or none.
  insert into public.study_relations (study_id, relation, source_id, target_id, basis,
                                      stated_on_page, starts_at, ends_at)
  values (v_study, 'corroborates', v_b, v_a,
          'Smith reproduces the framing categories Ndlovu sets out.', v_page, 0, 20)
  returning id into v_row;
  perform pg_temp.check('a relation may point at where on the page it is stated', v_row is not null);

  begin
    insert into public.study_relations (study_id, relation, source_id, target_id, basis,
                                        stated_on_page)
    values (v_study, 'corroborates', v_a, v_b, 'a page but no offsets at all', v_page);
    perform pg_temp.check('half a locator must be refused', false);
  exception when check_violation then
    perform pg_temp.check('half a locator is refused: a page with no position on it', true);
  end;

  begin
    insert into public.study_relations (study_id, relation, source_id, target_id, basis,
                                        stated_on_page, starts_at, ends_at)
    values (v_study, 'corroborates', v_a, v_b, 'an inverted span on the page', v_page, 20, 5);
    perform pg_temp.check('an inverted span must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a span must end after it starts', true);
  end;

  -- Nothing crosses a study boundary.
  begin
    insert into public.study_relations (study_id, relation, source_id, target_id, basis)
    select v_study, 'corroborates', v_a, id,
           'a paper in a different study entirely, which cannot be reached'
    from public.study_sources where study_id = v_other limit 1;
    perform pg_temp.check('a relation across two studies must be refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check('a relation cannot reach a paper in another study', true);
  end;

  reset role;
end $$;

-- A stranger sees none of it, and can write none of it.
do $$
declare
  v_them  uuid := 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
  v_study uuid;
begin
  select id into v_study from public.studies where title = 'Framing';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_them::text, true);

  perform pg_temp.check('a stranger sees none of the papers',
    not exists (select 1 from public.study_sources));
  perform pg_temp.check('nor any page of them',
    not exists (select 1 from public.study_source_pages));
  perform pg_temp.check('nor any relation between them',
    not exists (select 1 from public.study_relations));

  begin
    insert into public.study_sources (study_id, name, kind, content_hash)
    values (v_study, 'intruder.pdf', 'pdf', repeat('e', 64));
    perform pg_temp.check('a stranger writing a paper must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot add a paper to somebody else''s study', true);
  end;

  reset role;
end $$;

-- Absences, asserted so a later migration cannot quietly reintroduce them.
do $$
begin
  perform pg_temp.check('study_source_pages has no update policy — an edited page is a quotation nobody can check',
    not exists (select 1 from pg_policies where tablename = 'study_source_pages' and cmd = 'UPDATE'));
  perform pg_temp.check('study_sources has no update policy — a correction is a re-upload',
    not exists (select 1 from pg_policies where tablename = 'study_sources' and cmd = 'UPDATE'));
  perform pg_temp.check('study_relations does have one — a reviewer''s reading is revisable',
    exists (select 1 from pg_policies where tablename = 'study_relations' and cmd = 'UPDATE'));
  perform pg_temp.check('the relation vocabulary is exactly the two that can be justified',
    (select array_agg(enumlabel::text order by enumsortorder)
     from pg_enum where enumtypid = 'public.study_relation'::regtype)
      = array['corroborates', 'contradicts']);
  perform pg_temp.check('study_sources has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'study_sources'));
  perform pg_temp.check('and does not force it',
    (select not relforcerowsecurity from pg_class where relname = 'study_sources'));
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
