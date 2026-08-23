-- THE DETECTIVE, sections 6 to 8. Provenance, lineage, and where a transcript
-- will land.
--
-- Three things, and they are one thing: where a statement comes from.
--
-- **Claims get reference numbers**, so the path §6 draws — CLAIM-031 ->
-- SOURCE-017 -> DOCUMENT -> PAGE 42 — can be rendered at all. Sources and
-- evidence got theirs with broadcast mode; claims are the head of that path
-- and were still uuids.
--
-- **Source lineage**, because "the same story appearing on 50 websites must
-- not automatically count as 50 independent sources". The existing
-- `content_hash` check catches a wire story republished verbatim and nothing
-- else; a rewritten headline defeats it entirely. Lineage is **declared, never
-- inferred**: the specification says "detect probable syndication", and a tool
-- that guessed would be asserting that two reporters copied each other, which
-- is an accusation and not a computation.
--
-- **Media and transcript entries**, which nothing writes. §7 and §8 need a
-- transcription vendor and there is not one, so these are the landing place
-- and they say so — `transcript_entries.origin` has no value meaning "a
-- machine produced this", because no machine has.

alter table public.claims add column if not exists reference integer;

create unique index if not exists claims_reference_unique
  on public.claims (case_id, reference) where reference is not null;

-- The same trigger the sources and evidence use, extended rather than copied.
create or replace function public.assign_case_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is not null then
    return new;
  end if;

  if tg_table_name = 'sources' then
    select coalesce(max(s.reference), 0) + 1 into new.reference
    from public.sources s where s.case_id = new.case_id;
  elsif tg_table_name = 'claims' then
    select coalesce(max(c.reference), 0) + 1 into new.reference
    from public.claims c where c.case_id = new.case_id;
  else
    select coalesce(max(e.reference), 0) + 1 into new.reference
    from public.evidence e where e.case_id = new.case_id;
  end if;

  return new;
end;
$$;

drop trigger if exists claims_reference_trigger on public.claims;
create trigger claims_reference_trigger
  before insert on public.claims
  for each row execute function public.assign_case_reference();

do $$
begin
  update public.claims c
  set reference = numbered.position
  from (
    select id, row_number() over (partition by case_id order by created_at, id) as position
    from public.claims where reference is null
  ) as numbered
  where c.id = numbered.id and c.reference is null;
end $$;

-- ---------------------------------------------------------------------------
-- Lineage
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lineage_kind') then
    create type public.lineage_kind as enum
      ('syndication', 'republication', 'quotation', 'translation');
  end if;
end $$;

create table if not exists public.source_lineage (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  -- The later source.
  source_id uuid not null,
  -- What it derives from.
  derives_from_id uuid not null,
  kind public.lineage_kind not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Nothing derives from itself. A self-link would make the walk in
  -- provenance.ts terminate on its first step and report the source as its own
  -- origin, which is true and useless.
  constraint source_lineage_not_itself check (source_id <> derives_from_id),

  constraint source_lineage_source_same_case
    foreign key (case_id, source_id) references public.sources (case_id, id) on delete cascade,
  constraint source_lineage_origin_same_case
    foreign key (case_id, derives_from_id) references public.sources (case_id, id) on delete cascade,

  -- One declaration per pair. Two rows saying a derives from b, differing only
  -- in kind, is one fact recorded twice and would be counted twice by anything
  -- that reads the links as a list.
  unique (source_id, derives_from_id)
);

comment on table public.source_lineage is
  'Declared derivation between sources: syndication, republication, quotation, translation. Never inferred — a guess here is an accusation that two reporters copied each other.';

create index if not exists source_lineage_case_idx on public.source_lineage (case_id);

-- A source derives from at most one thing. Not a constraint the specification
-- states, and it is here because the alternative has no meaning: a report that
-- derives from two originals is either a new synthesis (which is an original)
-- or two separate quotations (which are quotation links from each). The walk
-- back through lineage needs a single parent to be a walk at all.
create unique index if not exists source_lineage_one_parent
  on public.source_lineage (source_id);

-- ---------------------------------------------------------------------------
-- Media, and transcripts of it
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_kind') then
    create type public.media_kind as enum ('video', 'audio', 'image', 'document', 'web_page');
  end if;

  if not exists (select 1 from pg_type where typname = 'transcript_origin') then
    -- Two values, and the absence of a third is the point. There is no
    -- 'machine' here because no machine has produced one: §8's transcription
    -- pipeline needs a vendor and there is not one. Adding the value is part
    -- of building the pipeline, not something to have waiting.
    create type public.transcript_origin as enum ('typed', 'imported');
  end if;
end $$;

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  source_id uuid not null,
  kind public.media_kind not null,
  -- Where it is, not the bytes. Nothing is uploaded: storing investigative
  -- media raises retention, jurisdiction and takedown questions the
  -- specification's §18 has answers for and this build has not implemented.
  located_at text not null check (length(btrim(located_at)) between 1 and 2000),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  page_count integer check (page_count is null or page_count > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint media_source_same_case
    foreign key (case_id, source_id) references public.sources (case_id, id) on delete cascade,

  -- A duration on a document or a page count on a video is a field filled in
  -- by habit rather than by observation.
  constraint media_duration_is_temporal
    check (duration_seconds is null or kind in ('video', 'audio')),
  constraint media_pages_are_documentary
    check (page_count is null or kind = 'document'),

  unique (case_id, id)
);

comment on table public.media is
  'Where a source''s media is, never the bytes. Nothing is uploaded: retention and takedown are §18 questions this build has not answered.';

create table if not exists public.transcript_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  media_id uuid not null,
  -- §8: speaker, start_time, end_time, text, confidence.
  speaker text,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null,
  body text not null check (length(btrim(body)) > 0),
  -- Null where nothing measured one. A confidence invented for a typed
  -- transcript would be a number with no meaning that everything downstream
  -- would nonetheless read.
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  origin public.transcript_origin not null default 'typed',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  check (end_ms > start_ms),

  constraint transcript_media_same_case
    foreign key (case_id, media_id) references public.media (case_id, id) on delete cascade,

  -- One entry per moment per speaker. Two rows with the same start are either
  -- a double import or two speakers talking over each other, and the second is
  -- what `speaker` distinguishes.
  unique (media_id, start_ms, speaker)
);

comment on table public.transcript_entries is
  'A stretch of speech in a piece of media. Typed or imported only — §8''s transcription pipeline is not built.';

create index if not exists transcript_entries_media_idx
  on public.transcript_entries (media_id, start_ms);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.source_lineage enable row level security;
alter table public.media enable row level security;
alter table public.transcript_entries enable row level security;

drop policy if exists source_lineage_select on public.source_lineage;
drop policy if exists source_lineage_insert on public.source_lineage;
drop policy if exists source_lineage_delete on public.source_lineage;

create policy source_lineage_select on public.source_lineage
  for select using (public.can_read_case(case_id));
create policy source_lineage_insert on public.source_lineage
  for insert with check (public.can_write_case(case_id));
create policy source_lineage_delete on public.source_lineage
  for delete using (public.can_write_case(case_id));

drop policy if exists media_select on public.media;
drop policy if exists media_insert on public.media;
drop policy if exists media_delete on public.media;

create policy media_select on public.media
  for select using (public.can_read_case(case_id));
create policy media_insert on public.media
  for insert with check (public.can_write_case(case_id));
create policy media_delete on public.media
  for delete using (public.can_write_case(case_id));

drop policy if exists transcript_entries_select on public.transcript_entries;
drop policy if exists transcript_entries_insert on public.transcript_entries;
drop policy if exists transcript_entries_delete on public.transcript_entries;

create policy transcript_entries_select on public.transcript_entries
  for select using (public.can_read_case(case_id));
create policy transcript_entries_insert on public.transcript_entries
  for insert with check (public.can_write_case(case_id));
create policy transcript_entries_delete on public.transcript_entries
  for delete using (public.can_write_case(case_id));

-- No update policy on lineage, deliberately. Changing "a derives from b" to "b
-- derives from a" in place rewrites which report came first, and that is the
-- fact the independence count rests on. Withdraw the declaration and make the
-- other one.

grant select, insert, delete on public.source_lineage to authenticated;
grant select, insert, delete on public.media to authenticated;
grant select, insert, delete on public.transcript_entries to authenticated;
