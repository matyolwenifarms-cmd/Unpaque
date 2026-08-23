-- THE RESEARCHER. The papers a study actually holds.
--
-- Until now a study could keep *references* -- a title, a DOI, a verified
-- record that a work exists -- and it could hold *documents*, which are
-- transcripts pasted in for coding. Neither is the forty PDFs on a
-- researcher's desktop, and that gap is why every reading feature here starts
-- by asking somebody to paste something.
--
-- So: a corpus. The ingestion engine that reads it is the one Detect already
-- uses, in `_shared/ingest/`; what is new is somewhere for a study to put the
-- result.
--
-- Two decisions worth stating.
--
-- The original bytes are never stored, only the extracted text. A study is
-- often a library's licensed PDFs, and storing those is a copyright question
-- this build has not answered. The text is stored rather than re-read on
-- demand because the alternative makes a study depend on a file that may be
-- moved, and re-parses a 300-page bundle on every search.
--
-- Pages, not one flat body. A citation that says "page 42" and means it is the
-- whole point, and a page boundary is not recoverable from concatenated text.
-- This mirrors `document_pages` on the Detect side deliberately: the same
-- guarantee, and the same refusal to renumber around a blank page.

create table if not exists public.study_sources (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 300),

  -- What the ingestion engine made of it, kept so the interface can say why a
  -- source has no text rather than showing an empty panel.
  kind text not null check (kind in ('pdf', 'word', 'text', 'other')),

  -- Lower-cased, no URL prefix, exactly as `normaliseDoi` produces. Absent is
  -- legitimate and common: a thesis, a report, a chapter scan.
  doi text check (doi is null or doi ~ '^10\.[0-9]{4,9}/[^[:space:]]+$'),

  -- SHA-256 of the bytes as they were read. Two uploads of the same file are
  -- one source, and the refusal happens here rather than in the client so it
  -- holds however the row was written.
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),

  -- What the extractor produced. Zero is a real and important value: it means
  -- a scan with no text layer, and the interface says so instead of showing a
  -- source that silently contributes nothing.
  page_count integer not null default 0 check (page_count >= 0),

  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),

  constraint study_sources_hash_unique unique (study_id, content_hash),
  constraint study_sources_study_id_id_key unique (study_id, id)
);

comment on table public.study_sources is
  'A paper a study holds, as extracted text. The original bytes are never stored.';

create index if not exists study_sources_study_idx on public.study_sources (study_id, added_at desc);
create index if not exists study_sources_doi_idx on public.study_sources (doi) where doi is not null;

create table if not exists public.study_source_pages (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  source_id uuid not null,

  -- 1-based, matching what somebody holding the printout sees. A blank page is
  -- not stored and the numbering still skips it, so page 3 stays page 3 when
  -- page 2 is a divider.
  page_number integer not null check (page_number > 0),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),

  constraint study_source_pages_source_same_study
    foreign key (study_id, source_id) references public.study_sources (study_id, id) on delete cascade,
  constraint study_source_pages_unique unique (source_id, page_number),
  constraint study_source_pages_study_id_id_key unique (study_id, id)
);

create index if not exists study_source_pages_source_idx
  on public.study_source_pages (source_id, page_number);

-- Searching a corpus for a phrase. A plain gin index over to_tsvector rather
-- than a generated tsvector column: a stored column needs a language chosen at
-- write time, which is wrong the moment a study holds a paper in another one.
create index if not exists study_source_pages_body_search
  on public.study_source_pages using gin (to_tsvector('simple', body));

alter table public.study_sources enable row level security;
alter table public.study_source_pages enable row level security;

drop policy if exists study_sources_select on public.study_sources;
drop policy if exists study_sources_insert on public.study_sources;
drop policy if exists study_sources_delete on public.study_sources;

create policy study_sources_select on public.study_sources
  for select using (public.can_read_study(study_id));
create policy study_sources_insert on public.study_sources
  for insert with check (public.can_write_study(study_id));
create policy study_sources_delete on public.study_sources
  for delete using (public.can_write_study(study_id));

drop policy if exists study_source_pages_select on public.study_source_pages;
drop policy if exists study_source_pages_insert on public.study_source_pages;
drop policy if exists study_source_pages_delete on public.study_source_pages;

create policy study_source_pages_select on public.study_source_pages
  for select using (public.can_read_study(study_id));
create policy study_source_pages_insert on public.study_source_pages
  for insert with check (public.can_write_study(study_id));
create policy study_source_pages_delete on public.study_source_pages
  for delete using (public.can_write_study(study_id));

-- No update policy on either, and for the same reason `document_pages` has
-- none. A page's text is what was extracted from the paper; an edited page is
-- a quotation nobody can check against the original, which is the one thing a
-- page number exists to make possible. A correction is a re-upload.

grant select, insert, delete on public.study_sources to authenticated;
grant select, insert, delete on public.study_source_pages to authenticated;
