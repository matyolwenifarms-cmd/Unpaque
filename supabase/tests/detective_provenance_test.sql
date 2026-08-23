-- Provenance, lineage and the transcript landing place. Run after harness.sql
-- and the migrations.
--
-- The assertion that carries this file is the last one: `transcript_origin`
-- has no value meaning a machine produced the entry, because no machine has.
-- Adding one is part of building §8's pipeline, and doing it by accident is
-- how a typed transcript comes to look like a transcribed one.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', 'prov@example.org'),
  ('f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f6f6f6', 'stranger@example.org')
on conflict (id) do nothing;

do $$
declare
  v_me     uuid := 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5';
  v_case   uuid;
  v_other  uuid;
  v_wire   uuid;
  v_herald uuid;
  v_post   uuid;
  v_alien  uuid;
  v_claim  uuid;
  v_media  uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.cases (owner_id, title) values (v_me, 'The depot') returning id into v_case;

  -- Claims are the head of the provenance path and were still uuids.
  insert into public.claims (case_id, statement) values (v_case, 'The van left before nine.')
  returning id into v_claim;
  perform pg_temp.check('a claim gets a reference number',
    (select reference from public.claims where id = v_claim) = 1);
  insert into public.claims (case_id, statement) values (v_case, 'Nobody saw it.') returning id into v_row;
  perform pg_temp.check('and the next one gets the next number',
    (select reference from public.claims where id = v_row) = 2);

  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'reporting', 'The wire report', 'https://example.org/wire', v_me)
  returning id into v_wire;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'reporting', 'The Herald', 'https://example.org/herald', v_me)
  returning id into v_herald;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'reporting', 'The Post', 'https://example.org/post', v_me)
  returning id into v_post;

  insert into public.source_lineage (case_id, source_id, derives_from_id, kind, created_by)
  values (v_case, v_herald, v_wire, 'syndication', v_me);
  insert into public.source_lineage (case_id, source_id, derives_from_id, kind, created_by)
  values (v_case, v_post, v_herald, 'republication', v_me);
  perform pg_temp.check('a chain of derivation can be declared',
    (select count(*) from public.source_lineage where case_id = v_case) = 2);

  -- A self-link makes the walk terminate on its first step and report the
  -- source as its own origin, which is true and useless.
  begin
    insert into public.source_lineage (case_id, source_id, derives_from_id, kind)
    values (v_case, v_wire, v_wire, 'syndication') returning id into v_row;
    perform pg_temp.check('a source deriving from itself must be refused', false);
  exception when check_violation then
    perform pg_temp.check('nothing derives from itself', true);
  end;

  -- A report deriving from two originals is either a new synthesis, which is
  -- an original, or two quotations, which are two links from it.
  begin
    insert into public.source_lineage (case_id, source_id, derives_from_id, kind)
    values (v_case, v_herald, v_post, 'quotation') returning id into v_row;
    perform pg_temp.check('a second parent must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('a source derives from at most one thing', true);
  end;

  insert into public.cases (owner_id, title) values (v_me, 'Elsewhere') returning id into v_other;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_other, 'reporting', 'Another case', 'https://example.org/z', v_me) returning id into v_alien;
  -- v_wire, which has no parent yet: v_herald would hit the one-parent index
  -- first and raise unique_violation, which is a refusal for the wrong reason
  -- and would leave this assertion proving nothing about case isolation.
  begin
    insert into public.source_lineage (case_id, source_id, derives_from_id, kind)
    values (v_case, v_wire, v_alien, 'syndication') returning id into v_row;
    perform pg_temp.check('lineage across cases must be refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check('lineage cannot reach into another investigation', true);
  end;

  -- Media: where it is, never the bytes.
  insert into public.media (case_id, source_id, kind, located_at, duration_seconds, created_by)
  values (v_case, v_wire, 'video', 'https://example.org/clip.mp4', 6137, v_me)
  returning id into v_media;
  perform pg_temp.check('media records where it is', v_media is not null);
  perform pg_temp.check('and nowhere to put the bytes',
    not exists (select 1 from information_schema.columns
                where table_name = 'media' and column_name in ('data', 'bytes', 'blob', 'file')));

  -- A duration on a document is a field filled in by habit.
  begin
    insert into public.media (case_id, source_id, kind, located_at, duration_seconds)
    values (v_case, v_wire, 'document', 'https://example.org/a.pdf', 60) returning id into v_row;
    perform pg_temp.check('a document with a duration must be refused', false);
  exception when check_violation then
    perform pg_temp.check('only video and audio have a duration', true);
  end;
  begin
    insert into public.media (case_id, source_id, kind, located_at, page_count)
    values (v_case, v_wire, 'video', 'https://example.org/b.mp4', 12) returning id into v_row;
    perform pg_temp.check('a video with a page count must be refused', false);
  exception when check_violation then
    perform pg_temp.check('only a document has pages', true);
  end;

  insert into public.transcript_entries (case_id, media_id, speaker, start_ms, end_ms, body, created_by)
  values (v_case, v_media, 'HOST', 1000, 4500, 'Detective, show us the testimony.', v_me)
  returning id into v_row;
  perform pg_temp.check('a transcript entry can be typed', v_row is not null);
  perform pg_temp.check('and defaults to saying a person typed it',
    (select origin from public.transcript_entries where id = v_row) = 'typed');
  perform pg_temp.check('with no confidence invented for it',
    (select confidence from public.transcript_entries where id = v_row) is null);

  begin
    insert into public.transcript_entries (case_id, media_id, start_ms, end_ms, body)
    values (v_case, v_media, 4500, 1000, 'Backwards.') returning id into v_row;
    perform pg_temp.check('an entry ending before it starts must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an entry cannot end before it starts', true);
  end;

  -- Two speakers may start at the same moment; the same speaker may not.
  insert into public.transcript_entries (case_id, media_id, speaker, start_ms, end_ms, body)
  values (v_case, v_media, 'DETECTIVE', 1000, 3000, 'Talking over.');
  perform pg_temp.check('two speakers may start at the same moment',
    (select count(*) from public.transcript_entries where media_id = v_media and start_ms = 1000) = 2);
  begin
    insert into public.transcript_entries (case_id, media_id, speaker, start_ms, end_ms, body)
    values (v_case, v_media, 'HOST', 1000, 2000, 'Imported twice.') returning id into v_row;
    perform pg_temp.check('the same speaker twice at one moment must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('but one speaker cannot start twice at the same moment', true);
  end;

  delete from public.media where id = v_media;
  perform pg_temp.check('deleting media deletes its transcript',
    (select count(*) from public.transcript_entries where media_id = v_media) = 0);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls
-- ---------------------------------------------------------------------------

do $$
declare
  v_me    uuid := 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5';
  v_them  uuid := 'f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f6f6f6';
  v_case  uuid;
  v_a     uuid;
  v_b     uuid;
  v_row   uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.cases (owner_id, title) values (v_me, 'Private') returning id into v_case;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'reporting', 'A', 'https://example.org/a', v_me) returning id into v_a;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'reporting', 'B', 'https://example.org/b', v_me) returning id into v_b;
  insert into public.source_lineage (case_id, source_id, derives_from_id, kind)
  values (v_case, v_b, v_a, 'syndication');
  insert into public.media (case_id, source_id, kind, located_at)
  values (v_case, v_a, 'image', 'https://example.org/photo.jpg');

  perform set_config('request.jwt.claim.sub', v_them::text, true);
  perform pg_temp.check('a stranger sees no lineage of a private case',
    (select count(*) from public.source_lineage where case_id = v_case) = 0);
  perform pg_temp.check('nor its media',
    (select count(*) from public.media where case_id = v_case) = 0);

  begin
    insert into public.source_lineage (case_id, source_id, derives_from_id, kind)
    values (v_case, v_a, v_b, 'quotation') returning id into v_row;
    perform pg_temp.check('a stranger declaring lineage must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot declare lineage in somebody else''s case', true);
  end;

  reset role;
end $$;

do $$
begin
  -- The assertion this file is for. No machine has produced a transcript
  -- entry, so there is no value saying one did.
  perform pg_temp.check('nothing claims a machine transcribed anything',
    not exists (
      select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'transcript_origin'
        and e.enumlabel in ('machine', 'automatic', 'asr', 'transcribed', 'ai')
    ));

  perform pg_temp.check('lineage has no update policy, so a reversal is a new declaration',
    not exists (select 1 from pg_policies where tablename = 'source_lineage' and cmd = 'UPDATE'));

  perform pg_temp.check('source_lineage has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'source_lineage'));
  perform pg_temp.check('and does not force it',
    (select not relforcerowsecurity from pg_class where relname = 'source_lineage'));
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
