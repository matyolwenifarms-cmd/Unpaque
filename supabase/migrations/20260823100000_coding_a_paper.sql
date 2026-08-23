-- THE RESEARCHER. Coding a paper the study holds, without losing the page.
--
-- `study_documents` is what the coding surface works over: one flat body, and
-- a coding is a pair of offsets into it. `study_sources` is a paper, stored as
-- pages. Coding a paper means flattening it, and flattening it naively throws
-- away the one thing pages were stored for -- a quotation that says "page 42"
-- and means it.
--
-- So the flattening is recorded. `page_starts[i]` is the character offset in
-- `body` where page i begins, which makes every offset in the document
-- reversible to a page. A coding at character 4,120 is on whichever page has
-- the largest start not greater than 4,120, and `public.page_at()` says which.
--
-- Rejected: storing the page number on each coding. It is derivable, and a
-- derived value stored beside the thing it derives from is a value that can
-- disagree with it -- which here would mean a citation pointing at a page the
-- text is not on.

alter table public.study_documents
  add column if not exists source_id uuid,
  add column if not exists page_starts integer[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.study_documents'::regclass
      and conname = 'study_documents_source_same_study'
  ) then
    alter table public.study_documents
      add constraint study_documents_source_same_study
      foreign key (study_id, source_id) references public.study_sources (study_id, id)
      on delete set null;
  end if;
end $$;

-- A document that came from a paper carries the map; one that was pasted in
-- carries neither. Half of the pair is a document claiming a provenance it
-- cannot support, or a page map belonging to nothing.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.study_documents'::regclass
      and conname = 'study_documents_pages_with_source'
  ) then
    alter table public.study_documents
      add constraint study_documents_pages_with_source
      check (num_nonnulls(source_id, page_starts) <> 1);
  end if;
end $$;

-- The first page starts at nought, and the offsets only ever increase. A map
-- that starts anywhere else, or doubles back, silently mislabels every
-- quotation taken after the point where it goes wrong.
--
-- In a function because Postgres refuses a subquery inside a check constraint,
-- and the check needs to walk the array. Immutable, which is what makes it
-- usable in one.
create or replace function public.page_starts_valid(p_page_starts integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_page_starts is null
    or (
      array_length(p_page_starts, 1) > 0
      and p_page_starts[1] = 0
      and not exists (
        select 1
        from generate_subscripts(p_page_starts, 1) as i
        where i > 1 and p_page_starts[i] <= p_page_starts[i - 1]
      )
    );
$$;

revoke all on function public.page_starts_valid(integer[]) from public;
grant execute on function public.page_starts_valid(integer[]) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.study_documents'::regclass
      and conname = 'study_documents_page_starts_ordered'
  ) then
    alter table public.study_documents
      add constraint study_documents_page_starts_ordered
      check (public.page_starts_valid(page_starts));
  end if;
end $$;

comment on column public.study_documents.page_starts is
  'Character offset in body where each page begins, 1-based array. Null unless the document came from a paper.';

-- Which page an offset falls on, 1-based, matching what somebody holding the
-- printout sees. Immutable because it is arithmetic over its arguments, which
-- lets it be used in an index or a generated column later without surprise.
create or replace function public.page_at(p_page_starts integer[], p_offset integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(max(i), 1)
  from generate_subscripts(p_page_starts, 1) as i
  where p_page_starts[i] <= p_offset;
$$;

revoke all on function public.page_at(integer[], integer) from public;
grant execute on function public.page_at(integer[], integer) to authenticated, service_role;
