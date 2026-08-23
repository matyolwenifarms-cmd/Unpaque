-- THE DETECTIVE. Page text, so a locator can say "page 42" and mean it.
--
-- The transcript table holds what was said in time-based media. This is its
-- counterpart for paginated media, and it exists for one reason: §6's
-- provenance path ends at a locator, and a locator naming a page nobody can
-- open is a reference to nothing.
--
-- Storing the text is a decision worth stating. The alternative — keeping
-- only the file and re-reading it on demand — means the case file depends on
-- a file that may be moved, and means every search re-parses a 200-page bundle.
-- What is stored is the extracted text, never the original bytes: §18's
-- retention and takedown questions apply to the document itself and this build
-- has not answered them.

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  media_id uuid not null,
  -- 1-based and matching what somebody holding the printout sees. A blank page
  -- is not stored, and the numbering still skips it rather than renumbering,
  -- so page 3 stays page 3 when page 2 is a divider.
  page_number integer not null check (page_number > 0),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),

  constraint document_pages_media_same_case
    foreign key (case_id, media_id) references public.media (case_id, id) on delete cascade,

  unique (media_id, page_number)
);

comment on table public.document_pages is
  'Text extracted from a paginated document, one row per page. The original bytes are never stored.';

create index if not exists document_pages_media_idx
  on public.document_pages (media_id, page_number);

-- Searching a case for a phrase. A plain index rather than a trigram or a
-- generated tsvector column: `to_tsvector` on a text column is enough for
-- "which page mentions the depot", and a tsvector column would need a language
-- chosen at write time — which is wrong the moment a case holds a document in
-- another one.
create index if not exists document_pages_body_search
  on public.document_pages using gin (to_tsvector('simple', body));

alter table public.document_pages enable row level security;

drop policy if exists document_pages_select on public.document_pages;
drop policy if exists document_pages_insert on public.document_pages;
drop policy if exists document_pages_delete on public.document_pages;

create policy document_pages_select on public.document_pages
  for select using (public.can_read_case(case_id));
create policy document_pages_insert on public.document_pages
  for insert with check (public.can_write_case(case_id));
create policy document_pages_delete on public.document_pages
  for delete using (public.can_write_case(case_id));

-- No update policy. A page's text is what was extracted from the document; an
-- edited page is a quotation nobody can check against the original, which is
-- the one thing a locator exists to make possible.

grant select, insert, delete on public.document_pages to authenticated;
