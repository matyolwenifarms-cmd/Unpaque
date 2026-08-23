-- RESEARCH. The rest of a study, so a write-up survives a refresh.
--
-- The qualitative half was already kept. The other three sections the write-up
-- transcribes — the method declaration, the analyses, the reading list — lived
-- in React state, so closing the tab emptied them. That is defensible for a
-- t-test somebody ran to see what it looked like and indefensible for a
-- methodology declaration, which is thirteen fields nobody wants to retype.
--
-- All three are stored as jsonb, and that is a deliberate trade rather than
-- laziness. Nothing here queries inside them: `Finding` and `Reference` are
-- closed shapes owned by modules that already validate them, and normalising
-- either into columns would mean a migration every time one gains a field —
-- with the real risk that the column set and the TypeScript type drift, which
-- is exactly the failure `db:check` exists for in projects that have it.
--
-- The cost is that a row can be malformed in a way Postgres cannot see. That
-- is paid on read: the client validates and drops what does not parse, and
-- says how many it dropped, the same way the reference pipeline drops an
-- identifier that will not resolve.

-- ---------------------------------------------------------------------------
-- The method declaration
-- ---------------------------------------------------------------------------

-- On `studies` rather than in its own table: there is exactly one per study,
-- and a table with a uniqueness constraint enforcing that is a table pretending
-- to be a column.
alter table public.studies
  add column if not exists method_declaration jsonb;

comment on column public.studies.method_declaration is
  'The paradigm and design as declared. The statement is derived from it and never stored — a stored copy would drift from the declaration it claims to describe.';

-- ---------------------------------------------------------------------------
-- Analyses
-- ---------------------------------------------------------------------------

create table if not exists public.study_findings (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  -- Whole, as analytics produced it. `Finding` has no optional p and no
  -- partial constructor, so what goes in is complete or does not exist.
  finding jsonb not null check (jsonb_typeof(finding) = 'object'),
  -- The columns involved, for the descriptives table a results section opens
  -- with. Separate because several findings share them.
  descriptives jsonb not null default '[]'::jsonb
    check (jsonb_typeof(descriptives) = 'array'),
  -- Which file it was run on. Null is legitimate — the dataset is not stored,
  -- and a results section that names a file nobody can produce is worse than
  -- one that names none.
  dataset_name text,
  -- The order they were run in, which is the order a results section reports
  -- them. Not created_at: two analyses run in the same millisecond are
  -- possible and their order would then be arbitrary.
  position integer not null,
  created_at timestamptz not null default now()
);

comment on table public.study_findings is
  'Analyses run against a study, in the order they were run. The dataset itself is never uploaded.';

create index if not exists study_findings_study_idx
  on public.study_findings (study_id, position);

-- ---------------------------------------------------------------------------
-- The reading list
-- ---------------------------------------------------------------------------

create table if not exists public.study_references (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  -- As the providers returned it, and not editable here. A reference somebody
  -- can retype is one that can stop matching what its DOI resolves to, and the
  -- whole claim of this feature is that every entry is a real record.
  reference jsonb not null check (jsonb_typeof(reference) = 'object'),
  -- Lifted out for the uniqueness rules below and for nothing else.
  doi text,
  provider_id text,
  created_at timestamptz not null default now()
);

comment on table public.study_references is
  'Works kept for a study. Stored as the provider returned them; never edited.';

-- One work, once. Two partial indexes rather than one constraint, because a
-- record may carry a DOI, a provider id, both, or neither — and a plain unique
-- over both columns treats two nulls as distinct, which is precisely the case
-- that lets the same work be added twice.
create unique index if not exists study_references_doi_unique
  on public.study_references (study_id, doi) where doi is not null;
create unique index if not exists study_references_provider_unique
  on public.study_references (study_id, provider_id) where provider_id is not null;

create index if not exists study_references_study_idx
  on public.study_references (study_id, created_at);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- `enable`, not `force`: the definer predicates read these as the owner.
alter table public.study_findings enable row level security;
alter table public.study_references enable row level security;

drop policy if exists study_findings_select on public.study_findings;
drop policy if exists study_findings_insert on public.study_findings;
drop policy if exists study_findings_delete on public.study_findings;

-- Read by anybody on the study, written only by its owner — the same division
-- as the codebook and for the same reason. A second coder applies a codebook;
-- they do not run the author's analyses or choose the author's sources.
create policy study_findings_select on public.study_findings
  for select using (public.can_read_study(study_id));
create policy study_findings_insert on public.study_findings
  for insert with check (public.owns_study(study_id));
create policy study_findings_delete on public.study_findings
  for delete using (public.owns_study(study_id));

drop policy if exists study_references_select on public.study_references;
drop policy if exists study_references_insert on public.study_references;
drop policy if exists study_references_delete on public.study_references;

create policy study_references_select on public.study_references
  for select using (public.can_read_study(study_id));
create policy study_references_insert on public.study_references
  for insert with check (public.owns_study(study_id));
create policy study_references_delete on public.study_references
  for delete using (public.owns_study(study_id));

-- No update policy on either, and it is the same argument as `codings`. A
-- finding is re-run, not edited; a reference is what the provider returned. An
-- update path would let the two things this feature promises — that every
-- number was computed here and every record is real — become false without
-- anything on screen changing.

grant select, insert, delete on public.study_findings to authenticated;
grant select, insert, delete on public.study_references to authenticated;
