-- THE DETECTIVE: timeline events and contradiction records. §9 and §10.
--
-- Both tables exist to hold what the engines in _shared/detective produce, and
-- both enforce in the schema the property the engine enforces in code. That
-- duplication is deliberate: a rule that lives only in application code is a
-- rule that a migration, a admin script or a future second writer can walk
-- straight past.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'date_certainty') then
    -- §9's five. `conflicting` is a state of the timeline rather than of any
    -- one record: once two sources disagree, no single one of them can honestly
    -- be presented as confirmed.
    create type public.date_certainty as enum (
      'confirmed', 'claimed', 'approximate', 'conflicting', 'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'time_origin') then
    -- How the time was established. Different origins fail in different ways,
    -- which is what lets the engine generate explanations rather than guess.
    create type public.time_origin as enum ('account', 'recording', 'document', 'inference');
  end if;

  if not exists (select 1 from pg_type where typname = 'contradiction_type') then
    create type public.contradiction_type as enum (
      'direct', 'temporal', 'geographic', 'narrative', 'documentary', 'evidentiary'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'contradiction_status') then
    -- §10: potential until verified, and verification is a human act. Nothing
    -- automated writes anything but 'potential'.
    create type public.contradiction_status as enum ('potential', 'verified', 'resolved');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  source_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 300),

  -- Nullable, because §9 lists unknown dates as a legitimate timeline entry.
  -- An event that certainly happened at a time nobody knows is a finding; a
  -- placeholder date would sort it to the epoch and read as one.
  occurred_at timestamptz,
  certainty public.date_certainty not null default 'unknown',
  origin public.time_origin not null,

  -- For an approximate time, how wide the window is either side.
  tolerance_minutes integer check (tolerance_minutes is null or tolerance_minutes >= 0),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- An event with no time must say so, and one with a time must not claim to
  -- be unknown. Either would make the timeline lie about what it knows.
  constraint events_time_matches_certainty check (
    (certainty = 'unknown' and occurred_at is null)
    or (certainty <> 'unknown' and occurred_at is not null)
  ),

  constraint events_tolerance_only_when_approximate check (
    tolerance_minutes is null or certainty = 'approximate'
  ),

  -- Same isolation as evidence: an event cannot cite a source in another case.
  constraint events_source_same_case
    foreign key (case_id, source_id) references public.sources (case_id, id) on delete cascade
);

comment on table public.events is
  'Timeline entries. An event whose time is unknown carries no date rather than a placeholder, because a placeholder sorts to the epoch and reads as a finding.';

create index if not exists events_case_time_idx on public.events (case_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Contradictions
-- ---------------------------------------------------------------------------

-- Postgres refuses a subquery inside a check constraint, and validating each
-- element of a JSON array needs one. An immutable function is the supported
-- way round it: check constraints may call functions, provided they are
-- immutable, which this is — it reads nothing but its argument.
--
-- The caveat that comes with the technique: changing this function does not
-- revalidate rows already stored. Tightening it later means a migration that
-- re-checks existing data explicitly.
create or replace function public.explanations_are_complete(p_explanations jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_explanations) = 'array'
     and jsonb_array_length(p_explanations) >= 2
     and not exists (
       select 1
       from jsonb_array_elements(p_explanations) as e
       where jsonb_typeof(e) <> 'object'
          or coalesce(btrim(e ->> 'summary'), '') = ''
          or coalesce(btrim(e ->> 'distinguishedBy'), '') = ''
     );
$$;

comment on function public.explanations_are_complete(jsonb) is
  'Two or more explanations, each with a summary and something that would settle it. A single explanation is a conclusion with extra steps.';

create table if not exists public.contradictions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  type public.contradiction_type not null,

  source_a uuid not null,
  source_b uuid not null,

  -- §10 requires the exact difference, not the fact of disagreement.
  difference text not null check (length(btrim(difference)) > 0),

  -- §10 requires possible explanations. The check is the same rule the engine
  -- applies in recordProblems(): fewer than two is refused, because a single
  -- explanation is a conclusion with extra steps.
  --
  -- Each entry is {summary, distinguishedBy}. An explanation nothing could
  -- settle is noise, so both keys are required.
  -- No default: '[]' could never satisfy the constraint below, and a default
  -- that always fails is a worse error message than a missing column.
  explanations jsonb not null,

  significance text not null check (length(btrim(significance)) > 0),
  status public.contradiction_status not null default 'potential',

  -- Who verified it, if anybody. §10 makes verification a human act, so a
  -- verified record without a person is not verified, it is asserted.
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,

  created_at timestamptz not null default now(),

  constraint contradictions_two_sources check (source_a <> source_b),

  constraint contradictions_need_explanations check (
    public.explanations_are_complete(explanations)
  ),

  -- A verified contradiction names who verified it and when. Without that the
  -- status is a claim about a claim.
  constraint contradictions_verification_is_attributed check (
    status <> 'verified' or (verified_by is not null and verified_at is not null)
  ),

  constraint contradictions_source_a_same_case
    foreign key (case_id, source_a) references public.sources (case_id, id) on delete cascade,
  constraint contradictions_source_b_same_case
    foreign key (case_id, source_b) references public.sources (case_id, id) on delete cascade
);

comment on table public.contradictions is
  'Where two sources conflict. A record without at least two possible explanations cannot be stored: a single explanation is a conclusion.';

create index if not exists contradictions_case_idx on public.contradictions (case_id, status);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists events_select on public.events;
drop policy if exists events_write on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
drop policy if exists contradictions_select on public.contradictions;
drop policy if exists contradictions_write on public.contradictions;
drop policy if exists contradictions_update on public.contradictions;
drop policy if exists contradictions_delete on public.contradictions;

alter table public.events enable row level security;
alter table public.contradictions enable row level security;

create policy events_select on public.events
  for select using (public.can_read_case(case_id));
create policy events_write on public.events
  for insert with check (public.can_write_case(case_id));
create policy events_update on public.events
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy events_delete on public.events
  for delete using (public.can_write_case(case_id));

create policy contradictions_select on public.contradictions
  for select using (public.can_read_case(case_id));
create policy contradictions_write on public.contradictions
  for insert with check (public.can_write_case(case_id));
create policy contradictions_update on public.contradictions
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy contradictions_delete on public.contradictions
  for delete using (public.can_write_case(case_id));

grant select on public.events, public.contradictions to anon, authenticated;
grant insert, update, delete on public.events, public.contradictions to authenticated;
grant select, insert, update, delete on public.events, public.contradictions to service_role;
