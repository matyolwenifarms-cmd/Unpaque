-- THE DETECTIVE: sources, claims and evidence. §5, §6 and §10.
--
-- Two properties are enforced by the shape of the schema rather than by rules
-- somebody has to remember:
--
--   1. Provenance is not optional. §6 requires every source to record where it
--      actually came from and when it was retrieved, so those columns are NOT
--      NULL. A source whose origin is unrecorded is not evidence of anything,
--      and making the column nullable is how a dossier ends up with rows
--      nobody can trace.
--
--   2. Evidence cannot cross cases. Composite foreign keys make a row that
--      links a claim in one investigation to a source in another impossible to
--      insert rather than merely forbidden — which matters because that is the
--      shape a private-case leak would take.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_kind') then
    -- §6's source types. `other` exists so that an unanticipated kind is
    -- recorded honestly rather than forced into the nearest wrong category.
    create type public.source_kind as enum (
      'primary_document', 'official_record', 'testimony', 'video', 'audio',
      'image', 'reporting', 'archive', 'dataset', 'correspondence', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'evidence_classification') then
    -- §10. How a piece of evidence bears on a claim. `contradicts` is a
    -- first-class value, not an absence of support: §10's contradiction engine
    -- depends on being able to find these.
    create type public.evidence_classification as enum (
      'supports', 'contradicts', 'contextualises', 'undermines_source', 'inconclusive'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Sources
-- ---------------------------------------------------------------------------

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  kind public.source_kind not null,
  title text not null check (length(btrim(title)) between 1 and 500),

  -- §6's provenance requirement, as columns that cannot be empty.
  retrieved_at timestamptz not null default now(),
  retrieved_from text not null check (length(btrim(retrieved_from)) > 0),

  url text,
  publisher text,
  published_at timestamptz,

  -- §6 source lineage and duplication. Two sources with the same hash are the
  -- same bytes retrieved twice, which is emphatically not two independent
  -- corroborating sources — §3 names repeated copying as the classic way a
  -- claim looks better supported than it is.
  content_hash text,

  -- §6 source quality, recorded rather than computed. A number the system
  -- invented would be treated as a measurement.
  reliability_note text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.sources is
  'Material a case rests on. retrieved_from and retrieved_at are mandatory: a source whose origin is unrecorded is not evidence of anything.';

create index if not exists sources_case_idx on public.sources (case_id);
create index if not exists sources_hash_idx on public.sources (case_id, content_hash)
  where content_hash is not null;

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  statement text not null check (length(btrim(statement)) between 1 and 2000),

  -- §3: claims are not facts. The default is `unknown` rather than anything
  -- that sounds settled, so a claim recorded and never assessed reads as
  -- unassessed instead of quietly acquiring standing.
  status public.epistemic_status not null default 'unknown',

  -- Who or what asserts it. §4 distinguishes a claim from a fact precisely by
  -- there being an asserter, so leaving this unrecorded erases the distinction.
  asserted_by text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.claims is
  'Something a source asserts. Defaults to unknown: a claim that has never been assessed must not read as one that has.';

create index if not exists claims_case_idx on public.claims (case_id);

-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------

-- The composite keys that make a cross-case link unrepresentable. Postgres
-- needs a unique constraint on (case_id, id) before another table can reference
-- the pair; the primary key on id alone is not enough.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.claims'::regclass and conname = 'claims_case_id_id_key'
  ) then
    alter table public.claims add constraint claims_case_id_id_key unique (case_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sources'::regclass and conname = 'sources_case_id_id_key'
  ) then
    alter table public.sources add constraint sources_case_id_id_key unique (case_id, id);
  end if;
end $$;

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  claim_id uuid not null,
  source_id uuid not null,
  classification public.evidence_classification not null,

  -- §6: what in the source actually says this. A quotation the reader can go
  -- and check, not a paraphrase.
  excerpt text,
  locator text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- The two constraints that carry the isolation. Both the claim and the
  -- source must belong to the case the evidence belongs to, so evidence
  -- linking across investigations cannot be inserted at all.
  constraint evidence_claim_same_case
    foreign key (case_id, claim_id) references public.claims (case_id, id) on delete cascade,
  constraint evidence_source_same_case
    foreign key (case_id, source_id) references public.sources (case_id, id) on delete cascade,

  -- The same source may bear on the same claim only once per classification.
  -- Two identical rows would make a single source look like two independent
  -- corroborations, which §3 warns about by name.
  unique (claim_id, source_id, classification)
);

comment on table public.evidence is
  'How a source bears on a claim. Composite foreign keys make a link across two investigations impossible to insert.';

create index if not exists evidence_claim_idx on public.evidence (claim_id);
create index if not exists evidence_source_idx on public.evidence (source_id);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists sources_select on public.sources;
drop policy if exists sources_write on public.sources;
drop policy if exists sources_update on public.sources;
drop policy if exists sources_delete on public.sources;
drop policy if exists claims_select on public.claims;
drop policy if exists claims_write on public.claims;
drop policy if exists claims_update on public.claims;
drop policy if exists claims_delete on public.claims;
drop policy if exists evidence_select on public.evidence;
drop policy if exists evidence_write on public.evidence;
drop policy if exists evidence_update on public.evidence;
drop policy if exists evidence_delete on public.evidence;

-- `enable`, not `force`: the case access predicates are security definer and
-- run as the owner. See the note in harness.sql about why this cannot be
-- tested behaviourally in the local suites.
alter table public.sources enable row level security;
alter table public.claims enable row level security;
alter table public.evidence enable row level security;

-- Access is derived from the case, never restated. A second copy of the rule
-- here would be a second place to forget to update.
create policy sources_select on public.sources
  for select using (public.can_read_case(case_id));
create policy sources_write on public.sources
  for insert with check (public.can_write_case(case_id));
create policy sources_update on public.sources
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy sources_delete on public.sources
  for delete using (public.can_write_case(case_id));

create policy claims_select on public.claims
  for select using (public.can_read_case(case_id));
create policy claims_write on public.claims
  for insert with check (public.can_write_case(case_id));
create policy claims_update on public.claims
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy claims_delete on public.claims
  for delete using (public.can_write_case(case_id));

create policy evidence_select on public.evidence
  for select using (public.can_read_case(case_id));
create policy evidence_write on public.evidence
  for insert with check (public.can_write_case(case_id));
create policy evidence_update on public.evidence
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy evidence_delete on public.evidence
  for delete using (public.can_write_case(case_id));

grant select on public.sources, public.claims, public.evidence to anon, authenticated;
grant insert, update, delete on public.sources, public.claims, public.evidence to authenticated;
grant select, insert, update, delete on public.sources, public.claims, public.evidence to service_role;
