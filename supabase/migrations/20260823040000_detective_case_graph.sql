-- THE DETECTIVE, section 11. The case graph.
--
-- People, organisations and locations as nodes; the specification's relation
-- verbs as edges. Two decisions here are not the obvious ones and both are
-- about the same thing: an edge is a claim, and a graph that forgets that
-- becomes a picture of what the investigator believes rather than of what the
-- record shows.
--
-- **An edge carries an epistemic status.** Section 4 says the system must never
-- casually collapse information into truth, and a line drawn between two
-- people is exactly such a collapse when nobody asks where it came from. So an
-- edge reuses `epistemic_status`, and one asserted as `fact` must name the
-- source establishing it — enforced, not asked for.
--
-- **Endpoints are exclusive arcs rather than a type/id pair.** The audit
-- addendum specifies `source_node_type` plus `source_node_id`, which is the
-- usual way and gives up referential integrity: nothing stops an edge pointing
-- at a deleted claim, and nothing detects it afterwards. Four nullable foreign
-- keys with a check that exactly one is set costs three columns and keeps
-- cascade deletion working, so a dangling edge is not representable.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'entity_kind') then
    -- The three the specification gives field tables for. Vehicles, documents
    -- and communications are listed in the graph's prose; they are not added
    -- speculatively, because an enum value is cheap to add and a wrong one is
    -- not, once edges reference it.
    create type public.entity_kind as enum ('person', 'organisation', 'location');
  end if;

  if not exists (select 1 from pg_type where typname = 'case_relation') then
    -- Section 11's verbs, verbatim. Two are symmetric and the rest directed;
    -- which is which is settled by `public.relation_is_symmetric` below rather
    -- than by whoever writes the edge.
    create type public.case_relation as enum (
      'knows', 'contacted', 'visited', 'owns', 'works_for', 'travelled_to',
      'witnessed', 'mentioned', 'contradicts', 'corroborates',
      'occurred_before', 'occurred_after', 'geographically_connected_to'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'location_precision') then
    -- Mirrors the event timeline's confidence discipline: unknown is a state,
    -- not a missing value to be filled in later with a guess.
    create type public.location_precision as enum ('exact', 'approximate', 'unknown');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Nodes
-- ---------------------------------------------------------------------------

create table if not exists public.case_entities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  kind public.entity_kind not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  -- Alternate spellings encountered in sources. The commonest reason two
  -- records about one person never meet is that one calls her Nomsa and the
  -- other N. Dlamini.
  aliases text[] not null default '{}',
  -- "configurable, not a fixed enum", per the addendum: witness, official,
  -- journalist, subject and whatever this case needs.
  role_in_case text,
  description text,
  -- Section 18. A person who is a minor, or a record holding sensitive personal
  -- data. Flagged on the row so that nothing downstream has to infer it.
  sensitive boolean not null default false,

  -- Locations only.
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  precision public.location_precision,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- A person cannot carry coordinates. Not tidiness: a latitude on a person is
  -- either a mistake or a claim about where somebody lives, and the second one
  -- belongs in an edge to a location with a source behind it.
  constraint case_entities_place_fields
    check (kind = 'location' or (latitude is null and longitude is null and precision is null)),
  constraint case_entities_coordinates_complete
    check ((latitude is null) = (longitude is null)),

  unique (case_id, id)
);

comment on table public.case_entities is
  'People, organisations and locations in a case. Nodes of the case graph.';

create index if not exists case_entities_case_idx on public.case_entities (case_id, kind);

-- ---------------------------------------------------------------------------
-- Which relations are symmetric
-- ---------------------------------------------------------------------------

-- A function rather than a column, so the answer cannot differ between two
-- edges of the same type. "A knows B" is the same fact as "B knows A"; "A
-- contacted B" is not.
--
-- Two, and `contradicts` and `corroborates` are deliberately not among them,
-- which is a correction rather than an omission. They are symmetric between
-- two records of the same kind and directed everywhere else: "this gate log
-- corroborates that claim" does not mean the claim corroborates the log, and
-- normalising the pair swapped the source into the target position and lost
-- which one was doing the corroborating. The specification's own examples of a
-- symmetric verb are these two.
create or replace function public.relation_is_symmetric(p_relation public.case_relation)
returns boolean
language sql
immutable
as $$
  select p_relation in ('knows', 'geographically_connected_to');
$$;

-- ---------------------------------------------------------------------------
-- What events need before an edge can point at one
-- ---------------------------------------------------------------------------

-- `claims` and `sources` gained a unique constraint on (case_id, id) when
-- `evidence` needed to reference the pair; `events` never did, because nothing
-- referenced it until now. A primary key on id alone is not enough for a
-- composite foreign key, and the error Postgres gives says only "there is no
-- unique constraint matching given keys" without naming which key it wanted.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass and conname = 'events_case_id_id_key'
  ) then
    alter table public.events add constraint events_case_id_id_key unique (case_id, id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Edges
-- ---------------------------------------------------------------------------

create table if not exists public.case_edges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  relation public.case_relation not null,

  -- Exclusive arcs. Exactly one of each set is filled, checked below, and each
  -- is a real foreign key — so deleting a person takes their edges with them
  -- and an edge to a claim that no longer exists cannot be stored.
  source_entity_id uuid,
  source_event_id uuid,
  source_claim_id uuid,
  source_source_id uuid,
  target_entity_id uuid,
  target_event_id uuid,
  target_claim_id uuid,
  target_source_id uuid,

  -- Section 4. An edge is a claim about the case and carries the same
  -- classification as any other. `unknown` is the honest default.
  status public.epistemic_status not null default 'unknown',
  -- The record establishing the relationship, where there is one.
  established_by uuid,
  note text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint case_edges_one_source
    check (num_nonnulls(source_entity_id, source_event_id, source_claim_id, source_source_id) = 1),
  constraint case_edges_one_target
    check (num_nonnulls(target_entity_id, target_event_id, target_claim_id, target_source_id) = 1),

  -- An edge asserted as fact must say what establishes it. Everything else may
  -- stand unsourced, and says so by its status rather than by looking the same
  -- as a sourced one.
  constraint case_edges_fact_needs_a_source
    check (status <> 'fact' or established_by is not null),

  -- Both ends and the establishing record inside this case.
  constraint case_edges_source_entity_same_case
    foreign key (case_id, source_entity_id) references public.case_entities (case_id, id) on delete cascade,
  constraint case_edges_target_entity_same_case
    foreign key (case_id, target_entity_id) references public.case_entities (case_id, id) on delete cascade,
  constraint case_edges_source_event_same_case
    foreign key (case_id, source_event_id) references public.events (case_id, id) on delete cascade,
  constraint case_edges_target_event_same_case
    foreign key (case_id, target_event_id) references public.events (case_id, id) on delete cascade,
  constraint case_edges_source_claim_same_case
    foreign key (case_id, source_claim_id) references public.claims (case_id, id) on delete cascade,
  constraint case_edges_target_claim_same_case
    foreign key (case_id, target_claim_id) references public.claims (case_id, id) on delete cascade,
  constraint case_edges_source_source_same_case
    foreign key (case_id, source_source_id) references public.sources (case_id, id) on delete cascade,
  constraint case_edges_target_source_same_case
    foreign key (case_id, target_source_id) references public.sources (case_id, id) on delete cascade,
  constraint case_edges_established_by_same_case
    foreign key (case_id, established_by) references public.sources (case_id, id) on delete set null
);

comment on table public.case_edges is
  'A relationship between two things in a case. Itself a claim: it carries an epistemic status, and one asserted as fact must name its source.';

-- ---------------------------------------------------------------------------
-- One row per relationship, not one per direction
-- ---------------------------------------------------------------------------

-- A symmetric edge is normalised so that the pair sorts one way, and then the
-- unique index below refuses the mirror. A row per direction is the classic
-- way a graph ends up asserting that A knows B while B has never heard of A;
-- here that state is not representable.
create or replace function public.case_edges_normalise()
returns trigger
language plpgsql
as $$
declare
  v_source text;
  v_target text;
begin
  if not public.relation_is_symmetric(new.relation) then
    return new;
  end if;

  -- A stable key across the four endpoint kinds, so the ordering is
  -- deterministic whatever they are.
  v_source := concat_ws(':',
    case when new.source_entity_id is not null then '1' when new.source_event_id is not null then '2'
         when new.source_claim_id is not null then '3' else '4' end,
    coalesce(new.source_entity_id, new.source_event_id, new.source_claim_id, new.source_source_id)::text);
  v_target := concat_ws(':',
    case when new.target_entity_id is not null then '1' when new.target_event_id is not null then '2'
         when new.target_claim_id is not null then '3' else '4' end,
    coalesce(new.target_entity_id, new.target_event_id, new.target_claim_id, new.target_source_id)::text);

  if v_source > v_target then
    select new.target_entity_id, new.target_event_id, new.target_claim_id, new.target_source_id,
           new.source_entity_id, new.source_event_id, new.source_claim_id, new.source_source_id
      into new.source_entity_id, new.source_event_id, new.source_claim_id, new.source_source_id,
           new.target_entity_id, new.target_event_id, new.target_claim_id, new.target_source_id;
  end if;

  return new;
end;
$$;

revoke all on function public.case_edges_normalise() from public;

drop trigger if exists case_edges_normalise_trigger on public.case_edges;
create trigger case_edges_normalise_trigger
  before insert or update on public.case_edges
  for each row execute function public.case_edges_normalise();

-- Nulls are distinct in a unique index, which would let the same edge be
-- stored repeatedly, so the endpoints are coalesced to a sentinel first.
create unique index if not exists case_edges_unique on public.case_edges (
  case_id,
  relation,
  coalesce(source_entity_id, source_event_id, source_claim_id, source_source_id),
  coalesce(target_entity_id, target_event_id, target_claim_id, target_source_id)
);

create index if not exists case_edges_case_idx on public.case_edges (case_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.case_entities enable row level security;
alter table public.case_edges enable row level security;

drop policy if exists case_entities_select on public.case_entities;
drop policy if exists case_entities_insert on public.case_entities;
drop policy if exists case_entities_update on public.case_entities;
drop policy if exists case_entities_delete on public.case_entities;

create policy case_entities_select on public.case_entities
  for select using (public.can_read_case(case_id));
create policy case_entities_insert on public.case_entities
  for insert with check (public.can_write_case(case_id));
create policy case_entities_update on public.case_entities
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy case_entities_delete on public.case_entities
  for delete using (public.can_write_case(case_id));

drop policy if exists case_edges_select on public.case_edges;
drop policy if exists case_edges_insert on public.case_edges;
drop policy if exists case_edges_update on public.case_edges;
drop policy if exists case_edges_delete on public.case_edges;

create policy case_edges_select on public.case_edges
  for select using (public.can_read_case(case_id));
create policy case_edges_insert on public.case_edges
  for insert with check (public.can_write_case(case_id));
-- Update is allowed here, unlike hypothesis links, and the difference is what
-- is being changed. Reclassifying evidence rewrites what the investigator
-- thought it showed; raising an edge from `unknown` to `fact` once its source
-- is found is the ordinary progress of an investigation, and the constraint
-- above still refuses it without one.
create policy case_edges_update on public.case_edges
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy case_edges_delete on public.case_edges
  for delete using (public.can_write_case(case_id));

grant select, insert, update, delete on public.case_entities to authenticated;
grant select, insert, update, delete on public.case_edges to authenticated;
