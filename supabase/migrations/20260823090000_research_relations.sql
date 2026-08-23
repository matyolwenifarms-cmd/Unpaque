-- THE RESEARCHER. One paper against another.
--
-- The capability already existed on the Detect side: `case_edges` records that
-- a gate log corroborates a claim, or that two accounts contradict. A
-- literature review needs exactly that and has never had it -- which is why
-- "supporting and contrasting citations" is a product somebody else sells.
--
-- **Direction is preserved, and that is a correction rather than an
-- omission.** The case graph normalises symmetric relations so that one row
-- serves both directions, and `contradicts` and `corroborates` are
-- deliberately not among them: "this replication corroborates that finding"
-- does not mean the finding corroborates the replication. Normalising the pair
-- swapped the source into the target position and lost which one was doing the
-- corroborating. The same rule holds here for the same reason.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'study_relation') then
    -- Two values, not five. `extends`, `replicates` and `supersedes` are all
    -- real relations between papers and none of them is decidable from a
    -- reading of two texts -- a reviewer would have to declare it, and a
    -- vocabulary offering choices nobody can justify produces a graph whose
    -- edges mean whatever the person clicking felt like.
    create type public.study_relation as enum ('corroborates', 'contradicts');
  end if;
end $$;

create table if not exists public.study_relations (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  relation public.study_relation not null,

  -- The one doing the corroborating or contradicting, and the one it is aimed
  -- at. Never reordered.
  source_id uuid not null,
  target_id uuid not null,

  -- Why, in the reviewer's own words. Not null and not short, because a
  -- relation with no reason behind it is the bare assertion of conflict that
  -- §10 spends a section warning against, arriving in a different feature.
  -- The same discipline as a hypothesis's falsifier: the field that makes the
  -- claim answerable is the field that cannot be left empty.
  basis text not null check (length(btrim(basis)) between 10 and 2000),

  -- Where in the source it is stated, when the reviewer can point at it.
  -- Offsets into that page's body rather than a copy of the words: a stored
  -- quotation is a quotation nobody can check, and it drifts from the page the
  -- moment either is edited. This is the same rule the passage engine and the
  -- coding surface already work under.
  stated_on_page uuid,
  starts_at integer check (starts_at is null or starts_at >= 0),
  ends_at integer check (ends_at is null or ends_at > 0),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- A paper cannot corroborate itself, and an edge that says it does is a
  -- mis-click that quietly inflates every count drawn from this table.
  constraint study_relations_not_reflexive check (source_id <> target_id),

  -- One statement of a relation per direction. Recording it twice is how a
  -- literature map comes to show two arrows where a reviewer drew one.
  constraint study_relations_unique unique (study_id, source_id, target_id, relation),

  -- A locator is all three fields or none of them. Half a locator points at a
  -- page and does not say where on it, which reads as precision and is not.
  constraint study_relations_locator_whole
    check (num_nonnulls(stated_on_page, starts_at, ends_at) in (0, 3)),
  constraint study_relations_locator_ordered
    check (starts_at is null or ends_at > starts_at),

  constraint study_relations_source_same_study
    foreign key (study_id, source_id) references public.study_sources (study_id, id) on delete cascade,
  constraint study_relations_target_same_study
    foreign key (study_id, target_id) references public.study_sources (study_id, id) on delete cascade,
  constraint study_relations_page_same_study
    foreign key (study_id, stated_on_page) references public.study_source_pages (study_id, id) on delete set null
);

comment on table public.study_relations is
  'One paper corroborating or contradicting another, in a reviewer''s own words. Direction is never normalised.';

create index if not exists study_relations_study_idx on public.study_relations (study_id, created_at desc);
create index if not exists study_relations_source_idx on public.study_relations (source_id);
create index if not exists study_relations_target_idx on public.study_relations (target_id);

alter table public.study_relations enable row level security;

drop policy if exists study_relations_select on public.study_relations;
drop policy if exists study_relations_insert on public.study_relations;
drop policy if exists study_relations_update on public.study_relations;
drop policy if exists study_relations_delete on public.study_relations;

create policy study_relations_select on public.study_relations
  for select using (public.can_read_study(study_id));
create policy study_relations_insert on public.study_relations
  for insert with check (public.can_write_study(study_id));
-- The basis is the reviewer's reading and a reading is revisable, so unlike a
-- page of extracted text this one may be edited. The constraints hold on the
-- way in either way.
create policy study_relations_update on public.study_relations
  for update using (public.can_write_study(study_id)) with check (public.can_write_study(study_id));
create policy study_relations_delete on public.study_relations
  for delete using (public.can_write_study(study_id));

grant select, insert, update, delete on public.study_relations to authenticated;
