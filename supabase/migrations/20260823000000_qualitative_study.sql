-- RESEARCH, §7. Where qualitative work is kept.
--
-- The engine and the surface shipped first and held everything in a browser
-- tab, which is defensible for an afternoon's trial and indefensible for the
-- work itself: coding a study is days, and a tool that loses it on a refresh
-- will be used once. This is that gap closed.
--
-- What is stored is deliberately not what is shown. A theme is *derived* from
-- codings by `assembleThemes`, and a theme with no extracts does not exist —
-- so there is no `themes` table. There is a `theme_drafts` table, which is the
-- researcher's claim, and whether it amounts to a theme is answered from the
-- codings every time it is read. A themes table would let a heading outlive
-- the evidence that made it, which is precisely the failure the module is
-- shaped around.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.studies (
  -- Unqualified, so it resolves from pg_catalog where Postgres 13+ provides it
  -- natively. Naming the extensions schema is a Supabase convention that would
  -- make this unappliable to the plain Postgres 16 CI uses.
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  question text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studies is
  'A piece of qualitative research: its transcripts, codebook, codings and theme drafts.';

create table if not exists public.study_documents (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  body text not null check (length(btrim(body)) > 0),
  -- The order the documents were **coded**, which is not the order they were
  -- added and is not inferable from either. Saturation is a claim about a
  -- sequence: "new documents stopped producing new codes" means nothing
  -- without one, and a sequence the software guessed is a fact about the
  -- analysis that nobody established. So it is stored, and `set_coding_order`
  -- is how a researcher corrects it.
  --
  -- Deferrable, so that rewriting every position in one transaction does not
  -- collide with itself halfway through. The alternative — no uniqueness —
  -- allows ties, and a tie makes the order ambiguous again.
  coding_position integer not null,
  created_at timestamptz not null default now(),
  constraint study_documents_position_unique
    unique (study_id, coding_position) deferrable initially deferred
);

comment on column public.study_documents.coding_position is
  'The order this document was coded in. Recorded, never inferred: saturation is a claim about a sequence.';

create table if not exists public.codes (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  definition text not null check (length(btrim(definition)) > 0),
  apply_when text not null check (length(btrim(apply_when)) > 0),
  -- `not null`, and that is the one thing about this table worth arguing.
  --
  -- Every qualitative tool makes the exclusion optional, and an optional
  -- exclusion field is an empty exclusion field. The first time two coders
  -- disagree about a passage there is then nothing in the codebook to settle
  -- it, and the codebook was the artefact that was supposed to make the
  -- analysis reproducible by somebody else.
  not_when text not null check (length(btrim(not_when)) > 0),
  example text,
  -- Enforced one level deep by a trigger rather than a constraint, because the
  -- rule is about the parent's parent and a check constraint cannot see
  -- another row.
  parent_id uuid references public.codes(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.codes.not_when is
  'When NOT to apply this code, including the near-misses. Required: an optional exclusion field is an empty one.';

create table if not exists public.codings (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  document_id uuid not null references public.study_documents(id) on delete cascade,
  code_id uuid not null references public.codes(id) on delete cascade,
  -- Offsets into the document body, in UTF-16 code units — what JavaScript's
  -- String.prototype.slice takes, because the browser is what slices them.
  -- The extract is never stored: a copy drifts from its source invisibly, and
  -- here the source is somebody's interview.
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null,
  memo text,
  -- Who applied it. Nothing reads this yet; inter-coder agreement needs it,
  -- and adding the column later means backfilling every existing coding with a
  -- guess about who made it.
  coder_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_offset > start_offset)
);

comment on table public.codings is
  'A code applied to a stretch of a document, stored as offsets. Written only through apply_code().';

create index if not exists codings_document_idx on public.codings (document_id);
create index if not exists codings_code_idx on public.codings (code_id);

create table if not exists public.theme_drafts (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 200),
  statement text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.theme_drafts is
  'A theme as the analyst declares it. Whether it *is* a theme is answered from the codings on every read, never stored.';

create table if not exists public.theme_draft_codes (
  theme_id uuid not null references public.theme_drafts(id) on delete cascade,
  code_id uuid not null references public.codes(id) on delete cascade,
  primary key (theme_id, code_id)
);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

-- Owner-only today, and a function rather than `owner_id = auth.uid()` inlined
-- into eleven policies. Qualitative work is collaborative — two coders is the
-- whole point of inter-coder agreement — so the day a collaborators table
-- arrives, this is one body to change instead of eleven policies to find.
create or replace function public.can_read_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studies s where s.id = p_study and s.owner_id = auth.uid()
  );
$$;

revoke all on function public.can_read_study(uuid) from public;
grant execute on function public.can_read_study(uuid) to authenticated, service_role;

create or replace function public.can_write_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_study(p_study);
$$;

revoke all on function public.can_write_study(uuid) from public;
grant execute on function public.can_write_study(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The hierarchy rule
-- ---------------------------------------------------------------------------

-- Codes group one level deep. A tree deeper than that becomes a filing system
-- the analyst navigates instead of an analysis they think with — and the rule
-- is about the *parent's* parent, which no check constraint can see.
create or replace function public.codes_one_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.codes%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'a code cannot be its own category'
      using errcode = 'check_violation';
  end if;

  select * into v_parent from public.codes c where c.id = new.parent_id;
  if not found then
    raise exception 'that category does not exist'
      using errcode = 'foreign_key_violation';
  end if;
  if v_parent.study_id <> new.study_id then
    raise exception 'a code and its category must belong to the same study'
      using errcode = 'check_violation';
  end if;
  if v_parent.parent_id is not null then
    raise exception 'codes group one level deep, and % is itself inside a category', v_parent.label
      using errcode = 'check_violation';
  end if;

  -- The other direction, which is easy to forget: a code that already has
  -- children cannot be filed under something else, or the depth rule holds at
  -- insert and is broken by a later update.
  if exists (select 1 from public.codes c where c.parent_id = new.id) then
    raise exception 'other codes are grouped under %, so it cannot itself go inside a category', new.label
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.codes_one_level() from public;

drop trigger if exists codes_one_level_trigger on public.codes;
create trigger codes_one_level_trigger
  before insert or update of parent_id, study_id on public.codes
  for each row execute function public.codes_one_level();

-- ---------------------------------------------------------------------------
-- Writing a coding
-- ---------------------------------------------------------------------------

-- Dropped first because the return type may need to change one day and
-- `create or replace` cannot change it. Safe to drop here, unlike the access
-- predicates above: no policy depends on this one.
drop function if exists public.apply_code(uuid, uuid, integer, integer, text);

-- Offsets into a document, a code, and the authorisation to write both, in one
-- body. Four policies could express the same thing and would express it four
-- times — and the interesting half is not "may this person write", it is "does
-- this coding point at a real stretch of a document belonging to the same
-- study as its code". That is a cross-table question, and RLS has no good way
-- to ask it.
--
-- So `codings` has a select policy and no insert policy at all.
create or replace function public.apply_code(
  p_document uuid,
  p_code uuid,
  p_start integer,
  p_end integer,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_study uuid;
  v_body text;
  v_length integer;
  v_id uuid;
begin
  select d.study_id, d.body into v_study, v_body
  from public.study_documents d where d.id = p_document;

  if v_study is null then
    raise exception 'that document does not exist' using errcode = 'foreign_key_violation';
  end if;
  if not public.can_write_study(v_study) then
    raise exception 'that study is not yours' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.codes c where c.id = p_code and c.study_id = v_study
  ) then
    raise exception 'that code belongs to a different study' using errcode = 'check_violation';
  end if;

  -- UTF-16 code units, because the offsets are JavaScript's and JavaScript
  -- counts an astral character as two. char_length() counts it as one, so a
  -- bound taken from it refuses valid codings on any transcript containing an
  -- emoji — a false refusal, in the safe direction, and still wrong. The
  -- correction adds one per astral character.
  --
  -- Under a SQL_ASCII database the escape range silently matches nothing and
  -- this degrades to char_length(). That is why the suite codes an emoji.
  v_length := length(v_body)
    + (length(v_body) - length(regexp_replace(v_body, '[\U00010000-\U0010FFFF]', '', 'g')));

  if p_start < 0 or p_end > v_length or p_end <= p_start then
    raise exception 'that selection is outside the document (%-% of %)', p_start, p_end, v_length
      using errcode = 'check_violation';
  end if;

  insert into public.codings (study_id, document_id, code_id, start_offset, end_offset, memo, coder_id)
  values (v_study, p_document, p_code, p_start, p_end, nullif(btrim(coalesce(p_memo, '')), ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_code(uuid, uuid, integer, integer, text) from public;
grant execute on function public.apply_code(uuid, uuid, integer, integer, text) to authenticated, service_role;

drop function if exists public.set_coding_order(uuid, uuid[]);

-- The order documents were coded in, set deliberately.
--
-- It exists because the alternative is inferring it from `created_at`, and the
-- order transcripts were uploaded is not the order they were read. Saturation
-- is written from this, so a wrong sequence produces a confident sentence
-- about an analysis that did not happen.
create or replace function public.set_coding_order(p_study uuid, p_documents uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_write_study(p_study) then
    raise exception 'that study is not yours' using errcode = 'insufficient_privilege';
  end if;

  -- Every document, or none. A partial order leaves the rest at positions that
  -- collide with the new ones, and the deferred constraint would then fail at
  -- commit with a message about a unique index rather than about the order.
  if (select count(*) from public.study_documents d where d.study_id = p_study)
     <> coalesce(array_length(p_documents, 1), 0) then
    raise exception 'the order must name every document in the study'
      using errcode = 'check_violation';
  end if;

  update public.study_documents d
  set coding_position = ordered.position
  from (
    select id, ordinality as position
    from unnest(p_documents) with ordinality as t(id, ordinality)
  ) as ordered
  where d.id = ordered.id and d.study_id = p_study;

  if not found then
    raise exception 'none of those documents belong to this study'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.set_coding_order(uuid, uuid[]) from public;
grant execute on function public.set_coding_order(uuid, uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- `enable`, not `force`. The definer functions above read these tables as the
-- owner, and forcing RLS subjects the owner to its own policies — which
-- filters those reads to nothing and presents as "the study does not exist"
-- for the person who owns it.
alter table public.studies enable row level security;
alter table public.study_documents enable row level security;
alter table public.codes enable row level security;
alter table public.codings enable row level security;
alter table public.theme_drafts enable row level security;
alter table public.theme_draft_codes enable row level security;

drop policy if exists studies_select on public.studies;
drop policy if exists studies_insert on public.studies;
drop policy if exists studies_update on public.studies;
drop policy if exists studies_delete on public.studies;

create policy studies_select on public.studies
  for select using (owner_id = auth.uid());
create policy studies_insert on public.studies
  for insert with check (owner_id = auth.uid());
create policy studies_update on public.studies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy studies_delete on public.studies
  for delete using (owner_id = auth.uid());

drop policy if exists study_documents_select on public.study_documents;
drop policy if exists study_documents_insert on public.study_documents;
drop policy if exists study_documents_update on public.study_documents;
drop policy if exists study_documents_delete on public.study_documents;

create policy study_documents_select on public.study_documents
  for select using (public.can_read_study(study_id));
create policy study_documents_insert on public.study_documents
  for insert with check (public.can_write_study(study_id));
create policy study_documents_update on public.study_documents
  for update using (public.can_write_study(study_id)) with check (public.can_write_study(study_id));
create policy study_documents_delete on public.study_documents
  for delete using (public.can_write_study(study_id));

drop policy if exists codes_select on public.codes;
drop policy if exists codes_insert on public.codes;
drop policy if exists codes_update on public.codes;
drop policy if exists codes_delete on public.codes;

create policy codes_select on public.codes
  for select using (public.can_read_study(study_id));
create policy codes_insert on public.codes
  for insert with check (public.can_write_study(study_id));
create policy codes_update on public.codes
  for update using (public.can_write_study(study_id)) with check (public.can_write_study(study_id));
create policy codes_delete on public.codes
  for delete using (public.can_write_study(study_id));

drop policy if exists codings_select on public.codings;
drop policy if exists codings_delete on public.codings;

-- Select and delete, and deliberately no insert or update.
--
-- Insert goes through apply_code(), which is where the offsets are checked
-- against the document they point into. Update is absent for the same reason
-- and has no replacement: an offset is not edited, it is removed and re-made.
-- Allowing an update would mean re-checking the bound in a second place, and a
-- coding whose offsets were moved past the end of its document is corruption
-- that nothing downstream can detect — it slices a shorter string and shows a
-- plausible extract that nobody said.
create policy codings_select on public.codings
  for select using (public.can_read_study(study_id));
create policy codings_delete on public.codings
  for delete using (public.can_write_study(study_id));

drop policy if exists theme_drafts_select on public.theme_drafts;
drop policy if exists theme_drafts_insert on public.theme_drafts;
drop policy if exists theme_drafts_update on public.theme_drafts;
drop policy if exists theme_drafts_delete on public.theme_drafts;

create policy theme_drafts_select on public.theme_drafts
  for select using (public.can_read_study(study_id));
create policy theme_drafts_insert on public.theme_drafts
  for insert with check (public.can_write_study(study_id));
create policy theme_drafts_update on public.theme_drafts
  for update using (public.can_write_study(study_id)) with check (public.can_write_study(study_id));
create policy theme_drafts_delete on public.theme_drafts
  for delete using (public.can_write_study(study_id));

drop policy if exists theme_draft_codes_select on public.theme_draft_codes;
drop policy if exists theme_draft_codes_insert on public.theme_draft_codes;
drop policy if exists theme_draft_codes_delete on public.theme_draft_codes;

-- The join table resolves its study through the draft rather than carrying a
-- study_id of its own. A denormalised copy is a second thing to keep true, and
-- the failure mode is a row whose two halves belong to different studies.
create policy theme_draft_codes_select on public.theme_draft_codes
  for select using (exists (
    select 1 from public.theme_drafts t
    where t.id = theme_id and public.can_read_study(t.study_id)
  ));
create policy theme_draft_codes_insert on public.theme_draft_codes
  for insert with check (exists (
    select 1 from public.theme_drafts t
    join public.codes c on c.id = code_id
    where t.id = theme_id
      and c.study_id = t.study_id
      and public.can_write_study(t.study_id)
  ));
create policy theme_draft_codes_delete on public.theme_draft_codes
  for delete using (exists (
    select 1 from public.theme_drafts t
    where t.id = theme_id and public.can_write_study(t.study_id)
  ));

grant select, insert, update, delete on public.studies to authenticated;
grant select, insert, update, delete on public.study_documents to authenticated;
grant select, insert, update, delete on public.codes to authenticated;
grant select, delete on public.codings to authenticated;
grant select, insert, update, delete on public.theme_drafts to authenticated;
grant select, insert, delete on public.theme_draft_codes to authenticated;
